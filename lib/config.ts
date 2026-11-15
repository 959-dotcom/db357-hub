function present(name: string) {
  const value = process.env[name];
  return Boolean(value && value.trim());
}

/** The public project URL and anon key select the real desk. Missing either one keeps the local mock. */
export function isLiveSupabase() {
  return present("NEXT_PUBLIC_SUPABASE_URL") && present("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

/** Lockout counters, audit inserts, and provisioning. Never fall back to the user JWT for these. */
export function hasServiceRole() {
  return isLiveSupabase() && present("SUPABASE_SERVICE_ROLE_KEY");
}
