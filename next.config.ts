import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "assets.coingecko.com" },
      { protocol: "https", hostname: "coin-images.coingecko.com" },
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      { protocol: "https", hostname: "tokens.1inch.io" },
      { protocol: "https", hostname: "s2.coinmarketcap.com" },
    ],
  },
  serverExternalPackages: [],
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "s-maxage=30, stale-while-revalidate=60" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type",           value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control",          value: "no-cache, no-store, must-revalidate"   },
          { key: "Service-Worker-Allowed", value: "/"                                      },
        ],
      },
      {
        // Next.js app/manifest.ts generates this URL
        source: "/manifest.webmanifest",
        headers: [
          { key: "Content-Type",  value: "application/manifest+json" },
          { key: "Cache-Control", value: "public, max-age=3600"      },
        ],
      },
    ];
  },
};

export default nextConfig;