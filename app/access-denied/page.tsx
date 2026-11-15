import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { getGate } from "@/lib/session";

export const metadata: Metadata = { title: "Access denied" };

export default async function AccessDeniedPage() {
  const gate = await getGate();
  const signedIn = gate.kind === "user";
  return (
    <AuthFrame>
      <section className="surface relative px-6 py-10 text-center shadow-desk sm:px-8">
        <div className="hairline absolute left-8 right-8 top-0" />
        <p className="text-6xl font-light tabular-nums tracking-tight text-goldsoft">403</p>
        <h2 className="mt-4 text-2xl font-medium">Access is not granted</h2>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-mute">
          This desk is not on your authority. If you need it, ask the administrator.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4 text-sm">
          {signedIn ? (
            <Link href="/dashboard" className="quiet-link">
              Return to the hub
            </Link>
          ) : (
            <Link href="/login" className="quiet-link">
              Sign in
            </Link>
          )}
          {gate.kind !== "anon" ? (
            <a href="/api/auth/logout" className="text-mute">
              Sign out
            </a>
          ) : null}
        </div>
      </section>
    </AuthFrame>
  );
}
