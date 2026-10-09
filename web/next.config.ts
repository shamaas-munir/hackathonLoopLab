import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Django URLs end with "/": keep the slash instead of redirecting it away.
  skipTrailingSlashRedirect: true,
  // Allow slow upstream responses (remote database over a high-latency link) instead of failing at 30 s.
  experimental: { proxyTimeout: 120_000 },
  async rewrites() {
    return [
      { source: "/api/:path*/", destination: `${backendUrl}/api/:path*/` },
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
