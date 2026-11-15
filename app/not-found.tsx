import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";

export default function NotFound() {
  return (
    <AuthFrame>
      <section className="surface relative px-6 py-10 text-center shadow-desk">
        <div className="hairline absolute left-8 right-8 top-0" />
        <p className="text-6xl font-light tabular-nums text-goldsoft">404</p>
        <h2 className="mt-4 text-2xl font-medium">This page is not on the desk</h2>
        <Link href="/dashboard" className="quiet-link mt-6 inline-block text-sm">
          Return to the hub
        </Link>
      </section>
    </AuthFrame>
  );
}
