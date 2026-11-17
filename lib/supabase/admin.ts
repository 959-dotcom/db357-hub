import "server-only";
import { createClient } from "@supabase/supabase-js";
import { readApiKey, readSupabaseUrl } from "@/lib/config";

/** Service role. Server only. Used for lockout counters, audit inserts, and admin provisioning. */
export function createAdminClient() {
  const url = readSupabaseUrl();
  const key = readApiKey("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Supabase service role is not configured.");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
