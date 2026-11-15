import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { hubCookieOptions } from "@/lib/cookies";

/**
 * Supabase SSR session cookie, when the request host is db357.com:
 * Domain=.db357.com; Secure; HttpOnly; SameSite=Lax
 *
 * The browser client is intentionally unused. HttpOnly means page scripts cannot read the session.
 * Middleware refreshes the cookie. All auth calls go through this server client.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase public env is not configured.");
  }
  const jar = await cookies();
  const headerList = await headers();

  return createServerClient(url, key, {
    cookieOptions: hubCookieOptions(headerList.get("host"), headerList.get("x-forwarded-proto")),
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            jar.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. Middleware refreshes the session.
        }
      },
    },
  });
}
