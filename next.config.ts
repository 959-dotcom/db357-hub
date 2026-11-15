import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["qrcode"],
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon" }];
  },
};

export default nextConfig;
