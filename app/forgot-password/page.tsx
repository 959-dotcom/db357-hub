import type { Metadata } from "next";
import { AuthFrame, PrivateBadge } from "@/components/auth-frame";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthFrame>
      <ForgotForm />
      <PrivateBadge />
    </AuthFrame>
  );
}
