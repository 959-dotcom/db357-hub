function raw(name: string) {
  return process.env[name] ?? "";
}

/** API keys are pasted. A space or line break must not be sent as part of the key. */
export function readApiKey(name: string) {
  return raw(name).replace(/\s+/g, "");
}

export function readSupabaseUrl() {
  return raw("NEXT_PUBLIC_SUPABASE_URL").trim();
}

/** The public project URL and anon key select the real desk. Missing either one keeps the local mock. */
export function isLiveSupabase() {
  return Boolean(readSupabaseUrl() && readApiKey("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
}

/** Lockout counters, audit inserts, and provisioning. Never fall back to the user JWT for these. */
export function hasServiceRole() {
  return isLiveSupabase() && Boolean(readApiKey("SUPABASE_SERVICE_ROLE_KEY"));
}
