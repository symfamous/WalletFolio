/**
 * lib/providers/graph/gmx.ts
 *
 * GMX v2 subgraph queries via The Graph.
 *
 * GMX v2 is deployed on:
 *   - Arbitrum (chainId: 42161)
 *   - Avalanche (chainId: 43114)
 *
 * The GMX subgraphs index:
 *   - User positions (long/short)
 *   - Account values
 *   - Trade history
 *   - Funding fees
 *
 * Subgraph endpoints (verified on The Graph Explorer):
 *   - Arbitrum: https://thegraph.com/explorer/subgraphs/GMX-Team/gmx-v2-arbitrum
 *   - Avalanche: https://thegraph.com/explorer/subgraphs/GMX-Team/gmx-v2-avalanche
 *
 * Docs: https://docs.gmx.io/docs/api/api-overview/
 */

import type { NormalizedPerpPlatform, NormalizedPerpPosition } from "../perps/types";
import { SUBGRAPHS, CHAIN_ID_TO_SLUG, querySubgraph } from "./index";

// ─── GMX subgraph types ─────────────────────────────────────────

interface GmxPosition {
  id: string;
  account: string;
  market: string;
  marketSymbol: string;
  side: string; // "LONG" | "SHORT"
  size: string; // raw bigint as string
  collateral: string;
  entryPrice: string;
  markPrice: string;
  leverage: string;
  fundingFee: string;
  pnl: string;
  realizedPnl: string;
  timestamp: number;
  blockNumber: number;
}

export interface GmxAccount {
  id: string;
  totalGlobalLongValue: string;
  totalGlobalShortValue: string;
  totalClaimable: string;
  totalStaked: string;
  positions: GmxPosition[];
}

// ─── Arbitrum subgraph query ─────────────────────────────────────

const GMX_ARBITRUM_QUERY = `
  query GmxUserPositions($address: String!) {
    accounts(
      where: { id: $address }
      first: 1
    ) {
      id
      totalGlobalLongValue
      totalGlobalShortValue
      totalClaimable
      totalStaked
      positions {
        id
        account
        market
        marketSymbol
        side
        size
        collateral
        entryPrice
        markPrice
        leverage
        fundingFee
        pnl
        realizedPnl
        timestamp
        blockNumber
      }
    }
  }
`;

// ─── Avalanche subgraph query ───────────────────────────────────

const GMX_AVALANCHE_QUERY = `
  query GmxUserPositions($address: String!) {
    accounts(
      where: { id: $address }
      first: 1
    ) {
      id
      totalGlobalLongValue
      totalGlobalShortValue
      totalClaimable
      totalStaked
      positions {
        id
        account
        market
        marketSymbol
        side
        size
        collateral
        entryPrice
        markPrice
        leverage
        fundingFee
        pnl
        realizedPnl
        timestamp
        blockNumber
      }
    }
  }
`;

// ─── Chain info ─────────────────────────────────────────────────

const GMX_CHAINS: Array<{
  chainId: number;
  chainSlug: string;
  chainColor: string;
  chainName: string;
  query: string;
}> = [
  {
    chainId: 42161,
    chainSlug: "arbitrum",
    chainColor: "#28E0B9",
    chainName: "Arbitrum",
    query: GMX_ARBITRUM_QUERY,
  },
  {
    chainId: 43114,
    chainSlug: "avalanche",
    chainColor: "#E84142",
    chainName: "Avalanche",
    query: GMX_AVALANCHE_QUERY,
  },
];

// ─── Parse helpers ──────────────────────────────────────────────

