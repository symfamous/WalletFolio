/**
 * lib/providers/moralis.ts
 *
 * Moralis API — FALLBACK provider for EVM token balances.
 *
 * Triggered when Zerion + Zapper both fail/are unavailable.
 * Uses paginated token balances endpoint from deep-index.moralis.io/api/v2.2
 *
 * Docs: https://docs.moralis.com/
 * API:  https://deep-index.moralis.io/api/v2.2
 * Auth: X-API-Key: {API_KEY}
 * Free tier: 100 credits/day
 */

import { ProviderRequestError, runProviderTask, untrackedFetchJson } from "@/lib/providers/resilience";

const MORALIS_BASE = "https://deep-index.moralis.io/api/v2.2";

// ─── Moralis chain names for wallet tokens API ─────────────────

const MORALIS_CHAINS = [
  "eth", "arbitrum", "base", "polygon", "bsc", "optimism", "avalanche", "hyperevm",
];

// ─── Main fetcher ─────────────────────────────────────────────

/**
 * Fetch ALL ERC20 token balances for an EVM address across multiple chains.
 * Uses paginated cursor-based iteration per chain.
 * Returns raw token array — caller normalizes.
 */
export async function fetchMoralisTokens(address: string, apiKey: string): Promise<unknown[]> {
  return runProviderTask("moralis", async () => {
    const byChain = await Promise.allSettled(
      MORALIS_CHAINS.map(async (chain) => {
        const chainTokens: unknown[] = [];
        let cursor: string | null = null;
        let pageCount = 0;

        do {
          const params = new URLSearchParams({
            chain,
            exclude_spam: "false",
            exclude_unverified_contracts: "false",
            limit: "100",
          });
          if (cursor) params.append("cursor", cursor);

          const data = await untrackedFetchJson<{ result?: unknown[]; cursor?: string | null }>(
            "moralis",
            `${MORALIS_BASE}/wallets/${address}/tokens?${params}`,
            {
              headers: { "X-API-Key": apiKey, Accept: "application/json" },
            },
            { timeoutMs: 2_500 }
          );

          if (data.result?.length) {
            chainTokens.push(...data.result);
          }
          cursor = data.cursor ?? null;
          pageCount += 1;
        } while (cursor && pageCount < 2);

        return { chain, tokens: chainTokens };
      })
    );

    const allTokens: unknown[] = [];
    for (const result of byChain) {
      if (result.status === "fulfilled") {
        allTokens.push(...result.value.tokens);
      } else {
        const message = result.reason instanceof ProviderRequestError ? result.reason.message : result.reason;
        console.warn("[moralis] chain fetch failed:", message);
      }
    }

    console.info(`[moralis] ${allTokens.length} tokens across ${MORALIS_CHAINS.length} chains`);
    return allTokens;
  });
}
