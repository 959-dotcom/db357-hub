function present(name: string) {
  const value = process.env[name];
  return Boolean(value && value.trim());
}

/** Live mode needs the anon key and the service role. Lockout and audit writes must not run as the user. */
export function isLiveSupabase() {
  return (
    present("NEXT_PUBLIC_SUPABASE_URL") &&
    present("NEXT_PUBLIC_SUPABASE_ANON_KEY") &&
    present("SUPABASE_SERVICE_ROLE_KEY")
  );
}
