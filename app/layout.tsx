import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DB357",
    template: "%s · DB357",
  },
  description: "Private access desk for DB357.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${GeistSans.className} antialiased`}>
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0"
          style={{
            background:
              "radial-gradient(900px 480px at 50% -8%, rgba(212,175,55,0.10), transparent 58%), radial-gradient(520px 340px at 100% 110%, rgba(229,193,88,0.05), transparent 55%)",
          }}
        />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
