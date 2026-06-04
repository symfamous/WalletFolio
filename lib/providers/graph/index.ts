/**
 * lib/providers/graph/index.ts
 *
 * The Graph subgraphs registry and common utilities.
 *
 * The Graph provides decentralized indexing for Ethereum and other EVM chains.
 * Subgraphs offer detailed DeFi data not available via REST APIs.
 *
 * Docs: https://thegraph.com/docs/en/
 * Studio: https://thegraph.com/studio/
 * Free tier: 1000 queries/month
 */

export const THEGRAPH_ENDPOINT = "https://gateway.thegraph.com/api/v1/graphql";

// Chain ID to network slug mapping for The Graph
export const CHAIN_ID_TO_SLUG: Record<number, string> = {
  1: "ethereum",
  42161: "arbitrum-one",
  10: "optimism",
  137: "matic",
  8453: "base",
  43114: "avalanche",
};

export const SLUG_TO_CHAIN_ID: Record<string, number> = {
  ethereum: 1,
  "arbitrum-one": 42161,
  optimism: 10,
  matic: 137,
  base: 8453,
  avalanche: 43114,
};

// ─── Subgraph registry ────────────────────────────────────────────

export interface SubgraphConfig {
  name: string;
  endpoint: string;
  network: string;
  description: string;
}

// Known working subgraphs
// NOTE: The hosted service (api.thegraph.com) is the free, open access network.
// The decentralized gateway (gateway.thegraph.com) requires per-subgraph API keys.
// Using hosted service URLs for community subgraphs (no API key required for queries).
export const SUBGRAPHS: Record<string, SubgraphConfig> = {
  // GMX v2 — on hosted service (no API key needed for queries)
  "gmx-v2-arbitrum": {
    name: "GMX v2 (Arbitrum)",
    endpoint: "https://api.thegraph.com/subgraphs/name/gmx-v2-arbitrum",
    network: "arbitrum-one",
    description: "GMX v2 perpetual positions on Arbitrum",
  },
  "gmx-v2-avalanche": {
    name: "GMX v2 (Avalanche)",
    endpoint: "https://api.thegraph.com/subgraphs/name/gmx-v2-avalanche",
    network: "avalanche",
    description: "GMX v2 perpetual positions on Avalanche",
  },
  // dYdX
  "dydx": {
    name: "dYdX v4",
    endpoint: "https://api.thegraph.com/subgraphs/name/dydxprotocol/dydx",
    network: "ethereum",
    description: "dYdX v4 positions and trades",
  },
  // Aave v3 — Ethereum & Arbitrum
  "aave-v3-ethereum": {
    name: "Aave v3 (Ethereum)",
    endpoint: "https://api.thegraph.com/subgraphs/name/messari/aave-v3-ethereum",
    network: "ethereum",
    description: "Aave v3 deposits, borrows, and rewards on Ethereum",
  },
  "aave-v3-arbitrum": {
    name: "Aave v3 (Arbitrum)",
    endpoint: "https://api.thegraph.com/subgraphs/name/messari/aave-v3-arbitrum",
    network: "arbitrum-one",
    description: "Aave v3 deposits, borrows, and rewards on Arbitrum",
  },
  // Compound v3
  "compound-v3-ethereum": {
    name: "Compound v3 (Ethereum)",
    endpoint: "https://api.thegraph.com/subgraphs/name/messari/compound-v3-ethereum",
    network: "ethereum",
    description: "Compound v3 supply/borrow positions on Ethereum",
  },
  // Uniswap v3 — Ethereum & Arbitrum
  "uniswap-v3-ethereum": {
    name: "Uniswap v3 (Ethereum)",
    endpoint: "https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-ethereum",
    network: "ethereum",
    description: "Uniswap v3 LP positions on Ethereum",
  },
  "uniswap-v3-arbitrum": {
    name: "Uniswap v3 (Arbitrum)",
    endpoint: "https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-arbitrum",
    network: "arbitrum-one",
    description: "Uniswap v3 LP positions on Arbitrum",
  },
};

// ─── GraphQL query helper ────────────────────────────────────────

export interface GraphQueryResult<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export async function querySubgraph<T>(
  subgraph: SubgraphConfig,
  query: string,
  variables: Record<string, unknown>,
  apiKey?: string
): Promise<T | null> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    // Only add auth header if API key is provided (gateway requires it; hosted service ignores it)
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const res = await fetch(subgraph.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(15_000),
      // @ts-ignore - Next.js extends RequestInit with `next`
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      console.warn(`[graph/${subgraph.name}] HTTP ${res.status}`);
      return null;
    }

    const body: GraphQueryResult<T> = await res.json();

    if (body.errors?.length) {
      console.debug(`[graph/${subgraph.name}] ${body.errors[0].message}`);
      return null;
    }

    return body.data ?? null;
  } catch (err) {
    console.warn(`[graph/${subgraph.name}] query failed:`, err);
    return null;
  }
}
