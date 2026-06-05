/**
 * app/api/trending/route.ts
 * Trending coins from CoinGecko (free, no key).
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CGItem {
  item?: {
    symbol?: string;
    name?: string;
    thumb?: string;
    market_cap_rank?: number;
    data?: { price?: number; price_change_percentage_24h?: { usd?: number } };
  };
}

export async function GET() {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/search/trending", {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return NextResponse.json({ coins: [] });
    const data = (await res.json()) as { coins?: CGItem[] };
    const coins = (data.coins ?? []).slice(0, 8).map((c) => ({
      symbol: c.item?.symbol ?? "?",
      name: c.item?.name ?? "",
      thumb: c.item?.thumb ?? "",
      rank: c.item?.market_cap_rank ?? null,
      price: typeof c.item?.data?.price === "number" ? c.item.data.price : null,
      change24h: c.item?.data?.price_change_percentage_24h?.usd ?? null,
    }));
    return NextResponse.json(
      { coins },
      { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=300" } }
    );
  } catch {
    return NextResponse.json({ coins: [] });
  }
}
