import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthFrame, PrivateBadge } from "@/components/auth-frame";
import { getGate, mockMfaPending } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mfa?: string }> }) {
  const params = await searchParams;
  const gate = await getGate();
  if (gate.kind === "user") redirect("/dashboard");
  if (gate.kind === "stale") redirect("/api/auth/logout");
  const initialMfa = gate.kind === "mfa" || params.mfa === "1" || (await mockMfaPending());
  return (
    <AuthFrame>
      <LoginForm initialMfa={initialMfa} />
      <PrivateBadge />
    </AuthFrame>
  );
}
