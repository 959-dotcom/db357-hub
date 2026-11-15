export const ROLES = ["super_admin", "admin", "staff", "agent"] as const;
export const STATUSES = ["pending", "active", "suspended"] as const;
export const AUDIT_ACTIONS = [
  "login_success",
  "login_failed",
  "password_changed",
  "password_reset_requested",
  "mfa_enabled",
  "unauthorized_app_attempt",
  "permission_changed",
  "account_locked",
  "user_created",
] as const;

export type Role = (typeof ROLES)[number];
export type Status = (typeof STATUSES)[number];
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type Permissions = {
  can_access_land: boolean;
  can_access_dmck: boolean;
  can_access_coupon: boolean;
  can_access_loan: boolean;
  can_access_aircon: boolean;
};

export type PublicUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: Role;
  status: Status;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  lockedUntil: string | null;
  failedLoginAttempts: number;
  permissions: Permissions;
};

export type AuditRecord = {
  id: string;
  userId: string | null;
  email: string | null;
  action: AuditAction;
  ipAddress: string | null;
  userAgent: string | null;
  targetApp: string | null;
  createdAt: string;
};

export type Alert = {
  id: string;
  title: string;
  detail: string;
  href?: string;
  createdAt?: string;
};

export type Gate =
  | { kind: "anon" }
  | { kind: "stale" }
  | { kind: "mfa" }
  | { kind: "inactive" }
  | { kind: "user"; user: PublicUser };

export type LoginResult =
  | { ok: true }
  | { ok: false; mfaRequired: true; devCode?: string }
  | { ok: false; error: string; code?: string; lockedUntil?: string };

export const EMPTY_PERMISSIONS: Permissions = {
  can_access_land: false,
  can_access_dmck: false,
  can_access_coupon: false,
  can_access_loan: false,
  can_access_aircon: false,
};
