/**
 * app/api/benchmark/route.ts
 *
 * BTC / ETH percentage return over a given range (Binance klines, free, no key),
 * used to benchmark portfolio performance ("are you beating the market?").
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// range -> [binance interval, number of candles]
const RANGE_MAP: Record<string, [string, number]> = {
  "1H": ["1m", 60],
  "4H": ["5m", 48],
  "24H": ["1h", 24],
  "7D": ["4h", 42],
  "30D": ["1d", 30],
  "1Y": ["1w", 52],
  ALL: ["1w", 104],
};

async function changePct(symbol: string, interval: string, limit: number): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const k = (await res.json()) as string[][];
    if (!Array.isArray(k) || k.length < 2) return null;
    const first = Number(k[0][1]); // open of first candle
    const last = Number(k[k.length - 1][4]); // close of last candle
    if (!first) return null;
    return ((last - first) / first) * 100;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const range = new URL(req.url).searchParams.get("range") ?? "30D";
  const [interval, limit] = RANGE_MAP[range] ?? RANGE_MAP["30D"];
  const [btc, eth] = await Promise.all([
    changePct("BTCUSDT", interval, limit),
    changePct("ETHUSDT", interval, limit),
  ]);
  return NextResponse.json(
    { btc, eth, range },
    { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=300" } }
  );
}
