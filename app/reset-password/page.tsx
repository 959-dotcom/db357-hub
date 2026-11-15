import type { Metadata } from "next";
import { AuthFrame, PrivateBadge } from "@/components/auth-frame";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; code?: string; token_hash?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthFrame>
      <ResetForm token={params.token} code={params.code} tokenHash={params.token_hash} />
      <PrivateBadge />
    </AuthFrame>
  );
}
