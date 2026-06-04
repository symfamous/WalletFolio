/**
 * lib/providers/morpho.ts
 *
 * Morpho Offchain API — SUPPLEMENTAL provider for Morpho vault/market positions.
 *
 * Why this exists:
 * Zerion may not yet fully index Morpho positions on newer chains like HyperEVM
 * (chain ID 999). This provider queries the Morpho GraphQL API directly to surface
 * positions Zerion misses, especially MetaMorpho vault deposits (e.g. uETH on HyperEVM).
 *
 * Zerion remains PRIMARY. Morpho data is merged only when Zerion lacks it.
 * Deduplication happens at the protocol level: if Zerion already returned a
 * Morpho position for a given chain, we skip that chain's Morpho API data.
 *
 * API: https://api.morpho.org/graphql (public, no auth required)
 * Docs: https://docs.morpho.org/tools/offchain/api/morpho
 */

const MORPHO_GRAPHQL = "https://api.morpho.org/graphql";

// All chains where Morpho is deployed — query all in parallel
export const MORPHO_CHAIN_IDS: number[] = [
  1,       // Ethereum
  8453,    // Base
  42161,   // Arbitrum
  137,     // Polygon
  10,      // Optimism
  534352,  // Scroll
  999,     // HyperEVM / Hyperliquid ← the one we need for uETH
];

// Map numeric chain ID → Zerion slug for normalization
export const MORPHO_CHAIN_ID_TO_SLUG: Record<number, string> = {
  1:       "ethereum",
  8453:    "base",
  42161:   "arbitrum",
  10:      "optimism",
  137:     "polygon",
  534352:  "scroll",
  999:     "hyper-evm",
};

// ─── GraphQL response types ───────────────────────────────────────

interface MorphoAsset {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  priceUsd: number | null;
}

interface MorphoVault {
  address: string;
  name: string;
  symbol: string;
  asset: MorphoAsset;
}

export interface MorphoVaultPosition {
  vault: MorphoVault;
  assets: string;     // bigint as string — underlying asset amount (not shares)
  assetsUsd: number | null;
  shares: string;
}

interface MorphoMarket {
  uniqueKey: string;
  loanAsset:       MorphoAsset;
  collateralAsset: MorphoAsset | null;
}

export interface MorphoMarketPosition {
  market: MorphoMarket;
  state: {
    supplyAssets:    string;
    supplyAssetsUsd: number | null;
    borrowAssets:    string;
    borrowAssetsUsd: number | null;
    collateral:      string;
    collateralUsd:   number | null;
  };
}

export interface MorphoUserData {
  chainId:          number;
  address:          string;
  vaultPositions:   MorphoVaultPosition[];
  marketPositions:  MorphoMarketPosition[];
}

// ─── GraphQL query ────────────────────────────────────────────────

const USER_QUERY = `
  query FolioUserPositions($chainId: Int!, $address: String!) {
    userByAddress(chainId: $chainId, address: $address) {
      address
      vaultPositions {
        vault {
          address
          name
          symbol
          asset {
            address
            symbol
            name
            decimals
            priceUsd
          }
        }
        assets
        assetsUsd
        shares
      }
      marketPositions {
        market {
          uniqueKey
          loanAsset { address symbol name decimals priceUsd }
          collateralAsset { address symbol name decimals priceUsd }
        }
        state {
          supplyAssets
          supplyAssetsUsd
          borrowAssets
          borrowAssetsUsd
          collateral
          collateralUsd
        }
      }
    }
  }
`;

async function fetchMorphoForChain(
  address: string,
  chainId: number
): Promise<MorphoUserData | null> {
  try {
    const res = await fetch(MORPHO_GRAPHQL, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body:    JSON.stringify({ query: USER_QUERY, variables: { chainId, address } }),
      signal:  AbortSignal.timeout(10_000),
      // @ts-ignore — Next.js extends RequestInit with `next`
      next:    { revalidate: 60 },
    });

    if (!res.ok) {
      console.warn(`[morpho] HTTP ${res.status} for chain ${chainId}`);
      return null;
    }

    const body: {
      data?: { userByAddress?: {
        address: string;
        vaultPositions:  MorphoVaultPosition[];
        marketPositions: MorphoMarketPosition[];
      } };
      errors?: Array<{ message: string }>;
    } = await res.json();

    if (body.errors?.length) {
      // Some chain IDs may not be supported — treat as empty, not an error
      console.debug(`[morpho] chain ${chainId}: ${body.errors[0].message}`);
      return null;
    }

    const user = body.data?.userByAddress;
    if (!user) return null;

    // Filter out empty positions
    const vaultPositions = (user.vaultPositions ?? []).filter(
      (p) => BigInt(p.assets ?? "0") > BigInt(0) || (p.assetsUsd ?? 0) > 0
    );
    const marketPositions = (user.marketPositions ?? []).filter(
      (p) =>
        BigInt(p.state?.supplyAssets ?? "0") > BigInt(0) ||
        BigInt(p.state?.borrowAssets ?? "0") > BigInt(0) ||
        BigInt(p.state?.collateral   ?? "0") > BigInt(0)
    );

    if (vaultPositions.length === 0 && marketPositions.length === 0) return null;

    return { chainId, address: user.address, vaultPositions, marketPositions };
  } catch (err) {
    console.warn(`[morpho] fetch failed chain ${chainId}:`, err);
    return null;
  }
}

/**
 * Fetch Morpho positions for an address across all supported chains.
 * Runs all chain queries in parallel. Returns only chains with actual positions.
 */
export async function fetchMorphoPositions(
  address: string
): Promise<MorphoUserData[]> {
  const results = await Promise.allSettled(
    MORPHO_CHAIN_IDS.map((chainId) => fetchMorphoForChain(address, chainId))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<MorphoUserData> =>
      r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value);
}