function parseGmxPosition(pos: GmxPosition, chain: typeof GMX_CHAINS[0]): NormalizedPerpPosition {
  const size = parseFloat(pos.size) / 1e30; // GMX uses 30 decimals
  const collateral = parseFloat(pos.collateral) / 1e30;
  const entryPrice = parseFloat(pos.entryPrice) / 1e30;
  const markPrice = parseFloat(pos.markPrice) / 1e30;
  const leverage = parseFloat(pos.leverage) / 1e4; // leverage is in basis points * 100

  const positionValue = size * markPrice;
  const unrealizedPnl = parseFloat(pos.pnl) / 1e30;
  const fundingFee = parseFloat(pos.fundingFee) / 1e30;

  // Liquidation price estimate (rough)
  const liqPrice = pos.side === "LONG"
    ? entryPrice * (1 - 1 / leverage)
    : entryPrice * (1 + 1 / leverage);

  const liqDistancePct = liqPrice > 0
    ? Math.abs((markPrice - liqPrice) / liqPrice) * 100
    : null;

  return {
    platform: "gmx-v2",
    chain: chain.chainSlug,
    chainColor: chain.chainColor,
    market: pos.marketSymbol,
    coin: pos.marketSymbol.replace("-USD", "").replace("USD", ""),

    side: pos.side === "LONG" ? "long" : "short",
    size,
    entryPrice,
    markPrice,
    positionValue,
    unrealizedPnl,
    leverage,
    leverageType: "isolated",

    liquidationPrice: liqPrice || null,
    liqDistancePct,
    marginUsed: collateral,
    fundingSinceOpen: fundingFee,
    returnOnEquity: positionValue > 0 ? unrealizedPnl / collateral : 0,

    riskLevel: leverage > 10 ? "critical" : leverage > 5 ? "warning" : "safe",
    status: size > 0 ? "open" : "closed",
    isExact: true,
  };
}

// ─── Fetch GMX positions for one chain ───────────────────────────

async function fetchGmxForChain(
  address: string,
  chain: typeof GMX_CHAINS[0],
  apiKey: string
): Promise<GmxAccount | null> {
  const subgraph =
    chain.chainId === 42161 ? SUBGRAPHS["gmx-v2-arbitrum"] : SUBGRAPHS["gmx-v2-avalanche"];

  if (!subgraph) {
    console.warn(`[graph/gmx] No subgraph config for chain ${chain.chainId}`);
    return null;
  }

  const data = await querySubgraph<{
    accounts?: GmxAccount[];
  }>(subgraph, chain.query, { address: address.toLowerCase() }, apiKey);

  return data?.accounts?.[0] ?? null;
}

// ─── Main GMX fetcher ───────────────────────────────────────────

export async function fetchGmxPerps(
  address: string,
  apiKey: string
): Promise<NormalizedPerpPlatform> {
  if (!apiKey) {
    return {
      platform: "GMX v2",
      chain: "Arbitrum / Avalanche",
      chainColor: "#2D42FC",
      positions: [],
      accountSummary: null,
      pnl: {
        realizedPnl: 0, unrealizedPnl: 0, totalFunding: 0,
        totalFees: 0, netLifetime: 0, pnlByMarket: [],
        fillCount: 0, isExact: false,
        dataNote: "The Graph API key required for GMX v2 positions. Get one at thegraph.com/studio",
      },
      error: "no-api-key",
    };
  }

  const results = await Promise.allSettled(
    GMX_CHAINS.map((chain) => fetchGmxForChain(address, chain, apiKey))
  );

  const allPositions: NormalizedPerpPosition[] = [];
  let totalRealizedPnl = 0;
  let totalUnrealizedPnl = 0;
  let totalFunding = 0;
  const pnlByMarket: Array<{ coin: string; pnl: number }> = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status !== "fulfilled" || !result.value) continue;

    const account = result.value;

    for (const pos of account.positions) {
      const normalized = parseGmxPosition(pos, GMX_CHAINS[i]);
      if (normalized.size > 0) {
        allPositions.push(normalized);
        totalUnrealizedPnl += normalized.unrealizedPnl;
        totalFunding += normalized.fundingSinceOpen;
      }
    }

    // Aggregate realized PnL from positions
    for (const pos of account.positions) {
      const realizedPnl = parseFloat(pos.realizedPnl) / 1e30;
      totalRealizedPnl += realizedPnl;
    }
  }

  const totalAccountValue = allPositions.reduce((s, p) => s + p.positionValue, 0);

  return {
    platform: "GMX v2",
    chain: "Arbitrum / Avalanche",
    chainColor: "#2D42FC",
    positions: allPositions,
    accountSummary: {
      accountValue: totalAccountValue,
      totalMarginUsed: allPositions.reduce((s, p) => s + p.marginUsed, 0),
      totalNtlPos: allPositions.length,
      withdrawable: 0, // not available from subgraph
    },
    pnl: {
      realizedPnl: totalRealizedPnl,
      unrealizedPnl: totalUnrealizedPnl,
      totalFunding,
      totalFees: 0,
      netLifetime: totalRealizedPnl + totalFunding,
      pnlByMarket,
      fillCount: 0,
      isExact: true,
      dataNote: allPositions.length > 0
        ? "Data from GMX v2 subgraphs on The Graph"
        : "No GMX v2 positions found",
    },
  };
}
