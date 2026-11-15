-- DB357 Central Hub security schema.
-- Apply in the Supabase SQL editor for the single project the hub and its desks share.
-- Lockout counters and audit inserts are written with the service role from the Next.js server.
-- Authenticated users cannot forge those writes: RLS grants no insert, and triggers reject them.

create extension if not exists pgcrypto;

create table if not exists public.hub_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  phone text,
  avatar_url text,
  role text not null default 'staff' check (role in ('super_admin', 'admin', 'staff', 'agent')),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  failed_login_attempts integer not null default 0 check (failed_login_attempts >= 0),
  locked_until timestamptz,
  mfa_enabled boolean not null default false,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.user_app_permissions (
  user_id uuid primary key references public.hub_profiles (id) on delete cascade,
  can_access_land boolean not null default false,
  can_access_dmck boolean not null default false,
  can_access_coupon boolean not null default false,
  can_access_loan boolean not null default false,
  can_access_aircon boolean not null default false,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.security_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.hub_profiles (id) on delete set null,
  email text,
  action text not null check (action in (
    'login_success',
    'login_failed',
    'password_changed',
    'password_reset_requested',
    'mfa_enabled',
    'unauthorized_app_attempt',
    'permission_changed',
    'account_locked',
    'user_created'
  )),
  ip_address text,
  user_agent text,
  target_app text,
  created_at timestamptz not null default now()
);

create index if not exists security_audit_logs_created_at_idx
  on public.security_audit_logs (created_at desc);
create index if not exists security_audit_logs_user_idx
  on public.security_audit_logs (user_id, created_at desc);
create index if not exists security_audit_logs_email_idx
  on public.security_audit_logs (email);

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.hub_profiles
    where id = auth.uid()
      and role = 'super_admin'
      and status = 'active'
  );
$$;

revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated;

create or replace function public.hub_profiles_guard()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'profiles are created by the service role';
  end if;

  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.failed_login_attempts is distinct from old.failed_login_attempts
     or new.locked_until is distinct from old.locked_until
     or new.mfa_enabled is distinct from old.mfa_enabled
     or new.last_login_at is distinct from old.last_login_at
     or new.created_at is distinct from old.created_at
     or new.avatar_url is distinct from old.avatar_url
  then
    raise exception 'profile field is not writable by this role';
  end if;

  return new;
end;
$$;

drop trigger if exists hub_profiles_guard on public.hub_profiles;
create trigger hub_profiles_guard
  before insert or update on public.hub_profiles
  for each row execute function public.hub_profiles_guard();

create or replace function public.hub_permissions_guard()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  raise exception 'app permissions are changed by the service role';
end;
$$;

drop trigger if exists hub_permissions_guard on public.user_app_permissions;
create trigger hub_permissions_guard
  before insert or update or delete on public.user_app_permissions
  for each row execute function public.hub_permissions_guard();

create or replace function public.hub_audit_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'audit logs are immutable';
  end if;
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  raise exception 'audit logs cannot be forged';
end;
$$;

drop trigger if exists hub_audit_guard on public.security_audit_logs;
create trigger hub_audit_guard
  before insert or update or delete on public.security_audit_logs
  for each row execute function public.hub_audit_guard();

alter table public.hub_profiles enable row level security;
alter table public.user_app_permissions enable row level security;
alter table public.security_audit_logs enable row level security;

drop policy if exists hub_profiles_select on public.hub_profiles;
create policy hub_profiles_select
  on public.hub_profiles
  for select
  to authenticated
  using (id = auth.uid() or public.is_super_admin());

drop policy if exists hub_profiles_update_own on public.hub_profiles;
create policy hub_profiles_update_own
  on public.hub_profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists user_app_permissions_select on public.user_app_permissions;
create policy user_app_permissions_select
  on public.user_app_permissions
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

drop policy if exists security_audit_logs_select on public.security_audit_logs;
create policy security_audit_logs_select
  on public.security_audit_logs
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

revoke all on table public.hub_profiles from anon, authenticated;
revoke all on table public.user_app_permissions from anon, authenticated;
revoke all on table public.security_audit_logs from anon, authenticated;

grant select, update on table public.hub_profiles to authenticated;
grant select on table public.user_app_permissions to authenticated;
grant select on table public.security_audit_logs to authenticated;

-- No insert/update grant on permissions or audit logs for authenticated.
-- No insert grant on profiles. Provisioning, lockout, and audit use the service role,
-- which bypasses RLS. Triggers still refuse authenticated writes to sensitive columns.
