import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isLiveSupabase } from "@/lib/config";
import { MFA_COOKIE, SESSION_COOKIE, readSessionToken, readTicket } from "@/lib/cookies";
import { toPublic, withDb } from "@/lib/mock-store";
import { mapProfile, type ProfileRow } from "@/lib/profile-map";
import { createClient } from "@/lib/supabase/server";
import type { Gate, PublicUser } from "@/lib/types";

async function liveGate(): Promise<Gate> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { kind: "anon" };
  const { data: profile } = await supabase
    .from("hub_profiles")
    .select("*, user_app_permissions(*)")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile) return { kind: "inactive" };
  const row = profile as ProfileRow;
  if (row.status !== "active") return { kind: "inactive" };
  if (row.mfa_enabled) {
    const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal.data?.currentLevel !== "aal2") return { kind: "mfa" };
  }
  return { kind: "user", user: mapProfile(row) };
}

export async function getGate(): Promise<Gate> {
  if (isLiveSupabase()) return liveGate();
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  const payload = await readSessionToken(raw);
  if (!payload) return raw ? { kind: "stale" } : { kind: "anon" };
  const user = await withDb((db) => {
    const session = db.sessions.find((item) => item.id === payload.sid && item.userId === payload.uid && !item.revokedAt);
    if (!session) return null;
    const row = db.users.find((item) => item.id === payload.uid);
    return row ? toPublic(row) : null;
  });
  if (!user) return { kind: "stale" };
  if (user.status !== "active") return { kind: "inactive" };
  return { kind: "user", user };
}

export async function mockMfaPending() {
  if (isLiveSupabase()) return false;
  const jar = await cookies();
  return Boolean(await readTicket(jar.get(MFA_COOKIE)?.value));
}

export async function requireUser(): Promise<PublicUser> {
  const gate = await getGate();
  if (gate.kind === "stale") redirect("/api/auth/logout");
  if (gate.kind === "mfa") redirect("/login?mfa=1");
  if (gate.kind === "inactive") redirect("/access-denied");
  if (gate.kind !== "user") redirect("/login");
  return gate.user;
}

export async function currentUser() {
  const gate = await getGate();
  return gate.kind === "user" ? gate.user : null;
}
