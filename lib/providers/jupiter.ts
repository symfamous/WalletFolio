/**
 * lib/providers/jupiter.ts
 *
 * Jupiter Portfolio API — free API for Solana DeFi positions.
 *
 * Endpoint: GET https://api.jup.ag/portfolio/v1/positions?wallet={address}
 * Auth: x-api-key header (free key at https://portal.jup.ag)
 * Docs: https://docs.jup.ag
 *
 * Returns positions across all major Solana protocols:
 *   Marinade, Jito, Raydium, Orca, Francium, Solend, Marginfi, Drift, etc.
 *
 * This is the PRIMARY source for Solana DeFi — much better coverage than
 * Helius (which only returns wallet tokens).
 */

const JUPITER_PORTFOLIO_API = "https://api.jup.ag/portfolio/v1";
const JUPITER_API_BASE      = "https://api.jup.ag";

// ─── Types ─────────────────────────────────────────────────────────

export interface JupiterPosition {
  protocol:        string;
  protocolSlug:    string;
  type:            "stake" | "lp" | "lend" | "borrow" | "DCA" | "limitOrder" | " PerpFarming" | string;
  token: {
    symbol:    string;
    mint:      string;
    decimals:  number;
    coingeckoId?: string;
  };
  amount:          string;        // raw amount as string
  amountUsd?:     number;
  rewards?: Array<{
    symbol:    string;
    mint:      string;
    decimals:  number;
    amount:    string;
    amountUsd?: number;
  }>;
  poolAddress?:   string;
  farmAddress?:    string;
}

export interface JupiterPortfolioResponse {
  positions:  JupiterPosition[];
  totalValue: number;
  totalValueUsd?: number;
}

// ─── Fetcher ───────────────────────────────────────────────────────

async function jupiterFetch<T>(
  url: string,
  apiKey?: string,
  timeoutMs = 20_000,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (apiKey) headers["x-api-key"] = apiKey;

  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Jupiter Portfolio API ${res.status}: ${text}`);
    }
    return res.json() as T;
  } finally {
    clearTimeout(tid);
  }
}

/**
 * Fetch all DeFi positions for a Solana wallet via Jupiter Portfolio API.
 * Returns empty array if no positions or API key not configured.
 */
export async function fetchJupiterPortfolio(
  address: string,
  apiKey?: string,
): Promise<JupiterPosition[]> {
  if (!apiKey) {
    console.info("[jupiter] No API key configured — skipping Solana DeFi");
    return [];
  }

  // Try path-based endpoint first (might be more reliable), then query-based
  const url = `${JUPITER_PORTFOLIO_API}/positions/${address}`;

  try {
    const data = await jupiterFetch<JupiterPortfolioResponse>(url, apiKey);
    const count = data?.positions?.length ?? 0;
    console.info(`[jupiter] ${count} DeFi positions for ${address.slice(0, 8)}...`);
    if (count > 0) {
      console.info(`[jupiter] First position: ${JSON.stringify(data.positions[0]).slice(0, 200)}`);
    }
    return data.positions ?? [];
  } catch (err) {
    // Log full response to diagnose
    console.warn("[jupiter] Portfolio fetch failed:", err);
    return [];
  }
}
