import "server-only";
import { createHash, randomBytes, randomUUID } from "crypto";
import QRCode from "qrcode";
import { createClient as createAuthClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { APP_CATALOG } from "@/lib/apps";
import { hasServiceRole, isLiveSupabase } from "@/lib/config";
import {
  FACTOR_COOKIE,
  MFA_COOKIE,
  SESSION_COOKIE,
  hubCookieOptions,
  readSessionToken,
  readTicket,
  seal,
} from "@/lib/cookies";
import { pushAudit, toPublic, withDb, type MockUser } from "@/lib/mock-store";
import { assessPassword } from "@/lib/password-policy";
import { hashPassword, verifyPassword } from "@/lib/password-hash";
import { mapProfile, type ProfileRow } from "@/lib/profile-map";
import { requestMeta, type RequestMeta } from "@/lib/request-meta";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateSecret, otpauthUri, totpCode, verifyTotp } from "@/lib/totp";
import {
  AUDIT_ACTIONS,
  EMPTY_PERMISSIONS,
  type Alert,
  type AuditAction,
  type AuditRecord,
  type LoginResult,
  type Permissions,
  type PublicUser,
  type Role,
  type Status,
} from "@/lib/types";

const SESSION_MS = 12 * 60 * 60 * 1000;
const TICKET_MS = 5 * 60 * 1000;
const LOCK_MS = 30 * 60 * 1000;
const RESET_REDIRECT = "https://db357.com/reset-password";
const PASSWORD_SETUP_REDIRECT = "https://www.db357.com/reset-password";
const FIRST_SUPER_ADMIN_EMAIL = "lastgod959@gmail.com";
const FIRST_SUPER_ADMIN_PERMISSIONS: Permissions = {
  can_access_land: true,
  can_access_dmck: true,
  can_access_coupon: true,
  can_access_loan: true,
  can_access_aircon: true,
};

type AuditInput = {
  userId: string | null;
  email: string | null;
  action: AuditAction;
  targetApp?: string | null;
  ip: string;
  userAgent: string;
};

async function cookieTarget() {
  const { headers } = await import("next/headers");
  const headerList = await headers();
  return {
    host: headerList.get("host"),
    protocol: headerList.get("x-forwarded-proto"),
  };
}

async function writeCookie(name: string, value: string, maxAge: number) {
  const jar = await cookies();
  const target = await cookieTarget();
  jar.set(name, value, { ...hubCookieOptions(target.host, target.protocol), maxAge });
}

