import "server-only";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { hashPassword } from "@/lib/password-hash";
import { generateSecret } from "@/lib/totp";
import {
  EMPTY_PERMISSIONS,
  type AuditAction,
  type AuditRecord,
  type Permissions,
  type PublicUser,
  type Role,
  type Status,
} from "@/lib/types";

const FILE = path.join(process.cwd(), ".data", "hub-mock.json");
const VERSION = 1;

export type MockUser = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone: string;
  role: Role;
  status: Status;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  mfaEnabled: boolean;
  mfaSecret: string | null;
  mfaPendingSecret: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  permissions: Permissions;
  permissionsUpdatedBy: string | null;
  permissionsUpdatedAt: string;
};

export type MockSession = {
  id: string;
  userId: string;
  ip: string;
  userAgent: string;
  createdAt: string;
  revokedAt: string | null;
};

type ResetToken = {
  hash: string;
  userId: string;
  expiresAt: string;
};

export type MockDb = {
  version: number;
  dummyHash: string;
  users: MockUser[];
  sessions: MockSession[];
  audits: AuditRecord[];
  resetTokens: ResetToken[];
};

let queue: Promise<unknown> = Promise.resolve();

function seed(): MockDb {
  const now = Date.now();
  const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();
  const hour = 60 * 60 * 1000;
  const aurelia = "11111111-1111-4111-8111-111111111111";

  const user = (
    partial: Omit<MockUser, "passwordHash" | "failedLoginAttempts" | "mfaPendingSecret" | "permissionsUpdatedAt" | "createdAt" | "lastLoginAt"> & {
      password: string;
      failedLoginAttempts?: number;
      lastLoginAt?: string | null;
      createdAt?: string;
    },
  ): MockUser => ({
    id: partial.id,
    email: partial.email,
    passwordHash: hashPassword(partial.password),
    fullName: partial.fullName,
    phone: partial.phone,
    role: partial.role,
    status: partial.status,
    failedLoginAttempts: partial.failedLoginAttempts ?? 0,
    lockedUntil: partial.lockedUntil,
    mfaEnabled: partial.mfaEnabled,
    mfaSecret: partial.mfaSecret,
    mfaPendingSecret: null,
    lastLoginAt: partial.lastLoginAt ?? null,
    createdAt: partial.createdAt ?? iso(-14 * 24 * hour),
    permissions: partial.permissions,
    permissionsUpdatedBy: partial.permissionsUpdatedBy,
    permissionsUpdatedAt: iso(-2 * 24 * hour),
  });

  const elenaSecret = generateSecret();
  const users: MockUser[] = [
    user({
      id: aurelia,
      email: "aurelia.voss@db357.com",
      password: "Aurelia#Vault10",
      fullName: "Aurelia Voss",
      phone: "+66 81 000 0357",
      role: "super_admin",
      status: "active",
      lockedUntil: null,
      mfaEnabled: false,
      mfaSecret: null,
      permissions: {
        can_access_land: true,
        can_access_dmck: true,
        can_access_coupon: true,
        can_access_loan: true,
        can_access_aircon: true,
      },
      permissionsUpdatedBy: aurelia,
      lastLoginAt: iso(-2 * hour),
    }),
    user({
      id: "22222222-2222-4222-8222-222222222222",
      email: "marcus.chen@db357.com",
      password: "Marcus#Ledger10",
      fullName: "Marcus Chen",
      phone: "+66 89 220 1680",
      role: "staff",
      status: "active",
      lockedUntil: null,
      mfaEnabled: false,
      mfaSecret: null,
      permissions: {
        ...EMPTY_PERMISSIONS,
        can_access_land: true,
        can_access_loan: true,
      },
      permissionsUpdatedBy: aurelia,
      lastLoginAt: iso(-26 * hour),
    }),
    user({
      id: "33333333-3333-4333-8333-333333333333",
      email: "nia.okonkwo@db357.com",
      password: "Nia#Coupon10",
      fullName: "Nia Okonkwo",
      phone: "+66 62 441 0091",
      role: "agent",
      status: "active",
      lockedUntil: null,
      mfaEnabled: false,
      mfaSecret: null,
      permissions: {
        ...EMPTY_PERMISSIONS,
        can_access_dmck: true,
        can_access_coupon: true,
      },
      permissionsUpdatedBy: aurelia,
    }),
    user({
      id: "44444444-4444-4444-8444-444444444444",
      email: "elena.marche@db357.com",
      password: "Elena#Factor10",
      fullName: "Elena Marche",
      phone: "+66 81 773 4410",
      role: "admin",
      status: "active",
      lockedUntil: null,
      mfaEnabled: true,
      mfaSecret: elenaSecret,
      permissions: {
        ...EMPTY_PERMISSIONS,
        can_access_loan: true,
        can_access_aircon: true,
      },
      permissionsUpdatedBy: aurelia,
    }),
    user({
      id: "55555555-5555-4555-8555-555555555555",
      email: "held.account@db357.com",
      password: "Held#Account10",
      fullName: "Held Account",
      phone: "",
      role: "staff",
      status: "active",
      failedLoginAttempts: 5,
      lockedUntil: iso(30 * 60 * 1000),
      mfaEnabled: false,
      mfaSecret: null,
      permissions: { ...EMPTY_PERMISSIONS, can_access_land: true },
      permissionsUpdatedBy: aurelia,
    }),
    user({
      id: "66666666-6666-4666-8666-666666666666",
      email: "iris.vale@db357.com",
      password: "Iris#Window10",
      fullName: "Iris Vale",
      phone: "+66 90 118 2204",
      role: "agent",
      status: "active",
      lockedUntil: null,
      mfaEnabled: false,
      mfaSecret: null,
      permissions: { ...EMPTY_PERMISSIONS, can_access_aircon: true },
      permissionsUpdatedBy: aurelia,
    }),
    user({
      id: "77777777-7777-4777-8777-777777777777",
      email: "julian.park@db357.com",
      password: "Julian#Pending10",
      fullName: "Julian Park",
      phone: "+66 86 300 1944",
      role: "staff",
      status: "pending",
      lockedUntil: null,
      mfaEnabled: false,
      mfaSecret: null,
      permissions: { ...EMPTY_PERMISSIONS },
      permissionsUpdatedBy: aurelia,
      createdAt: iso(-5 * hour),
    }),
    user({
      id: "88888888-8888-4888-8888-888888888888",
      email: "clara.stein@db357.com",
      password: "Clara#Quiet10",
      fullName: "Clara Stein",
      phone: "",
      role: "staff",
      status: "active",
      lockedUntil: null,
      mfaEnabled: false,
      mfaSecret: null,
      permissions: { ...EMPTY_PERMISSIONS },
      permissionsUpdatedBy: aurelia,
    }),
  ];

  const audits: AuditRecord[] = [
    {
      id: randomUUID(),
      userId: aurelia,
      email: "aurelia.voss@db357.com",
      action: "login_success",
      ipAddress: "203.0.113.10",
      userAgent: "seed",
      targetApp: null,
      createdAt: iso(-2 * hour),
    },
    {
      id: randomUUID(),
      userId: "66666666-6666-4666-8666-666666666666",
      email: "iris.vale@db357.com",
      action: "login_failed",
      ipAddress: "203.0.113.44",
      userAgent: "seed",
      targetApp: null,
      createdAt: iso(-70 * 60 * 1000),
    },
    {
      id: randomUUID(),
      userId: "77777777-7777-4777-8777-777777777777",
      email: "julian.park@db357.com",
      action: "user_created",
      ipAddress: "203.0.113.10",
      userAgent: "seed",
      targetApp: null,
      createdAt: iso(-5 * hour),
    },
  ];

  return {
    version: VERSION,
    dummyHash: hashPassword(randomUUID()),
    users,
    sessions: [],
    audits,
    resetTokens: [],
  };
}

function load(): MockDb {
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    const parsed = JSON.parse(raw) as MockDb;
    if (parsed.version !== VERSION || !Array.isArray(parsed.users)) return seed();
    return parsed;
  } catch {
    return seed();
  }
}

function save(db: MockDb) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

export function withDb<T>(fn: (db: MockDb) => T): Promise<T> {
  const run = queue.then(() => {
    const db = load();
    const result = fn(db);
    save(db);
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function toPublic(user: MockUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    status: user.status,
    mfaEnabled: user.mfaEnabled,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    lockedUntil: user.lockedUntil,
    failedLoginAttempts: user.failedLoginAttempts,
    permissions: { ...user.permissions },
  };
}

export function pushAudit(
  db: MockDb,
  entry: {
    userId: string | null;
    email: string | null;
    action: AuditAction;
    ipAddress: string | null;
    userAgent: string | null;
    targetApp?: string | null;
  },
) {
  db.audits.unshift({
    id: randomUUID(),
    userId: entry.userId,
    email: entry.email,
    action: entry.action,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
    targetApp: entry.targetApp ?? null,
    createdAt: new Date().toISOString(),
  });
  if (db.audits.length > 500) db.audits.length = 500;
}
