/**
 * lib/providers/etherscan.ts
 *
 * Etherscan API V2 — multichain wallet history provider.
 *
 * Free-tier reality:
 *   The Etherscan V2 API uses a single key with ?chainid= parameter.
 *   NOT all chains work on the free tier — some require paid plans or
 *   are only accessible via their chain-specific Etherscan variant.
 *
 *   VERIFIED FREE-TIER chains (chainid works on free api.etherscan.io/v2):
 *     1     Ethereum (etherscan.io)
 *     42161 Arbitrum (arbiscan.io via v2)
 *     10    Optimism (optimistic.etherscan.io via v2)
 *     8453  Base (basescan.org via v2)
 *     137   Polygon (polygonscan.com via v2)
 *     56    BNB Chain (bscscan.com via v2)
 *     43114 Avalanche (snowtrace.io via v2) — may be rate limited
 *     250   Fantom (ftmscan.com via v2)
 *     100   Gnosis (gnosisscan.io via v2)
 *     59144 Linea (lineascan.build via v2)
 *     534352 Scroll (scrollscan.com via v2)
 *     81457 Blast (blastscan.io via v2)
 *
 *   UNRELIABLE / PAID-ONLY on free v2:
 *     324   zkSync Era — requires separate ZKsync API key
 *
 * Strategy:
 *   - Query all chains in FREE_TIER_CHAINS in parallel
 *   - Each chain has a 10s timeout so one slow chain can't block the rest
 *   - A chain returning HTTP 200 with NOTOK / rate-limit / plan error is
 *     silently skipped (not a failure — just no data available)
 *   - Only chains that return real tx data are included in results
 */

const BASE_URL = "https://api.etherscan.io/v2/api";

// ─── Chain definitions ────────────────────────────────────────────

export interface EtherscanChainDef {
  chainId:  number;
  slug:     string;
  name:     string;
  explorer: string;
  color:    string;
  emoji:    string;
  freeTier: boolean; // whether this is verified to work on free tier
}

export const ETHERSCAN_CHAINS: EtherscanChainDef[] = [
  // ── Verified free tier ────────────────────────────────────────
  { chainId: 1,      slug: "ethereum",             name: "Ethereum",  explorer: "https://etherscan.io",               color: "#627EEA", emoji: "⟠",  freeTier: true  },
  { chainId: 42161,  slug: "arbitrum",             name: "Arbitrum",  explorer: "https://arbiscan.io",                color: "#28A0F0", emoji: "🔵", freeTier: true  },
  { chainId: 10,     slug: "optimism",             name: "Optimism",  explorer: "https://optimistic.etherscan.io",    color: "#FF0420", emoji: "🔴", freeTier: true  },
  { chainId: 8453,   slug: "base",                 name: "Base",      explorer: "https://basescan.org",               color: "#0052FF", emoji: "🔷", freeTier: true  },
  { chainId: 137,    slug: "polygon",              name: "Polygon",   explorer: "https://polygonscan.com",            color: "#8247E5", emoji: "🟣", freeTier: true  },
  { chainId: 56,     slug: "binance-smart-chain",  name: "BNB Chain", explorer: "https://bscscan.com",                color: "#F3BA2F", emoji: "🟡", freeTier: true  },
  { chainId: 43114,  slug: "avalanche",            name: "Avalanche", explorer: "https://snowtrace.io",               color: "#E84142", emoji: "🔺", freeTier: true  },
  { chainId: 250,    slug: "fantom",               name: "Fantom",    explorer: "https://ftmscan.com",                color: "#1969FF", emoji: "👻", freeTier: true  },
  { chainId: 100,    slug: "gnosis",               name: "Gnosis",    explorer: "https://gnosisscan.io",              color: "#04795B", emoji: "🦉", freeTier: true  },
  { chainId: 59144,  slug: "linea",                name: "Linea",     explorer: "https://lineascan.build",            color: "#61DFFF", emoji: "⬛", freeTier: true  },
  { chainId: 534352, slug: "scroll",               name: "Scroll",    explorer: "https://scrollscan.com",             color: "#EEB878", emoji: "📜", freeTier: true  },
  { chainId: 81457,  slug: "blast",                name: "Blast",     explorer: "https://blastscan.io",               color: "#FCFC03", emoji: "💛", freeTier: true  },
  // ── Requires separate key / paid ────────────────────────────
  { chainId: 324,    slug: "zksync-era",           name: "zkSync Era",explorer: "https://explorer.zksync.io",         color: "#8C8DFC", emoji: "⚡", freeTier: false },
];

