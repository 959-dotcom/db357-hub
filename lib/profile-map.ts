import { EMPTY_PERMISSIONS, type Permissions, type PublicUser, type Role, type Status } from "@/lib/types";

export type PermissionRow = {
  can_access_land?: boolean | null;
  can_access_dmck?: boolean | null;
  can_access_coupon?: boolean | null;
  can_access_loan?: boolean | null;
  can_access_aircon?: boolean | null;
};

export type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: Role;
  status: Status;
  failed_login_attempts: number;
  locked_until: string | null;
  mfa_enabled: boolean;
  last_login_at: string | null;
  created_at: string;
  user_app_permissions?: PermissionRow | PermissionRow[] | null;
};

export function readPermissions(row: PermissionRow | PermissionRow[] | null | undefined): Permissions {
  const source = Array.isArray(row) ? row[0] : row;
  return {
    can_access_land: Boolean(source?.can_access_land),
    can_access_dmck: Boolean(source?.can_access_dmck),
    can_access_coupon: Boolean(source?.can_access_coupon),
    can_access_loan: Boolean(source?.can_access_loan),
    can_access_aircon: Boolean(source?.can_access_aircon),
  };
}

export function mapProfile(row: ProfileRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name?.trim() || row.email,
    phone: row.phone ?? "",
    role: row.role,
    status: row.status,
    mfaEnabled: row.mfa_enabled,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    lockedUntil: row.locked_until,
    failedLoginAttempts: row.failed_login_attempts ?? 0,
    permissions: row.user_app_permissions ? readPermissions(row.user_app_permissions) : { ...EMPTY_PERMISSIONS },
  };
}
