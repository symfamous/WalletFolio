/**
 * lib/providers/zapper.ts
 *
 * Zapper API — FALLBACK provider for EVM token balances.
 *
 * Triggered when Zerion returns 429 (rate limited) or 502 (error).
 * Uses GraphQL at https://public.zapper.xyz/graphql
 *
 * Docs: https://build.zapper.xyz/docs/api
 * Auth: x-zapper-api-key: {API_KEY}
 * Free tier: 100k calls/month on free plan
 */

import { ProviderRequestError, providerFetchJson } from "@/lib/providers/resilience";

const ZAPPER_GRAPHQL = "https://public.zapper.xyz/graphql";

// ─── API types ──────────────────────────────────────────────────

export interface ZapperToken {
  symbol:      string;
  name:        string;
  balance:     string;
  balanceUSD:  number;
  price:       number;
  tokenAddress: string;
  network: {
    name: string;
  };
}

export interface ZapperPortfolio {
  tokenBalances: {
    totalBalanceUSD: number;
    byToken: {
      edges: Array<{
        node: ZapperToken;
      }>;
    };
  };
}

export interface ZapperResult {
  portfolio: ZapperPortfolio | null;
  raw: unknown;
}

// ─── GraphQL fetch helper ───────────────────────────────────────

async function zapperGQL<T>(
  query: string,
  variables: Record<string, unknown>,
  apiKey: string
): Promise<T | null> {
  try {
    return await providerFetchJson<T>(
      "zapper",
      ZAPPER_GRAPHQL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-zapper-api-key": apiKey,
          Accept: "application/json",
        },
        body: JSON.stringify({ query, variables }),
      }
    );
  } catch (err) {
    const message = err instanceof ProviderRequestError ? err.message : err;
    console.warn("[zapper] fetch failed:", message);
    return null;
  }
}

// ─── Main fetcher ─────────────────────────────────────────────

const PORTFOLIO_QUERY = `
  query PortfolioV2($addresses: [Address!]!, $first: Int, $chainIds: [Int!]) {
    portfolioV2(addresses: $addresses, chainIds: $chainIds) {
      tokenBalances {
        totalBalanceUSD
        byToken(first: $first) {
          edges {
            node {
              symbol
              name
              balance
              balanceUSD
              price
              tokenAddress
              network {
                name
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Fetch wallet token balances across ALL chains via Zapper GraphQL API.
 * chainIds: null → all supported chains including Hyperliquid (911911)
 */
export async function fetchZapperTokens(
  address: string,
  apiKey: string
): Promise<ZapperResult | null> {
  const data = await zapperGQL<{ data?: { portfolioV2: ZapperPortfolio }; errors?: Array<{ message: string }> }>(
    PORTFOLIO_QUERY,
    { addresses: [address], first: 200, chainIds: null },
    apiKey
  );

  if (!data?.data?.portfolioV2?.tokenBalances?.byToken?.edges) {
    console.info(`[zapper] no token balances returned for ${address}`);
    return null;
  }

  const portfolio = data.data.portfolioV2;
  console.info(`[zapper] ${portfolio.tokenBalances.byToken.edges.length} tokens, totalUSD=${portfolio.tokenBalances.totalBalanceUSD}`);
  return { portfolio, raw: data };
}
