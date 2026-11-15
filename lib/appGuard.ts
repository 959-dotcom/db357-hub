import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APP_CATALOG, type AppKey } from "@/lib/apps";
import { logUnauthorized } from "@/lib/auth-service";
import { requestMeta } from "@/lib/request-meta";
import { getGate } from "@/lib/session";

/**
 * Copy this file into a DB357 desk that shares the hub Supabase project.
 * Set NEXT_PUBLIC_HUB_ORIGIN=https://db357.com on that desk so denials return here.
 *
 * The hub session cookie is:
 * Domain=.db357.com; Secure; HttpOnly; SameSite=Lax
 *
 * A top-level navigation to a sibling host sends that cookie. The desk can treat it
 * as a session only when it uses this same Supabase project (same JWT secret and
 * the same Supabase SSR cookie names). A separate Supabase project cannot validate
 * it. This guard does not mint a token, query string, or second session for that case.
 *
 * Unauthenticated visitors go to the hub sign-in. An active session without this
 * desk's flag is audited as unauthorized_app_attempt and sent to /access-denied.
 */
function hubPath(path: "/login" | "/access-denied") {
  const origin = process.env.NEXT_PUBLIC_HUB_ORIGIN?.replace(/\/$/, "");
  return origin ? `${origin}${path}` : path;
}

export async function guardApp(appKey: AppKey) {
  const app = APP_CATALOG.find((item) => item.key === appKey);
  const gate = await getGate();
  if (gate.kind === "stale") redirect("/api/auth/logout");
  if (gate.kind === "mfa") redirect(hubPath("/login") + "?mfa=1");
  if (gate.kind === "anon") redirect(hubPath("/login"));
  if (gate.kind === "inactive" || !app) redirect(hubPath("/access-denied"));
  if (!gate.user.permissions[app.permission]) {
    const meta = requestMeta(await headers());
    await logUnauthorized(gate.user, app.key, meta);
    redirect(hubPath("/access-denied"));
  }
}
