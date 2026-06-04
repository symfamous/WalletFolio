import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Per-IP rate limiting for /api/* — protects upstream API quotas (Zerion,
 * OpenSea, etc.) from abuse via the public demo.
 *
 * Fixed-window, in-memory. Note: serverless instances don't share memory, so
 * this is per-instance protection (enough to deter casual hammering). For
 * hard global limits, back this with Upstash/Redis.
 */
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 60; // requests per IP per window

const hits = new Map<string, { count: number; reset: number }>();

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function middleware(req: NextRequest) {
  const ip = clientIp(req);
  const now = Date.now();
  const rec = hits.get(ip);

  if (!rec || now > rec.reset) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
  } else {
    rec.count += 1;
    if (rec.count > MAX_REQUESTS) {
      const retry = Math.ceil((rec.reset - now) / 1000);
      return new NextResponse(
        JSON.stringify({ error: "Too many requests — slow down and try again shortly." }),
        {
          status: 429,
          headers: {
            "content-type": "application/json",
            "retry-after": String(retry),
            "x-ratelimit-limit": String(MAX_REQUESTS),
            "x-ratelimit-remaining": "0",
          },
        }
      );
    }
  }

  // Opportunistic cleanup so the map can't grow unbounded.
  if (hits.size > 10_000) {
    for (const [key, val] of hits) if (now > val.reset) hits.delete(key);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
