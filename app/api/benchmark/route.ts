/**
 * app/api/benchmark/route.ts
 *
 * BTC / ETH percentage return over a given range, used to benchmark portfolio
 * performance ("are you beating the market?"). Tries Binance first, then falls
 * back to Coinbase — Binance.com geo-blocks US IPs (e.g. Vercel's US regions),
 * which would otherwise leave BTC/ETH null on production. Both are free, no key.
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// range -> [binance interval, candle count]
const BINANCE_MAP: Record<string, [string, number]> = {
  "1H": ["1m", 60],
  "4H": ["5m", 48],
  "24H": ["1h", 24],
  "7D": ["4h", 42],
  "30D": ["1d", 30],
  "1Y": ["1w", 52],
  ALL: ["1w", 104],
};

// range -> [coinbase granularity (sec), candle count] (Coinbase caps at 300)
const COINBASE_MAP: Record<string, [number, number]> = {
  "1H": [60, 60],
  "4H": [300, 48],
  "24H": [3600, 24],
  "7D": [21600, 28],
  "30D": [86400, 30],
  "1Y": [86400, 300],
  ALL: [86400, 300],
};

async function binanceChange(symbol: string, interval: string, limit: number): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const k = (await res.json()) as string[][];
    if (!Array.isArray(k) || k.length < 2) return null;
    const first = Number(k[0][1]);
    const last = Number(k[k.length - 1][4]);
    return first ? ((last - first) / first) * 100 : null;
  } catch {
    return null;
  }
}

async function coinbaseChange(product: string, granularity: number, count: number): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.exchange.coinbase.com/products/${product}/candles?granularity=${granularity}`,
      { cache: "no-store", signal: AbortSignal.timeout(6000), headers: { "User-Agent": "walletfolio" } }
    );
    if (!res.ok) return null;
    // Coinbase candles: [ time, low, high, open, close, volume ] — newest first.
    const c = (await res.json()) as number[][];
    if (!Array.isArray(c) || c.length < 2) return null;
    const slice = c.slice(0, Math.min(count, c.length));
    const newest = slice[0];
    const oldest = slice[slice.length - 1];
    const openOld = oldest?.[3];
    const closeNew = newest?.[4];
    return openOld ? ((closeNew - openOld) / openOld) * 100 : null;
  } catch {
    return null;
  }
}

async function changePct(binanceSymbol: string, coinbaseProduct: string, range: string): Promise<number | null> {
  const [bInterval, bLimit] = BINANCE_MAP[range] ?? BINANCE_MAP["30D"];
  const binance = await binanceChange(binanceSymbol, bInterval, bLimit);
  if (binance !== null) return binance;
  const [cGran, cCount] = COINBASE_MAP[range] ?? COINBASE_MAP["30D"];
  return coinbaseChange(coinbaseProduct, cGran, cCount);
}

export async function GET(req: NextRequest) {
  const range = new URL(req.url).searchParams.get("range") ?? "30D";
  const [btc, eth] = await Promise.all([
    changePct("BTCUSDT", "BTC-USD", range),
    changePct("ETHUSDT", "ETH-USD", range),
  ]);
  return NextResponse.json(
    { btc, eth, range },
    { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=300" } }
  );
}
