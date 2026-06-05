/**
 * app/api/hl-funding/route.ts
 *
 * Hyperliquid perp funding & open interest (free public API, no key).
 * Returns per-market funding APR, open interest (USD), and mark price.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AssetCtx {
  funding?: string;
  openInterest?: string;
  markPx?: string;
  premium?: string;
}

export async function GET() {
  try {
    const res = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return NextResponse.json({ markets: [] });
    const data = (await res.json()) as [{ universe: { name: string }[] }, AssetCtx[]];
    const universe = data[0]?.universe ?? [];
    const ctxs = data[1] ?? [];

    const markets = universe
      .map((u, i) => {
        const c = ctxs[i] ?? {};
        const hourly = Number(c.funding ?? 0);
        const mark = Number(c.markPx ?? 0);
        const oi = Number(c.openInterest ?? 0);
        return {
          coin: u.name,
          fundingApr: hourly * 24 * 365 * 100,
          fundingHourly: hourly * 100,
          openInterestUsd: oi * mark,
          markPx: mark,
          premium: c.premium != null ? Number(c.premium) * 100 : null,
        };
      })
      .filter((m) => m.openInterestUsd > 0)
      .sort((a, b) => b.openInterestUsd - a.openInterestUsd);

    return NextResponse.json(
      { markets },
      { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch {
    return NextResponse.json({ markets: [] });
  }
}
