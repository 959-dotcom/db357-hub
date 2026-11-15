import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-[440px]">
        <Link href="/login" className="mb-8 flex flex-col items-center text-center">
          <BrandMark />
          <p className="mt-5 text-[11px] tracking-[0.32em] text-mute">DB357</p>
          <h1 className="mt-2 text-[28px] font-medium tracking-tight text-ivory">Central Hub</h1>
        </Link>
        {children}
      </div>
    </main>
  );
}

export function PrivateBadge() {
  return (
    <p className="mx-auto mt-6 w-fit rounded-full border border-[#D4AF37]/40 px-4 py-2 text-center text-[11px] tracking-[0.14em] text-goldsoft">
      Private Access Only — Contact Administrator
    </p>
  );
}
