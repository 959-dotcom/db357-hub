import type { AuditAction, Role, Status } from "@/lib/types";

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  staff: "Staff",
  agent: "Agent",
};

export const STATUS_LABEL: Record<Status, string> = {
  pending: "Pending",
  active: "Active",
  suspended: "Suspended",
};

export const ACTION_LABEL: Record<AuditAction, string> = {
  login_success: "Signed in",
  login_failed: "Sign-in failed",
  password_changed: "Password changed",
  password_reset_requested: "Reset requested",
  mfa_enabled: "Authenticator enabled",
  unauthorized_app_attempt: "Unauthorized desk",
  permission_changed: "Permission changed",
  account_locked: "Account locked",
  user_created: "Account created",
};

export function greeting(fullName: string, now = new Date()) {
  const hour = now.getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = fullName.trim().split(/\s+/)[0] || fullName;
  return `${part}, ${first}`;
}

export function initials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "DB";
}

export function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function remainingLabel(until: string, now = Date.now()) {
  const ms = Math.max(0, new Date(until).getTime() - now);
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