async function clearCookie(name: string) {
  const jar = await cookies();
  const target = await cookieTarget();
  jar.set(name, "", { ...hubCookieOptions(target.host, target.protocol), maxAge: 0 });
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function lockResult(until: string) {
  return { ok: false as const, code: "locked" as const, error: "This desk is locked.", lockedUntil: until };
}

function inactiveResult(status: Status) {
  if (status === "suspended") {
    return { ok: false as const, code: "suspended" as const, error: "This account is suspended. Contact the administrator." };
  }
  return { ok: false as const, code: "pending" as const, error: "This account is awaiting approval. Contact the administrator." };
}

const SERVICE_ROLE_REQUIRED = "The service role key is required on the server for this action.";

function serviceClient() {
  return hasServiceRole() ? createAdminClient() : null;
}

function schemaMissing(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache|hub_profiles|security_audit_logs/i.test(error.message ?? "");
}

async function writeAudit(entry: AuditInput) {
  if (!isLiveSupabase()) {
    await withDb((db) => {
      pushAudit(db, {
        userId: entry.userId,
        email: entry.email,
        action: entry.action,
        ipAddress: entry.ip,
        userAgent: entry.userAgent,
        targetApp: entry.targetApp,
      });
    });
    return;
  }
  const admin = serviceClient();
  if (!admin) return;
  await admin.from("security_audit_logs").insert({
    user_id: entry.userId,
    email: entry.email,
    action: entry.action,
    ip_address: entry.ip,
    user_agent: entry.userAgent,
    target_app: entry.targetApp ?? null,
  });
}

export async function logUnauthorized(user: PublicUser, targetApp: string, meta: RequestMeta) {
  await writeAudit({
    userId: user.id,
    email: user.email,
    action: "unauthorized_app_attempt",
    targetApp,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

function registerMockFailure(db: Parameters<typeof pushAudit>[0], user: MockUser, meta: RequestMeta) {
  user.failedLoginAttempts += 1;
  pushAudit(db, {
    userId: user.id,
    email: user.email,
    action: "login_failed",
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  if (user.failedLoginAttempts >= 5) {
    user.lockedUntil = new Date(Date.now() + LOCK_MS).toISOString();
    pushAudit(db, {
      userId: user.id,
      email: user.email,
      action: "account_locked",
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return lockResult(user.lockedUntil);
  }
  return { ok: false as const, error: "Invalid credentials." };
}

function releaseExpiredLock(user: MockUser) {
  if (user.lockedUntil && new Date(user.lockedUntil).getTime() <= Date.now()) {
    user.lockedUntil = null;
    user.failedLoginAttempts = 0;
  }
}

async function issueSession(user: MockUser, meta: RequestMeta) {
  const sid = await withDb((db) => {
    const row = db.users.find((item) => item.id === user.id);
    if (!row) return null;
    const id = randomUUID();
    db.sessions.push({
      id,
      userId: row.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
      createdAt: new Date().toISOString(),
      revokedAt: null,
    });
    row.failedLoginAttempts = 0;
    row.lockedUntil = null;
    row.lastLoginAt = new Date().toISOString();
    pushAudit(db, {
      userId: row.id,
      email: row.email,
      action: "login_success",
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return id;
  });
  if (!sid) return { ok: false, error: "The desk could not open a session." } as const;
  const token = await seal({
    sid,
    uid: user.id,
    role: user.role,
    exp: Date.now() + SESSION_MS,
  });
  await writeCookie(SESSION_COOKIE, token, SESSION_MS / 1000);
  await clearCookie(MFA_COOKIE);
  return { ok: true } as const;
}

export async function login(email: string, password: string, totp: string | undefined, meta: RequestMeta): Promise<LoginResult> {
  if (isLiveSupabase()) return loginLive(email, password, totp, meta);
  return loginMock(email, password, totp, meta);
}

async function loginMock(email: string, password: string, totp: string | undefined, meta: RequestMeta): Promise<LoginResult> {
  if (totp) {
    const jar = await cookies();
    const ticket = await readTicket(jar.get(MFA_COOKIE)?.value);
    if (!ticket) return { ok: false as const, error: "The authenticator step expired. Sign in again." };
    const result = await withDb((db) => {
      const user = db.users.find((item) => item.id === ticket.uid);
      if (!user?.mfaSecret) return { kind: "error" as const, error: "No authenticator is enrolled." };
      if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) return { kind: "locked" as const, until: user.lockedUntil };
      releaseExpiredLock(user);
      if (!verifyTotp(user.mfaSecret, totp)) return { kind: "failed" as const, failure: registerMockFailure(db, user, meta) };
      if (user.status !== "active") return { kind: "inactive" as const, failure: inactiveResult(user.status) };
      return { kind: "ready" as const, row: user };
    });
    if (result.kind === "error") return { ok: false as const, error: result.error };
    if (result.kind === "locked") return lockResult(result.until);
    if (result.kind === "failed" || result.kind === "inactive") return result.failure;
    return issueSession(result.row, meta);
  }

  const result = await withDb((db) => {
    const user = db.users.find((item) => item.email === email);
    const passwordOk = verifyPassword(password, user?.passwordHash ?? db.dummyHash);
    if (user?.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) return { kind: "locked" as const, until: user.lockedUntil };
    if (user) releaseExpiredLock(user);
    if (!user || !passwordOk) {
      if (!user) {
        pushAudit(db, {
          userId: null,
          email,
          action: "login_failed",
          ipAddress: meta.ip,
          userAgent: meta.userAgent,
        });
        return { kind: "invalid" as const };
      }
      return { kind: "failed" as const, failure: registerMockFailure(db, user, meta) };
    }
    if (user.status !== "active") return { kind: "inactive" as const, failure: inactiveResult(user.status) };
    if (user.mfaEnabled && user.mfaSecret) {
      return { kind: "mfa" as const, userId: user.id, devCode: totpCode(user.mfaSecret) };
    }
    return { kind: "ready" as const, row: user };
  });

  if (result.kind === "locked") return lockResult(result.until);
  if (result.kind === "invalid") return { ok: false as const, error: "Invalid credentials." };
  if (result.kind === "failed" || result.kind === "inactive") return result.failure;
  if (result.kind === "mfa") {
    const token = await seal({ tid: randomUUID(), uid: result.userId, exp: Date.now() + TICKET_MS });
    await writeCookie(MFA_COOKIE, token, TICKET_MS / 1000);
    return { ok: false as const, mfaRequired: true as const, devCode: result.devCode };
  }
  return issueSession(result.row, meta);
}

async function loginLive(email: string, password: string, totp: string | undefined, meta: RequestMeta): Promise<LoginResult> {
  const admin = serviceClient();
  const supabase = await createClient();
  let profile: ProfileRow | null = null;
  if (admin) {
    const lookedUp = await admin.from("hub_profiles").select("*").eq("email", email).maybeSingle();
    if (schemaMissing(lookedUp.error)) return { ok: false, error: "The security schema is not installed yet." };
    profile = (lookedUp.data as ProfileRow | null) ?? null;
  }

  if (profile?.locked_until && new Date(profile.locked_until).getTime() > Date.now()) {
    return lockResult(profile.locked_until);
  }
  if (admin && profile?.locked_until && new Date(profile.locked_until).getTime() <= Date.now()) {
    await admin.from("hub_profiles").update({ locked_until: null, failed_login_attempts: 0 }).eq("id", profile.id);
    profile.locked_until = null;
    profile.failed_login_attempts = 0;
  }

  if (totp) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { ok: false, error: "The authenticator step expired. Sign in again." };
    const factors = await supabase.auth.mfa.listFactors();
    const factor = factors.data?.totp?.[0];
    if (!factor) return { ok: false, error: "No authenticator is enrolled." };
    const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (challenge.error || !challenge.data) return { ok: false, error: "The authenticator could not be challenged." };
    const verified = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.data.id,
      code: totp.replace(/\s/g, ""),
    });
    if (verified.error) {
      return registerLiveFailure(profile, email, meta);
    }
    if (profile && profile.status !== "active") {
      await supabase.auth.signOut();
      return inactiveResult(profile.status);
    }
    if (profile) await markLiveSuccess(profile.id, email, meta);
    return { ok: true };
  }

  const signed = await supabase.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.user) return registerLiveFailure(profile, email, meta);
  if (!profile) {
    const own = await supabase.from("hub_profiles").select("*").eq("id", signed.data.user.id).maybeSingle();
    if (schemaMissing(own.error)) {
      await supabase.auth.signOut();
      return { ok: false, error: "The security schema is not installed yet." };
    }
    profile = (own.data as ProfileRow | null) ?? null;
  }
  if (!profile) {
    await supabase.auth.signOut();
    return { ok: false, error: "Invalid credentials." };
  }
  if (profile.locked_until && new Date(profile.locked_until).getTime() > Date.now()) {
    await supabase.auth.signOut();
    return lockResult(profile.locked_until);
  }
  if (profile.status !== "active") {
    await supabase.auth.signOut();
    return inactiveResult(profile.status);
  }
  const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (profile.mfa_enabled || (aal.data?.nextLevel === "aal2" && aal.data.currentLevel !== "aal2")) {
    return { ok: false, mfaRequired: true };
  }
  await markLiveSuccess(profile.id, email, meta);
  return { ok: true };
}

async function registerLiveFailure(profile: ProfileRow | null, email: string, meta: RequestMeta): Promise<LoginResult> {
  const admin = serviceClient();
  if (!admin || !profile) {
    await writeAudit({ userId: null, email, action: "login_failed", ip: meta.ip, userAgent: meta.userAgent });
    return { ok: false, error: "Invalid credentials." };
  }
  const attempts = (profile.failed_login_attempts ?? 0) + 1;
  const lockedUntil = attempts >= 5 ? new Date(Date.now() + LOCK_MS).toISOString() : null;
  await admin
    .from("hub_profiles")
    .update({ failed_login_attempts: attempts, locked_until: lockedUntil })
    .eq("id", profile.id);
  await writeAudit({ userId: profile.id, email, action: "login_failed", ip: meta.ip, userAgent: meta.userAgent });
  if (lockedUntil) {
    await writeAudit({ userId: profile.id, email, action: "account_locked", ip: meta.ip, userAgent: meta.userAgent });
    return lockResult(lockedUntil);
  }
  return { ok: false, error: "Invalid credentials." };
}

async function markLiveSuccess(userId: string, email: string, meta: RequestMeta) {
  const admin = serviceClient();
  if (!admin) {
    await writeAudit({ userId, email, action: "login_success", ip: meta.ip, userAgent: meta.userAgent });
    return;
  }
  await admin
    .from("hub_profiles")
    .update({ failed_login_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() })
    .eq("id", userId);
  await writeAudit({ userId, email, action: "login_success", ip: meta.ip, userAgent: meta.userAgent });
}

export async function requestReset(email: string, meta: RequestMeta) {
  if (isLiveSupabase()) {
    const admin = serviceClient();
    const supabase = await createClient();
    const profile = admin
      ? (await admin.from("hub_profiles").select("id, email").eq("email", email).maybeSingle()).data
      : null;
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: RESET_REDIRECT });
    if (profile) {
      await writeAudit({
        userId: profile.id,
        email: profile.email,
        action: "password_reset_requested",
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    }
    return { ok: true as const };
  }

  const issued = await withDb((db) => {
    const user = db.users.find((item) => item.email === email);
    if (!user) return null;
    const token = randomBytes(32).toString("hex");
    db.resetTokens = db.resetTokens.filter((item) => new Date(item.expiresAt).getTime() > Date.now());
    db.resetTokens.push({
      hash: sha256(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + LOCK_MS).toISOString(),
    });
    pushAudit(db, {
      userId: user.id,
      email: user.email,
      action: "password_reset_requested",
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return token;
  });
  return { ok: true as const, devResetUrl: issued ? `/reset-password?token=${issued}` : undefined };
}

export async function resetPassword(
  input: {
    token?: string;
    code?: string;
    tokenHash?: string;
    otpType?: "invite" | "recovery";
    accessToken?: string;
    refreshToken?: string;
    password: string;
  },
  meta: RequestMeta,
) {
  const policy = assessPassword(input.password);
  if (!policy.ok) return { ok: false as const, error: "Password does not meet the policy." };

  if (isLiveSupabase()) {
    if (input.accessToken && input.refreshToken) {
      return applyPasswordFromSession(input.accessToken, input.refreshToken, input.password, meta);
    }
    const supabase = await createClient();
    if (input.code) {
      const exchanged = await supabase.auth.exchangeCodeForSession(input.code);
      if (exchanged.error) return { ok: false as const, error: "This reset link is no longer valid." };
    } else if (input.tokenHash) {
      const verified = await supabase.auth.verifyOtp({
        type: input.otpType === "invite" ? "invite" : "recovery",
        token_hash: input.tokenHash,
      });
      if (verified.error) return { ok: false as const, error: "This reset link is no longer valid." };
    } else {
      return { ok: false as const, error: "This reset link is no longer valid." };
    }
    const updated = await supabase.auth.updateUser({ password: input.password });
    if (updated.error || !updated.data.user) return { ok: false as const, error: "The password could not be changed." };
    await writeAudit({
      userId: updated.data.user.id,
      email: updated.data.user.email ?? null,
      action: "password_changed",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    await supabase.auth.signOut({ scope: "global" });
    return { ok: true as const };
  }

  if (!input.token) return { ok: false as const, error: "This reset link is no longer valid." };
  const changed = await withDb((db) => {
    const hash = sha256(input.token!);
    const row = db.resetTokens.find((item) => item.hash === hash && new Date(item.expiresAt).getTime() > Date.now());
    if (!row) return false;
    const user = db.users.find((item) => item.id === row.userId);
    if (!user) return false;
    user.passwordHash = hashPassword(input.password);
    db.resetTokens = db.resetTokens.filter((item) => item.hash !== hash);
    db.sessions.forEach((session) => {
      if (session.userId === user.id && !session.revokedAt) session.revokedAt = new Date().toISOString();
    });
    pushAudit(db, {
      userId: user.id,
      email: user.email,
      action: "password_changed",
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return true;
  });
  if (!changed) return { ok: false as const, error: "This reset link is no longer valid." };
  await clearCookie(SESSION_COOKIE);
  return { ok: true as const };
}

export async function changePassword(user: PublicUser, current: string, next: string, meta: RequestMeta) {
  const policy = assessPassword(next);
  if (!policy.ok) return { ok: false as const, error: "Password does not meet the policy." };
  if (current === next) return { ok: false as const, error: "Choose a different password." };

  if (isLiveSupabase()) {
    const supabase = await createClient();
    const signed = await supabase.auth.signInWithPassword({ email: user.email, password: current });
    if (signed.error) return { ok: false as const, error: "Current password is not correct." };
    const updated = await supabase.auth.updateUser({ password: next });
    if (updated.error) return { ok: false as const, error: "The password could not be changed." };
    await writeAudit({ userId: user.id, email: user.email, action: "password_changed", ip: meta.ip, userAgent: meta.userAgent });
    return { ok: true as const };
  }

  const ok = await withDb((db) => {
    const row = db.users.find((item) => item.id === user.id);
    if (!row || !verifyPassword(current, row.passwordHash)) return false;
    row.passwordHash = hashPassword(next);
    pushAudit(db, {
      userId: row.id,
      email: row.email,
      action: "password_changed",
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return true;
  });
  if (!ok) return { ok: false as const, error: "Current password is not correct." };
  return { ok: true as const };
}

export async function updateProfile(user: PublicUser, fullName: string, phone: string) {
  if (isLiveSupabase()) {
    const supabase = await createClient();
    const { error } = await supabase.from("hub_profiles").update({ full_name: fullName, phone }).eq("id", user.id);
    if (error) return { ok: false as const, error: "The profile could not be saved." };
    return { ok: true as const };
  }
  await withDb((db) => {
    const row = db.users.find((item) => item.id === user.id);
    if (!row) return;
    row.fullName = fullName;
    row.phone = phone;
  });
  return { ok: true as const };
}

export async function enrollMfa(user: PublicUser) {
  if (user.mfaEnabled) return { ok: false as const, error: "An authenticator is already active." };
  if (isLiveSupabase()) {
    const supabase = await createClient();
    const existing = await supabase.auth.mfa.listFactors();
    for (const factor of existing.data?.totp ?? []) {
      if (factor.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
    const enrolled = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "DB357 Hub" });
    if (enrolled.error || !enrolled.data?.totp) return { ok: false as const, error: "The authenticator could not be prepared." };
    const token = await seal({ tid: enrolled.data.id, uid: user.id, exp: Date.now() + 10 * 60 * 1000 });
    await writeCookie(FACTOR_COOKIE, token, 600);
    return {
      ok: true as const,
      qr: enrolled.data.totp.qr_code,
      secret: enrolled.data.totp.secret,
    };
  }

  const secret = generateSecret();
  await withDb((db) => {
    const row = db.users.find((item) => item.id === user.id);
    if (row) row.mfaPendingSecret = secret;
  });
  const uri = otpauthUri(user.email, secret);
  const qr = await QRCode.toDataURL(uri, {
    margin: 1,
    width: 240,
    color: { dark: "#F5F5F7", light: "#0F1117" },
  });
  return { ok: true as const, qr, secret, devCode: totpCode(secret) };
}

export async function confirmMfa(user: PublicUser, code: string, meta: RequestMeta) {
  if (isLiveSupabase()) {
    const jar = await cookies();
    const factor = await readTicket(jar.get(FACTOR_COOKIE)?.value);
    if (!factor) return { ok: false as const, error: "Enrollment expired. Start again." };
    const supabase = await createClient();
    const challenge = await supabase.auth.mfa.challenge({ factorId: factor.tid });
    if (challenge.error || !challenge.data) return { ok: false as const, error: "The authenticator could not be challenged." };
    const verified = await supabase.auth.mfa.verify({
      factorId: factor.tid,
      challengeId: challenge.data.id,
      code: code.replace(/\s/g, ""),
    });
    if (verified.error) return { ok: false as const, error: "That code was not accepted." };
    const admin = serviceClient();
    if (!admin) return { ok: false as const, error: SERVICE_ROLE_REQUIRED };
    await admin.from("hub_profiles").update({ mfa_enabled: true }).eq("id", user.id);
    await writeAudit({ userId: user.id, email: user.email, action: "mfa_enabled", ip: meta.ip, userAgent: meta.userAgent });
    await clearCookie(FACTOR_COOKIE);
    return { ok: true as const };
  }

  const ok = await withDb((db) => {
    const row = db.users.find((item) => item.id === user.id);
    if (!row?.mfaPendingSecret || !verifyTotp(row.mfaPendingSecret, code)) return false;
    row.mfaSecret = row.mfaPendingSecret;
    row.mfaPendingSecret = null;
    row.mfaEnabled = true;
    pushAudit(db, {
      userId: row.id,
      email: row.email,
      action: "mfa_enabled",
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return true;
  });
  if (!ok) return { ok: false as const, error: "That code was not accepted." };
  return { ok: true as const };
}

export async function mockMfaHint() {
  if (isLiveSupabase()) return null;
  const jar = await cookies();
  const ticket = await readTicket(jar.get(MFA_COOKIE)?.value);
  const session = await readSessionToken(jar.get(SESSION_COOKIE)?.value);
  return withDb((db) => {
    if (ticket) {
      const user = db.users.find((item) => item.id === ticket.uid);
      if (user?.mfaSecret) return totpCode(user.mfaSecret);
    }
    if (session) {
      const user = db.users.find((item) => item.id === session.uid);
      if (user?.mfaPendingSecret) return totpCode(user.mfaPendingSecret);
    }
    return null;
  });
}

export async function signOutCurrent() {
  if (isLiveSupabase()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return;
  }
  const jar = await cookies();
  const payload = await readSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (payload) {
    await withDb((db) => {
      const session = db.sessions.find((item) => item.id === payload.sid);
      if (session && !session.revokedAt) session.revokedAt = new Date().toISOString();
    });
  }
  await clearCookie(SESSION_COOKIE);
  await clearCookie(MFA_COOKIE);
}

export async function signOutAll(user: PublicUser) {
  if (isLiveSupabase()) {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "global" });
    return;
  }
  await withDb((db) => {
    const now = new Date().toISOString();
    db.sessions.forEach((session) => {
      if (session.userId === user.id && !session.revokedAt) session.revokedAt = now;
    });
  });
  await clearCookie(SESSION_COOKIE);
  await clearCookie(MFA_COOKIE);
}

export async function listUsers(): Promise<PublicUser[]> {
  if (isLiveSupabase()) {
    const client = serviceClient() ?? (await createClient());
    const { data, error } = await client.from("hub_profiles").select("*, user_app_permissions(*)").order("full_name");
    if (error) return [];
    return ((data ?? []) as ProfileRow[]).map(mapProfile);
  }
  return withDb((db) => db.users.map(toPublic).sort((a, b) => a.fullName.localeCompare(b.fullName)));
}

function passwordMailer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createAuthClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "implicit",
    },
  });
}

async function applyPasswordFromSession(accessToken: string, refreshToken: string, password: string, meta: RequestMeta) {
  const supabase = passwordMailer();
  if (!supabase) return { ok: false as const, error: "This reset link is no longer valid." };
  const session = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (session.error || !session.data.user) return { ok: false as const, error: "This reset link is no longer valid." };
  const updated = await supabase.auth.updateUser({ password });
  if (updated.error || !updated.data.user) return { ok: false as const, error: "The password could not be changed." };
  await writeAudit({
    userId: updated.data.user.id,
    email: updated.data.user.email ?? null,
    action: "password_changed",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  await supabase.auth.signOut({ scope: "global" });
  return { ok: true as const };
}

function alreadyRegistered(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  if (error.code === "email_exists") return true;
  return /already been registered|already exists/i.test(error.message ?? "");
}

async function authUserIdByEmail(admin: NonNullable<ReturnType<typeof serviceClient>>, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const listed = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (listed.error) return null;
    const found = listed.data.users.find((user) => user.email?.toLowerCase() === email);
    if (found?.id) return found.id;
    if (listed.data.users.length < 200) return null;
  }
  return null;
}

async function mintInvitedUser(admin: NonNullable<ReturnType<typeof serviceClient>>) {
  const invited = await admin.auth.admin.generateLink({
    type: "invite",
    email: FIRST_SUPER_ADMIN_EMAIL,
    options: { redirectTo: PASSWORD_SETUP_REDIRECT },
  });
  if (invited.data?.properties) {
    invited.data.properties.action_link = "";
    invited.data.properties.email_otp = "";
    invited.data.properties.hashed_token = "";
  }
  const id = invited.data?.user?.id;
  if (id) return { id, minted: true as const };
  if (!alreadyRegistered(invited.error)) return { error: "The account could not be filed." as const };
  const existing = await authUserIdByEmail(admin, FIRST_SUPER_ADMIN_EMAIL);
  if (!existing) return { error: "The account could not be filed." as const };
  return { id: existing, minted: false as const };
}

async function sendPasswordSetupEmail() {
  const mailer = passwordMailer();
  if (!mailer) return false;
  const sent = await mailer.auth.resetPasswordForEmail(FIRST_SUPER_ADMIN_EMAIL, { redirectTo: PASSWORD_SETUP_REDIRECT });
  return !sent.error;
}

export async function bootstrapFirstSuperAdmin(meta: RequestMeta) {
  if (!isLiveSupabase()) {
    return { ok: false as const, status: 503, error: "Live Supabase is not configured on this deployment." };
  }
  const admin = serviceClient();
  if (!admin) {
    return {
      ok: false as const,
      status: 503,
      error: "The service role key is not on this deployment. Redeploy after it is set in the host environment.",
    };
  }

  const existingAdmins = await admin.from("hub_profiles").select("id").eq("role", "super_admin").limit(1);
  if (existingAdmins.error) {
    if (schemaMissing(existingAdmins.error)) {
      return { ok: false as const, status: 503, error: "The security schema is not installed yet." };
    }
    return { ok: false as const, status: 500, error: "The desk could not be checked." };
  }
  if ((existingAdmins.data ?? []).length > 0) {
    return { ok: false as const, status: 409, error: "A super admin already exists." };
  }

  const filed = await admin.from("hub_profiles").select("id").eq("email", FIRST_SUPER_ADMIN_EMAIL).maybeSingle();
  if (filed.error) return { ok: false as const, status: 500, error: "The desk could not be checked." };
  if (filed.data) return { ok: false as const, status: 409, error: "That account cannot be created." };

  const minted = await mintInvitedUser(admin);
  if ("error" in minted) return { ok: false as const, status: 500, error: minted.error };
  const { id } = minted;

  const confirmed = await admin.auth.admin.updateUserById(id, { email_confirm: true });
  if (confirmed.error) {
    if (minted.minted) await admin.auth.admin.deleteUser(id);
    return { ok: false as const, status: 500, error: "The account could not be filed." };
  }

  const profile = await admin.from("hub_profiles").insert({
    id,
    email: FIRST_SUPER_ADMIN_EMAIL,
    role: "super_admin",
    status: "active",
  });
  if (profile.error) {
    const winner = await admin.from("hub_profiles").select("role").eq("id", id).maybeSingle();
    if (winner.data?.role === "super_admin") {
      return { ok: false as const, status: 409, error: "A super admin already exists." };
    }
    if (minted.minted) await admin.auth.admin.deleteUser(id);
    return { ok: false as const, status: 500, error: "The account could not be filed." };
  }

  const perms = await admin.from("user_app_permissions").insert({
    user_id: id,
    ...FIRST_SUPER_ADMIN_PERMISSIONS,
    updated_by: id,
    updated_at: new Date().toISOString(),
  });
  if (perms.error) {
    const row = await admin.from("user_app_permissions").select("user_id").eq("user_id", id).maybeSingle();
    if (row.data) return { ok: false as const, status: 409, error: "A super admin already exists." };
    if (minted.minted) await admin.auth.admin.deleteUser(id);
    else await admin.from("hub_profiles").delete().eq("id", id);
    return { ok: false as const, status: 500, error: "The account could not be filed." };
  }

  const emailSent = await sendPasswordSetupEmail();
  await writeAudit({
    userId: id,
    email: FIRST_SUPER_ADMIN_EMAIL,
    action: "user_created",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  if (!emailSent) {
    return {
      ok: false as const,
      status: 502,
      emailSent: false as const,
      error: "The account is filed, but the password email was not sent. Request a reset from the sign-in desk.",
    };
  }
  return { ok: true as const, emailSent: true as const };
}

export async function createAccount(
  actor: PublicUser,
  input: { fullName: string; email: string; password: string; role: Role; permissions: Permissions },
  meta: RequestMeta,
) {
  if (!assessPassword(input.password).ok) {
    return { ok: false as const, error: "Temporary password does not meet the policy." };
  }
  if (isLiveSupabase()) {
    const admin = serviceClient();
    if (!admin) return { ok: false as const, error: SERVICE_ROLE_REQUIRED };
    const created = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.fullName },
    });
    if (created.error || !created.data.user) {
      const message = /already|registered|exists/i.test(created.error?.message ?? "")
        ? "An account with that email already exists."
        : "The account could not be filed.";
      return { ok: false as const, error: message };
    }
    const id = created.data.user.id;
    const profile = await admin.from("hub_profiles").insert({
      id,
      email: input.email,
      full_name: input.fullName,
      role: input.role,
      status: "pending",
    });
    if (profile.error) {
      await admin.auth.admin.deleteUser(id);
      return { ok: false as const, error: "The account could not be filed." };
    }
    const perms = await admin.from("user_app_permissions").insert({
      user_id: id,
      ...input.permissions,
      updated_by: actor.id,
      updated_at: new Date().toISOString(),
    });
    if (perms.error) {
      await admin.auth.admin.deleteUser(id);
      return { ok: false as const, error: "The account could not be filed." };
    }
    await writeAudit({ userId: id, email: input.email, action: "user_created", ip: meta.ip, userAgent: meta.userAgent });
    return { ok: true as const };
  }

  const created = await withDb((db) => {
    if (db.users.some((item) => item.email === input.email)) return "exists" as const;
    const id = randomUUID();
    db.users.push({
      id,
      email: input.email,
      passwordHash: hashPassword(input.password),
      fullName: input.fullName,
      phone: "",
      role: input.role,
      status: "pending",
      failedLoginAttempts: 0,
      lockedUntil: null,
      mfaEnabled: false,
      mfaSecret: null,
      mfaPendingSecret: null,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      permissions: { ...input.permissions },
      permissionsUpdatedBy: actor.id,
      permissionsUpdatedAt: new Date().toISOString(),
    });
    pushAudit(db, {
      userId: id,
      email: input.email,
      action: "user_created",
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return "ok" as const;
  });
  if (created === "exists") return { ok: false as const, error: "An account with that email already exists." };
  return { ok: true as const };
}

export async function updateAccount(
  actor: PublicUser,
  userId: string,
  patch: { status?: Status; unlock?: boolean; permissions?: Partial<Permissions> },
  meta: RequestMeta,
) {
  if (isLiveSupabase()) {
    const admin = serviceClient();
    if (!admin) return { ok: false as const, error: SERVICE_ROLE_REQUIRED };
    if (patch.unlock) {
      await admin.from("hub_profiles").update({ failed_login_attempts: 0, locked_until: null }).eq("id", userId);
    }
    if (patch.status) {
      await admin.from("hub_profiles").update({ status: patch.status }).eq("id", userId);
    }
    if (patch.permissions && Object.keys(patch.permissions).length) {
      const { data: current } = await admin.from("user_app_permissions").select("*").eq("user_id", userId).maybeSingle();
      const next = { ...(current ?? {}), ...patch.permissions, updated_by: actor.id, updated_at: new Date().toISOString() };
      if (current) await admin.from("user_app_permissions").update(next).eq("user_id", userId);
      else await admin.from("user_app_permissions").insert({ user_id: userId, ...EMPTY_PERMISSIONS, ...next });
      const { data: profile } = await admin.from("hub_profiles").select("email").eq("id", userId).maybeSingle();
      for (const key of Object.keys(patch.permissions) as (keyof Permissions)[]) {
        const app = APP_CATALOG.find((item) => item.permission === key);
        await writeAudit({
          userId,
          email: profile?.email ?? null,
          action: "permission_changed",
          targetApp: app?.key ?? key,
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
      }
    }
    return { ok: true as const };
  }

  const found = await withDb((db) => {
    const row = db.users.find((item) => item.id === userId);
    if (!row) return false;
    if (patch.unlock) {
      row.lockedUntil = null;
      row.failedLoginAttempts = 0;
    }
    if (patch.status) row.status = patch.status;
    if (patch.permissions) {
      for (const key of Object.keys(patch.permissions) as (keyof Permissions)[]) {
        const value = patch.permissions[key];
        if (typeof value !== "boolean" || row.permissions[key] === value) continue;
        row.permissions[key] = value;
        const app = APP_CATALOG.find((item) => item.permission === key);
        pushAudit(db, {
          userId: row.id,
          email: row.email,
          action: "permission_changed",
          ipAddress: meta.ip,
          userAgent: meta.userAgent,
          targetApp: app?.key ?? key,
        });
      }
      row.permissionsUpdatedBy = actor.id;
      row.permissionsUpdatedAt = new Date().toISOString();
    }
    return true;
  });
  if (!found) return { ok: false as const, error: "Account not found." };
  return { ok: true as const };
}

function mapAudit(row: {
  id: string;
  user_id: string | null;
  email: string | null;
  action: AuditAction;
  ip_address: string | null;
  user_agent: string | null;
  target_app: string | null;
  created_at: string;
}): AuditRecord {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    action: row.action,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    targetApp: row.target_app,
    createdAt: row.created_at,
  };
}

export async function listAudits(): Promise<AuditRecord[]> {
  if (isLiveSupabase()) {
    const client = serviceClient() ?? (await createClient());
    const { data, error } = await client.from("security_audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) return [];
    return (data ?? []).map((row) => mapAudit(row as Parameters<typeof mapAudit>[0]));
  }
  return withDb((db) => db.audits.slice(0, 200));
}

export async function listMyAudits(userId: string): Promise<AuditRecord[]> {
  if (isLiveSupabase()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("security_audit_logs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12);
    return (data ?? []).map((row) => mapAudit(row as Parameters<typeof mapAudit>[0]));
  }
  return withDb((db) => db.audits.filter((item) => item.userId === userId).slice(0, 12));
}

const ALERT_ACTIONS: AuditAction[] = ["login_failed", "account_locked", "unauthorized_app_attempt", "permission_changed"];

export async function getAlerts(user: PublicUser): Promise<Alert[]> {
  if (user.role === "super_admin") {
    const [users, audits] = await Promise.all([listUsers(), listAudits()]);
    const alerts: Alert[] = [];
    const pending = users.filter((item) => item.status === "pending");
    if (pending.length) {
      alerts.push({
        id: "pending",
        title: pending.length === 1 ? "1 account awaiting approval" : `${pending.length} accounts awaiting approval`,
        detail: pending.map((item) => item.fullName).join(", "),
        href: "/admin/security",
      });
    }
    for (const audit of audits.filter((item) => ALERT_ACTIONS.includes(item.action)).slice(0, 6)) {
      alerts.push({
        id: audit.id,
        title: audit.action.replaceAll("_", " "),
        detail: [audit.email, audit.ipAddress].filter(Boolean).join(" · "),
        href: "/admin/security",
        createdAt: audit.createdAt,
      });
    }
    return alerts;
  }
  const mine = await listMyAudits(user.id);
  return mine
    .filter((item) => item.action === "login_failed" || item.action === "account_locked")
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      title: item.action === "account_locked" ? "Account locked" : "Failed sign-in",
      detail: [formatQuiet(item.createdAt), item.ipAddress].filter(Boolean).join(" · "),
      createdAt: item.createdAt,
    }));
}

function formatQuiet(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export async function metaFromHeaders() {
  const { headers } = await import("next/headers");
  return requestMeta(await headers());
}

export function isAuditAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(value);
}
