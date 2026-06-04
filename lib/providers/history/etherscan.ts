/**
 * lib/providers/history/etherscan.ts
 *
 * Fetches wallet transaction history from Etherscan V2 API.
 *
 * Key design decisions:
 * - Uses a sequential batched strategy instead of one-shot parallel
 *   to avoid all chains failing if rate limits hit at once
 * - Fetches chains in priority order (Ethereum first, then L2s)
 * - Per-chain errors are isolated — one failing chain never blocks others
 * - Results include per-chain status for UI transparency
 */

import type { EtherscanChainDef, EtherscanTx, EtherscanTokenTx } from "@/lib/providers/etherscan";
import { ProviderRequestError, providerFetchJson } from "@/lib/providers/resilience";

const BASE_URL = "https://api.etherscan.io/v2/api";

// Priority order — most active chains first
export const HISTORY_CHAINS: EtherscanChainDef[] = [
  { chainId: 1,      slug: "ethereum",            name: "Ethereum",  explorer: "https://etherscan.io",            color: "#627EEA", emoji: "⟠",  freeTier: true  },
  { chainId: 8453,   slug: "base",                name: "Base",      explorer: "https://basescan.org",            color: "#0052FF", emoji: "🔷", freeTier: true  },
  { chainId: 42161,  slug: "arbitrum",            name: "Arbitrum",  explorer: "https://arbiscan.io",             color: "#28A0F0", emoji: "🔵", freeTier: true  },
  { chainId: 10,     slug: "optimism",            name: "Optimism",  explorer: "https://optimistic.etherscan.io", color: "#FF0420", emoji: "🔴", freeTier: true  },
  { chainId: 137,    slug: "polygon",             name: "Polygon",   explorer: "https://polygonscan.com",         color: "#8247E5", emoji: "🟣", freeTier: true  },
  { chainId: 56,     slug: "binance-smart-chain", name: "BNB Chain", explorer: "https://bscscan.com",             color: "#F3BA2F", emoji: "🟡", freeTier: true  },
  { chainId: 43114,  slug: "avalanche",           name: "Avalanche", explorer: "https://snowtrace.io",            color: "#E84142", emoji: "🔺", freeTier: true  },
  { chainId: 100,    slug: "gnosis",              name: "Gnosis",    explorer: "https://gnosisscan.io",           color: "#04795B", emoji: "🦉", freeTier: true  },
  { chainId: 250,    slug: "fantom",              name: "Fantom",    explorer: "https://ftmscan.com",             color: "#1969FF", emoji: "👻", freeTier: true  },
  { chainId: 59144,  slug: "linea",               name: "Linea",     explorer: "https://lineascan.build",         color: "#61DFFF", emoji: "⬛", freeTier: true  },
  { chainId: 534352, slug: "scroll",              name: "Scroll",    explorer: "https://scrollscan.com",          color: "#EEB878", emoji: "📜", freeTier: true  },
  { chainId: 81457,  slug: "blast",               name: "Blast",     explorer: "https://blastscan.io",            color: "#FCFC03", emoji: "💛", freeTier: true  },
];

export interface ChainHistoryResult {
  chain:     EtherscanChainDef;
  txs:       EtherscanTx[];
  tokenTxs:  EtherscanTokenTx[];
  status:    "success" | "no_data" | "rate_limit" | "plan" | "error";
  error?:    string;
}

interface EtherscanResponse<T> {
  status:  "0" | "1";
  message: string;
  result:  T[] | string;
}

async function escanFetch<T>(
  chainId: number,
  params:  Record<string, string>,
  apiKey:  string,
): Promise<{ ok: true; data: T[] } | { ok: false; reason: "rate_limit" | "plan" | "no_data" | "error"; msg: string }> {
  const p = new URLSearchParams({ chainid: String(chainId), apikey: apiKey, ...params });

  try {
    const json = await providerFetchJson<EtherscanResponse<T>>(
      "etherscan",
      `${BASE_URL}?${p}`,
      {
        // @ts-ignore
        next: { revalidate: 60 },
      }
    );

    if (json.status === "0") {
      const msg   = typeof json.result === "string" ? json.result : json.message ?? "";
      const lower = msg.toLowerCase();
      if (lower.includes("rate limit") || lower.includes("max rate"))
        return { ok: false, reason: "rate_limit", msg };
      if (lower.includes("invalid api") || lower.includes("not allowed") || lower.includes("upgrade"))
        return { ok: false, reason: "plan", msg };
      if (lower.includes("no transactions") || lower.includes("no record"))
        return { ok: false, reason: "no_data", msg: "No transactions" };
      return { ok: false, reason: "no_data", msg };
    }

    return { ok: true, data: Array.isArray(json.result) ? json.result : [] };
  } catch (err) {
    if (err instanceof ProviderRequestError && err.reason === "rate_limit") {
      return { ok: false, reason: "rate_limit", msg: err.message };
    }
    return { ok: false, reason: "error", msg: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Fetch one chain's history (txs + token transfers).
 */
export async function fetchChainHistory(
  address:  string,
  chain:    EtherscanChainDef,
  apiKey:   string,
  page      = 1,
): Promise<ChainHistoryResult> {
  const [txResult, tokResult] = await Promise.all([
    escanFetch<EtherscanTx>(chain.chainId, {
      module: "account", action: "txlist", address,
      startblock: "0", endblock: "99999999",
      page: String(page), offset: "100", sort: "desc",
    }, apiKey),
    escanFetch<EtherscanTokenTx>(chain.chainId, {
      module: "account", action: "tokentx", address,
      page: String(page), offset: "100", sort: "desc",
    }, apiKey),
  ]);

  const txs      = txResult.ok     ? txResult.data     : [];
  const tokenTxs = tokResult.ok    ? tokResult.data    : [];
  const hasData  = txs.length > 0 || tokenTxs.length > 0;

  // Determine status
  let status: ChainHistoryResult["status"] = "no_data";
  if (hasData) {
    status = "success";
  } else if (!txResult.ok && txResult.reason === "plan")   {
    status = "plan";
  } else if (!txResult.ok && txResult.reason === "rate_limit") {
    status = "rate_limit";
  } else if (!txResult.ok && txResult.reason === "error") {
    status = "error";
  }

  return { chain, txs, tokenTxs, status };
}

/**
 * Fetch all supported chains, processing in batches of 6 to avoid
 * hammering Etherscan rate limits all at once.
 */
export async function fetchAllChains(
  address: string,
  apiKey:  string,
  page     = 1,
): Promise<ChainHistoryResult[]> {
  const results: ChainHistoryResult[] = [];
  const BATCH_SIZE = 6;

  for (let i = 0; i < HISTORY_CHAINS.length; i += BATCH_SIZE) {
    const batch = HISTORY_CHAINS.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((chain) => fetchChainHistory(address, chain, apiKey, page))
    );
    results.push(...batchResults);

    // Small delay between batches to respect rate limits
    if (i + BATCH_SIZE < HISTORY_CHAINS.length) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  return results;
}
