/**
 * app/api/trends/route.ts
 * Early-trend finder — ranks coins by short-term momentum from CoinGecko's free
 * markets endpoint (volume turnover + accelerating 1h/24h price). Cached server-
 * side so the public CoinGecko rate limit isn't hit per client.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CGMarket {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price?: number;
  market_cap?: number;
  market_cap_rank?: number;
  total_volume?: number;
  price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_24h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export async function GET() {
  try {
    const url =
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc" +
      "&per_page=100&page=1&sparkline=false&price_change_percentage=1h,24h,7d";
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(7000) });
    if (!res.ok) return NextResponse.json({ trends: [] });

    const markets = (await res.json()) as CGMarket[];
    if (!Array.isArray(markets)) return NextResponse.json({ trends: [] });

    const trends = markets
      .map((m) => {
        const price = m.current_price ?? 0;
        const mcap = m.market_cap ?? 0;
        const vol = m.total_volume ?? 0;
        const change1h = m.price_change_percentage_1h_in_currency ?? 0;
        const change24h = m.price_change_percentage_24h_in_currency ?? 0;
        const change7d = m.price_change_percentage_7d_in_currency ?? 0;
        const volMcap = mcap > 0 ? vol / mcap : 0;

        // Momentum score: turnover (attention) + accelerating short-term price.
        // "Early" leans toward coins outside the mega-caps that are heating up.
        const turnoverScore = clamp(volMcap * 100, 0, 40);
        const shortScore = clamp(change1h * 2, -15, 20) + clamp(change24h, -20, 30);
        const earlyBonus = (m.market_cap_rank ?? 0) > 25 ? 8 : 0;
        const score = turnoverScore + shortScore + earlyBonus;

        return {
          id: m.id,
          symbol: m.symbol?.toUpperCase() ?? "?",
          name: m.name ?? "",
          image: m.image ?? null,
          price,
          rank: m.market_cap_rank ?? null,
          change1h,
          change24h,
          change7d,
          volMcap,
          score,
        };
      })
      // Only surface coins that are actually moving up with real turnover.
      .filter((t) => t.change24h > 0 && t.volMcap >= 0.05 && t.price > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    return NextResponse.json(
      { trends },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch {
    return NextResponse.json({ trends: [] });
  }
}