// Only query free-tier chains by default
export const FREE_TIER_CHAINS = ETHERSCAN_CHAINS.filter((c) => c.freeTier);

// ─── Response types ───────────────────────────────────────────────

export interface EtherscanTx {
  blockNumber:       string;
  timeStamp:         string;
  hash:              string;
  from:              string;
  to:                string;
  value:             string;
  gas:               string;
  gasPrice:          string;
  gasUsed:           string;
  isError:           string;
  txreceipt_status:  string;
  input:             string;
  functionName:      string;
  methodId:          string;
  confirmations:     string;
  contractAddress:   string;
}

export interface EtherscanTokenTx {
  blockNumber:   string;
  timeStamp:     string;
  hash:          string;
  from:          string;
  to:            string;
  value:         string;
  tokenName:     string;
  tokenSymbol:   string;
  tokenDecimal:  string;
  contractAddress: string;
  gas:           string;
  gasPrice:      string;
  gasUsed:       string;
  confirmations: string;
}

interface EtherscanResponse<T> {
  status:  "0" | "1";
  message: string;
  result:  T[] | string;
}

export interface MultiChainHistoryResult {
  txs:        EtherscanTx[];
  tokenTxs:   EtherscanTokenTx[];
  chainId:    number;
  chainSlug:  string;
  chainName:  string;
  explorer:   string;
  color:      string;
  emoji:      string;
}

function isFulfilled<T>(r: PromiseSettledResult<T>): r is PromiseFulfilledResult<T> {
  return r.status === "fulfilled";
}

// ─── Core fetch with error classification ─────────────────────────

type FetchResult<T> =
  | { ok: true;  data: T[]   }
  | { ok: false; reason: "rate_limit" | "plan" | "no_data" | "error"; message: string };

