import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
    ];
  },
  // Increase server-side HTTP timeout for slow backend endpoints (route planning ~10s)
  serverExternalPackages: [],
  experimental: {
    proxyTimeout: 60_000, // 60 seconds
  },
};

export default nextConfig;

