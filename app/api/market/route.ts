/**
 * app/api/market/route.ts
 *
 * Free market-context aggregator (no paid keys):
 *  - Fear & Greed Index  → alternative.me (no key)
 *  - BTC dominance / global market cap → CoinGecko /global (no key)
 *  - ETH gas (gwei) → Etherscan gas oracle (uses existing ETHERSCAN_API_KEY)
 *
 * All sources are best-effort; any failure yields a null field, never an error.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function safeJson(url: string, headers?: Record<string, string>): Promise<unknown | null> {
  try {
    const res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET() {
  const [fng, global, gas] = await Promise.all([
    safeJson("https://api.alternative.me/fng/"),
    safeJson("https://api.coinpaprika.com/v1/global"),
    process.env.ETHERSCAN_API_KEY
      ? safeJson(`https://api.etherscan.io/v2/api?chainid=1&module=gastracker&action=gasoracle&apikey=${process.env.ETHERSCAN_API_KEY}`)
      : Promise.resolve(null),
  ]);

  const fngData = (fng as { data?: { value?: string; value_classification?: string }[] } | null)?.data?.[0];
  const g = global as {
    bitcoin_dominance_percentage?: number;
    market_cap_usd?: number;
    market_cap_change_24h?: number;
  } | null;
  const gasResult = (gas as { result?: { ProposeGasPrice?: string } } | null)?.result;
  const gasGwei = gasResult?.ProposeGasPrice ? Number(gasResult.ProposeGasPrice) : null;

  return NextResponse.json(
    {
      fearGreed: fngData
        ? { value: Number(fngData.value), label: fngData.value_classification ?? "" }
        : null,
      btcDominance: g?.bitcoin_dominance_percentage ?? null,
      ethDominance: null,
      totalMarketCapUsd: g?.market_cap_usd ?? null,
      marketCapChange24h: g?.market_cap_change_24h ?? null,
      ethGasGwei: gasGwei != null ? Math.round(gasGwei * 100) / 100 : null,
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" } }
  );
}
