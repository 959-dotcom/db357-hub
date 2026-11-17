import { EMPTY_PERMISSIONS, ROLES, STATUSES, type Permissions, type Role, type Status } from "@/lib/types";

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && STATUSES.includes(value as Status);
}

export function cleanName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 80) return null;
  return name;
}

export function cleanPhone(value: unknown) {
  if (typeof value !== "string") return null;
  const phone = value.trim();
  if (phone.length > 24) return null;
  if (phone && !/^[0-9+()\-\s]+$/.test(phone)) return null;
  return phone;
}

export function cleanEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) return null;
  return email;
}

export function cleanPermissionPatch(value: unknown): Partial<Permissions> | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const next: Partial<Permissions> = {};
  for (const key of Object.keys(EMPTY_PERMISSIONS) as (keyof Permissions)[]) {
    if (source[key] === undefined) continue;
    if (typeof source[key] !== "boolean") return null;
    next[key] = source[key];
  }
  return next;
}

export function cleanPermissions(value: unknown): Permissions | null {
  const patch = cleanPermissionPatch(value);
  if (!patch) return null;
  for (const key of Object.keys(EMPTY_PERMISSIONS) as (keyof Permissions)[]) {
    if (typeof patch[key] !== "boolean") return null;
  }
  return patch as Permissions;
}