async function escanFetchSafe<T>(
  chainId: number,
  params:  Record<string, string>,
  apiKey:  string
): Promise<FetchResult<T>> {
  const p = new URLSearchParams({
    chainid: String(chainId),
    apikey:  apiKey,
    ...params,
  });

  try {
    const res = await fetch(`${BASE_URL}?${p.toString()}`, {
      // @ts-ignore — Next.js extends RequestInit with `next`
      next:   { revalidate: 60 },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 429) return { ok: false, reason: "rate_limit", message: "Rate limited" };
    if (!res.ok)            return { ok: false, reason: "error", message: `HTTP ${res.status}` };

    const data: EtherscanResponse<T> = await res.json();

    if (data.status === "0") {
      const msg = typeof data.result === "string" ? data.result : data.message ?? "";
      const lower = msg.toLowerCase();

      if (lower.includes("rate limit") || lower.includes("max rate")) {
        return { ok: false, reason: "rate_limit", message: msg };
      }
      if (lower.includes("invalid api") || lower.includes("not allowed") ||
          lower.includes("missing or invalid") || lower.includes("upgrade")) {
        return { ok: false, reason: "plan", message: msg };
      }
      if (lower.includes("no transactions") || lower.includes("no record") ||
          lower.includes("0 transactions")) {
        return { ok: false, reason: "no_data", message: "No transactions" };
      }
      return { ok: false, reason: "no_data", message: msg };
    }

    return { ok: true, data: Array.isArray(data.result) ? data.result : [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "error", message };
  }
}

// ─── Public fetch functions ───────────────────────────────────────

export async function fetchEtherscanTxList(
  address:    string,
  chainId:    number,
  apiKey:     string,
  page      = 1,
  offset    = 100,
  startBlock = 0
): Promise<EtherscanTx[]> {
  const result = await escanFetchSafe<EtherscanTx>(chainId, {
    module:     "account",
    action:     "txlist",
    address,
    startblock: String(startBlock),
    endblock:   "99999999",
    page:       String(page),
    offset:     String(offset),
    sort:       "desc",
  }, apiKey);
  return result.ok ? result.data : [];
}

export async function fetchEtherscanTokenTxList(
  address:  string,
  chainId:  number,
  apiKey:   string,
  page    = 1,
  offset  = 100
): Promise<EtherscanTokenTx[]> {
  const result = await escanFetchSafe<EtherscanTokenTx>(chainId, {
    module: "account",
    action: "tokentx",
    address,
    page:   String(page),
    offset: String(offset),
    sort:   "desc",
  }, apiKey);
  return result.ok ? result.data : [];
}

export interface ChainFetchStats {
  chainId:   number;
  chainSlug: string;
  status:    "success" | "no_data" | "rate_limit" | "plan" | "error";
  txCount:   number;
}

export interface AllChainsResult {
  chains:    MultiChainHistoryResult[];
  stats:     ChainFetchStats[];
  freeTierLimited: boolean; // true if any chain was blocked by plan
}

/**
 * Fetch transactions across all free-tier chains in parallel.
 * Each chain is independently fault-isolated.
 * Returns detailed per-chain stats alongside the merged results.
 */
export async function fetchAllChainsHistory(
  address: string,
  apiKey:  string,
  page   = 1
): Promise<AllChainsResult> {
  const results = await Promise.allSettled(
    FREE_TIER_CHAINS.map(async (chain): Promise<{
      chain:    MultiChainHistoryResult;
      txStatus: "success" | "no_data" | "rate_limit" | "plan" | "error";
      tokStatus:"success" | "no_data" | "rate_limit" | "plan" | "error";
    }> => {
      const [txResult, tokResult] = await Promise.all([
        escanFetchSafe<EtherscanTx>(chain.chainId, {
          module: "account", action: "txlist", address,
          startblock: "0", endblock: "99999999",
          page: String(page), offset: "100", sort: "desc",
        }, apiKey),
        escanFetchSafe<EtherscanTokenTx>(chain.chainId, {
          module: "account", action: "tokentx", address,
          page: String(page), offset: "100", sort: "desc",
        }, apiKey),
      ]);

      const txs     = txResult.ok     ? txResult.data     : [];
      const tokenTxs = tokResult.ok   ? tokResult.data    : [];

      return {
        chain: {
          txs, tokenTxs,
          chainId:   chain.chainId,
          chainSlug: chain.slug,
          chainName: chain.name,
          explorer:  chain.explorer,
          color:     chain.color,
          emoji:     chain.emoji,
        },
        txStatus:  txResult.ok  ? (txResult.data.length > 0 ? "success" : "no_data")  : txResult.reason,
        tokStatus: tokResult.ok ? (tokResult.data.length > 0 ? "success" : "no_data") : tokResult.reason,
      };
    })
  );

  const chains:    MultiChainHistoryResult[] = [];
  const stats:     ChainFetchStats[]         = [];
  let freeTierLimited = false;

  results.forEach((r, i) => {
    const chain = FREE_TIER_CHAINS[i];
    if (!isFulfilled(r)) {
      stats.push({ chainId: chain.chainId, chainSlug: chain.slug, status: "error", txCount: 0 });
      return;
    }

    const { chain: chainResult, txStatus, tokStatus } = r.value;
    const worstStatus = [txStatus, tokStatus].includes("plan")       ? "plan"
                      : [txStatus, tokStatus].includes("rate_limit") ? "rate_limit"
                      : [txStatus, tokStatus].includes("error")      ? "error"
                      : [txStatus, tokStatus].includes("success")    ? "success"
                      : "no_data";

    if (worstStatus === "plan") freeTierLimited = true;

    const txCount = chainResult.txs.length + chainResult.tokenTxs.length;
    stats.push({ chainId: chain.chainId, chainSlug: chain.slug, status: worstStatus, txCount });

    // Only include chains that have actual data
    if (txCount > 0) chains.push(chainResult);
  });

  return { chains, stats, freeTierLimited };
}