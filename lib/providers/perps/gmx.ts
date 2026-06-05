/**
 * lib/providers/perps/gmx.ts
 *
 * GMX v2 adapter.
 *
 * GMX v2 is deployed on Arbitrum (chainId 42161) and Avalanche (43114).
 *
 * IMPORTANT: GMX does not expose a simple REST API for user positions.
 * The official data sources are:
 *   1. On-chain contract reads (requires RPC — too slow for a web app)
 *   2. The GMX subgraph on TheGraph (requires GRAPH API key)
 *   3. The GMX Stats API at https://stats.gmx.io/ (undocumented, fragile)
 *
 * Because there is no publicly documented, reliable, keyless REST API
 * for GMX user positions, this adapter returns a stub that clearly
 * communicates the limitation rather than using fragile unofficial endpoints.
 *
 * If GMX releases an official public positions API, this adapter should
 * be updated here.
 *
 * Docs: https://docs.gmx.io/docs/api/api-overview
 */

import type { NormalizedPerpPlatform } from "./types";

export async function fetchGmxPerps(_address: string): Promise<NormalizedPerpPlatform> {
  return {
    platform:       "GMX v2",
    chain:          "Arbitrum / Avalanche",
    chainColor:     "#2D42FC",
    positions:      [],
    accountSummary: null,
    pnl: {
      realizedPnl: 0, unrealizedPnl: 0, totalFunding: 0,
      totalFees: 0, netLifetime: 0, pnlByMarket: [],
      fillCount: 0, isExact: false,
      dataNote: "GMX does not expose a public keyless API for user positions. On-chain reading is required.",
    },
    error: "no-public-api",
  };
}