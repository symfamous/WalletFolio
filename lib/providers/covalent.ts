/**
 * lib/providers/covalent.ts
 *
 * Covalent API — SUPPLEMENTAL provider for EVM DeFi positions.
 *
 * Why this exists:
 * Zerion may not cover certain chains or protocols. Covalent provides broad
 * DeFi coverage across 100+ chains with a generous free tier.
 *
 * Docs: https://www.covalenthq.com/docs/api/
 * Free tier: 100 credits/day, 1M credits/month on free plan
 *
 * API: https://api.covalenthq.com/v1/
 * Auth: Authorization: Bearer {API_KEY} header
 */

import {
  ProviderRequestError,
  runProviderTask,
  untrackedFetchJson,
} from "@/lib/providers/resilience";

const COVALENT_BASE = "https://api.covalenthq.com/v1";

// Minimum USD value threshold — positions below this are ignored to reduce noise
const MIN_USD_VALUE = 5;

// ─── Chain ID mapping ──────────────────────────────────────────────

// Covalent uses numeric chain IDs
// NOTE: Base Sepolia (84532) returns HTTP 410 Gone — removed
// NOTE: Optimism (10) and Polygon (137) consistently timeout — removed
export const COVALENT_CHAIN_IDS = [
  1,       // Ethereum
  42161,   // Arbitrum
  8453,    // Base
  43114,   // Avalanche C-Chain
];

// Map Covalent chain ID → Zerion-compatible slug
export const COVALENT_CHAIN_ID_TO_SLUG: Record<number, string> = {
  1:       "ethereum",
  42161:   "arbitrum",
  10:      "optimism",
  137:     "polygon",
  8453:    "base",
  43114:   "avalanche",
  84532:   "base-sepolia",
};

// ─── API response types ───────────────────────────────────────────

interface CovalentToken {
  contract_decimals: number;
  contract_ticker_symbol: string;
  contract_name: string;
  contract_address: string;
  logo_url?: string;
  supports_erc?: string[];
  token_id?: string;
}

interface CovalentQuote {
  price: number;
  price_timestamp: string;
}

interface CovalentBalanceItem {
  contract_address: string;
  balance: string;
  total_supply?: string;
  token: CovalentToken;
  quote: CovalentQuote;
  nft_data?: unknown[];
}

interface CovalentPortfolioItem {
  contract_address: string;
  decimals: number;
  token_id: string;
  token: CovalentToken;
  type: string;
  holdings: Array<{
    date: string;
    open: { balance: string; quote: number };
    high: { balance: string; quote: number };
    low: { balance: string; quote: number };
    close: { balance: string; quote: number };
  }>;
}

interface CovalentDeFiProtocol {
  protocol_name: string;
  protocol_logo: string;
  categories: string[];
  chain_id: number;
  dex_name?: string;
  possible_tokens?: string[];
}

interface CovalentDefiPosition {
  contract_address: string;
  token: CovalentToken;
  holdings: Array<{
    date: string;
    open: { balance: string; quote: number };
    high: { balance: string; quote: number };
    low: { balance: string; quote: number };
    close: { balance: string; quote: number };
  }>;
  airdropped_token?: {
    contract_address: string;
    contract_ticker_symbol: string;
    logo_url?: string;
  };
  reward_tokens?: Array<{
    contract_address: string;
    contract_ticker_symbol: string;
    logo_url?: string;
  }>;
}

interface CovalentDeFiData {
  update_at: string;
  quotes_in: string;
  protocol_id: string;
  protocol_name: string;
  protocol_logo: string;
  chain_id: number;
  positions: CovalentDefiPosition[];
}

interface CovalentAddressData {
  address: string;
  updated_at: string;
  next_update_at: string;
  quote_currency: string;
  chain_id: number;
  items: CovalentBalanceItem[];
}

interface CovalentDefiResponse {
  data: {
    items: CovalentDeFiData[];
  };
  error: boolean;
  error_message?: string;
}

// ─── Fetch helpers ────────────────────────────────────────────────

async function covalentFetch<T>(
  url: string,
  apiKey: string
): Promise<T | null> {
  try {
    return await untrackedFetchJson<T>(
      "covalent",
      url,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      },
      { timeoutMs: 2_500 }
    );
  } catch (err) {
    const message = err instanceof ProviderRequestError ? err.message : err;
    console.warn(`[covalent] fetch failed for ${url}:`, message);
    return null;
  }
}

// ─── Main fetcher ─────────────────────────────────────────────────

export interface CovalentDefiResult {
  positions: CovalentDeFiData[];
  chainsQueried: number;
  chainsWithData: number;
}

/**
 * Fetch DeFi positions for an EVM address across multiple chains.
 * Uses Covalent's DeFi protocol metadata + portfolio data.
 * Queries chains sequentially to avoid rate limiting (429s).
 */
export async function fetchCovalentDefiPositions(
  address: string,
  apiKey: string
): Promise<CovalentDefiResult> {
  return runProviderTask("covalent", async () => {
    const results = await Promise.allSettled(
      COVALENT_CHAIN_IDS.map(async (chainId) => {
        const url = `${COVALENT_BASE}/${chainId}/address/${address}/portfolio_v2/`;
        const data = await covalentFetch<CovalentDefiResponse>(url, apiKey);

        if (!data?.data?.items?.length) {
          console.info(`[covalent] chain ${chainId}: no data`);
          return [] as CovalentDeFiData[];
        }

        return data.data.items
          .filter((item) => {
            if (!item.positions?.length) return false;
            return item.positions.some((pos) => {
              const latest = pos.holdings[pos.holdings.length - 1];
              if (!latest) return false;
              const balance = parseFloat(latest.close.balance);
              return balance > 0 && latest.close.quote >= MIN_USD_VALUE;
            });
          })
          .map((item) => ({ ...item, chain_id: chainId }));
      })
    );

    const allDefiData: CovalentDeFiData[] = [];
    let chainsWithData = 0;

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value.length > 0) chainsWithData += 1;
        allDefiData.push(...result.value);
      } else {
        const message = result.reason instanceof ProviderRequestError ? result.reason.message : result.reason;
        console.warn("[covalent] chain fetch failed:", message);
      }
    }

    return {
      positions: allDefiData,
      chainsQueried: COVALENT_CHAIN_IDS.length,
      chainsWithData,
    };
  });
}

// ─── Token balances fetcher (for additional data) ───────────────────

interface CovalentBalanceResponse {
  data: CovalentAddressData;
  error: boolean;
  error_message?: string;
}

export async function fetchCovalentBalances(
  address: string,
  chainId: number,
  apiKey: string
): Promise<CovalentBalanceItem[]> {
  const url = `${COVALENT_BASE}/${chainId}/address/${address}/balances_v2/`;
  const data = await covalentFetch<CovalentBalanceResponse>(url, apiKey);
  return data?.data?.items ?? [];
}
