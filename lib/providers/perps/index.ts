/**
 * lib/providers/perps/index.ts
 *
 * Aggregates all perp platform adapters into one call.
 * Each adapter is fault-isolated — one failure doesn't block others.
 *
 * Active platforms:
 *   ✅ Hyperliquid  — full open positions + exact PnL (public API)
 *   ✅ dYdX v4      — full open positions + exact PnL (public indexer)
 *   ✅ GMX v2       — positions via The Graph subgraphs (requires API key)
 *   ⚠  Drift        — Solana only, incompatible with EVM addresses
 */

import type { NormalizedPerpPlatform } from "./types";
import { fetchHyperliquidPerps } from "./hyperliquid";
import { fetchDydxPerps }        from "./dydx";
import { fetchGmxPerps }         from "../graph/gmx";
import { isProviderEnabled }     from "@/lib/providers/resilience";

const THEGRAPH_API_KEY = process.env.THEGRAPH_API_KEY ?? "";

// Only include platforms that can realistically return data for EVM addresses
const ACTIVE_ADAPTERS = [
  { id: "hyperliquid", fetch: fetchHyperliquidPerps },
  { id: "dydx",        fetch: fetchDydxPerps        },
  { id: "gmx-v2",      fetch: (addr: string) => fetchGmxPerps(addr, THEGRAPH_API_KEY) },
];

export interface AggregatedPerps {
  platforms:          NormalizedPerpPlatform[];
  allPositions:       import("./types").NormalizedPerpPosition[];
  totalUnrealizedPnl: number;
  totalRealizedPnl:   number;
  totalFunding:       number;
  totalFees:          number;
  netLifetimePnl:     number;
  totalAccountValue:  number;
  openPositionCount:  number;
  hasAnyPositions:    boolean;
  isPartialData:      boolean;  // true if any platform is estimated/truncated
}

export async function fetchAllPerps(address: string): Promise<AggregatedPerps> {
  // Run all adapters in parallel, each fault-isolated
  const enabledAdapters = ACTIVE_ADAPTERS.filter((adapter) => {
    if (adapter.id === "dydx") return isProviderEnabled("dydx");
    return true;
  });

  const results = await Promise.allSettled(enabledAdapters.map((a) => a.fetch(address)));

  const platforms: NormalizedPerpPlatform[] = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    console.warn(`[perps/${enabledAdapters[i].id}] failed:`, r.reason);
    return {
      platform:       enabledAdapters[i].id,
      chain:          "unknown",
      chainColor:     "#5a78a0",
      positions:      [],
      accountSummary: null,
      pnl: {
        realizedPnl: 0, unrealizedPnl: 0, totalFunding: 0,
        totalFees: 0, netLifetime: 0, pnlByMarket: [],
        fillCount: 0, isExact: false,
        dataNote: "Failed to fetch data from this platform.",
      },
      error: "fetch-failed",
    } satisfies NormalizedPerpPlatform;
  });

  const allPositions = platforms.flatMap((p) => p.positions);

  const totalUnrealizedPnl = platforms.reduce((s, p) => s + p.pnl.unrealizedPnl, 0);
  const totalRealizedPnl   = platforms.reduce((s, p) => s + p.pnl.realizedPnl,   0);
  const totalFunding       = platforms.reduce((s, p) => s + p.pnl.totalFunding,   0);
  const totalFees          = platforms.reduce((s, p) => s + p.pnl.totalFees,      0);
  const totalAccountValue  = platforms.reduce(
    (s, p) => s + Math.max(p.accountSummary?.accountValue ?? 0, p.accountSummary?.withdrawable ?? 0),
    0
  );

  return {
    platforms,
    allPositions,
    totalUnrealizedPnl,
    totalRealizedPnl,
    totalFunding,
    totalFees,
    netLifetimePnl:    totalRealizedPnl + totalFunding - totalFees,
    totalAccountValue,
    openPositionCount: allPositions.filter((p) => p.status === "open").length,
    hasAnyPositions:   allPositions.length > 0,
    isPartialData:     platforms.some((p) => !p.pnl.isExact),
  };
}

export type { NormalizedPerpPlatform, NormalizedPerpPosition } from "./types";
