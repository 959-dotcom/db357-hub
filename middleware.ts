import { NextResponse, type NextRequest } from "next/server";
import { isLiveSupabase } from "@/lib/config";
import { SESSION_COOKIE, readSessionToken } from "@/lib/cookies";
import { openLiveSession } from "@/lib/supabase/middleware";

const PUBLIC_PAGES = new Set(["/login", "/forgot-password", "/reset-password", "/access-denied"]);
const PUBLIC_API = new Set([
  "/api/auth/login",
  "/api/auth/forgot",
  "/api/auth/reset",
  "/api/auth/logout",
  "/api/auth/mfa/hint",
  "/api/admin/bootstrap",
]);

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/icon" || path.startsWith("/icon/")) return NextResponse.next();
  if (isLiveSupabase()) return live(request);
  return mock(request);
}

async function mock(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const payload = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const authed = Boolean(payload);

  if (path.startsWith("/api/")) {
    if (!PUBLIC_API.has(path) && !authed) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!authed && !PUBLIC_PAGES.has(path)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (authed && (path === "/login" || path === "/forgot-password")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

async function live(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const { supabase, response, user, carry } = await openLiveSession(request);
  if (PUBLIC_API.has(path)) return response;

  let status: string | null = null;
  let needsMfa = false;
  if (user) {
    const { data: profile } = await supabase
      .from("hub_profiles")
      .select("status, mfa_enabled")
      .eq("id", user.id)
      .maybeSingle();
    status = (profile?.status as string | undefined) ?? null;
    if (profile?.mfa_enabled) {
      const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      needsMfa = aal.data?.currentLevel !== "aal2";
    }
  }

  if (path.startsWith("/api/")) {
    if (!user) return carry(NextResponse.json({ error: "Sign in required." }, { status: 401 }));
    if (needsMfa) return carry(NextResponse.json({ error: "Authenticator required.", mfaRequired: true }, { status: 401 }));
    if (status !== "active") return carry(NextResponse.json({ error: "Account is not active." }, { status: 403 }));
    return response;
  }

  if (user && status && status !== "active" && path !== "/access-denied" && path !== "/login") {
    return carry(NextResponse.redirect(new URL("/access-denied", request.url)));
  }
  if (user && needsMfa && path !== "/login") {
    return carry(NextResponse.redirect(new URL("/login?mfa=1", request.url)));
  }
  if (!user && !PUBLIC_PAGES.has(path)) {
    return carry(NextResponse.redirect(new URL("/login", request.url)));
  }
  if (user && status === "active" && !needsMfa && (path === "/login" || path === "/forgot-password")) {
    return carry(NextResponse.redirect(new URL("/dashboard", request.url)));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
