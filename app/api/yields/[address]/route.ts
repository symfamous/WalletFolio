/**
 * app/api/yields/[address]/route.ts
 *
 * Yield opportunities from DefiLlama (free, no key). Given ?symbols=USDC,ETH,…
 * returns the best low-risk, single-asset pools to earn on each held token.
 * The full pool list is cached for 1h; the response is filtered + trimmed.
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LlamaPool {
  symbol?: string;
  project?: string;
  chain?: string;
  apy?: number;
  apyBase?: number;
  apyReward?: number;
  tvlUsd?: number;
  stablecoin?: boolean;
  ilRisk?: string;
  exposure?: string;
  pool?: string;
}

const MIN_TVL = 1_000_000; // safety: ignore thin pools
const MAX_APY = 1000; // ignore obviously-bogus APYs

export async function GET(req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  await params; // address not needed for the lookup, but keeps the route per-wallet
  const symbolsParam = new URL(req.url).searchParams.get("symbols") ?? "";
  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 12);
  if (symbols.length === 0) return NextResponse.json({ bySymbol: {} });

  let pools: LlamaPool[] = [];
  try {
    const res = await fetch("https://yields.llama.fi/pools", { next: { revalidate: 3600 } });
    if (res.ok) {
      const json = (await res.json()) as { data?: LlamaPool[] };
      pools = json.data ?? [];
    }
  } catch {
    return NextResponse.json({ bySymbol: {} });
  }

  // Pre-filter to safe, single-asset, sane-APY pools once.
  const safe = pools.filter(
    (p) =>
      typeof p.apy === "number" &&
      p.apy > 0.1 &&
      p.apy < MAX_APY &&
      (p.tvlUsd ?? 0) >= MIN_TVL &&
      (p.exposure === "single" || p.stablecoin) &&
      typeof p.symbol === "string"
  );

  const bySymbol: Record<string, Array<{
    project: string; chain: string; apy: number; apyBase: number | null;
    tvlUsd: number; ilRisk: string; symbol: string; url: string;
  }>> = {};

  for (const token of symbols) {
    const matches = safe
      .filter((p) => (p.symbol ?? "").toUpperCase().includes(token))
      .sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0))
      .slice(0, 4)
      .map((p) => ({
        project: p.project ?? "—",
        chain: p.chain ?? "—",
        apy: p.apy ?? 0,
        apyBase: typeof p.apyBase === "number" ? p.apyBase : null,
        tvlUsd: p.tvlUsd ?? 0,
        ilRisk: p.ilRisk ?? "no",
        symbol: p.symbol ?? token,
        url: p.pool ? `https://defillama.com/yields/pool/${p.pool}` : "https://defillama.com/yields",
      }));
    if (matches.length > 0) bySymbol[token] = matches;
  }

  return NextResponse.json(
    { bySymbol },
    { headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=1200" } }
  );
}
