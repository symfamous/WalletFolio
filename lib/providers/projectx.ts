/**
 * lib/providers/projectx.ts
 *
 * ProjectX (Uniswap V3 fork) on HyperEVM — positions via Goldsky subgraph.
 * Endpoint: https://api.goldsky.com/api/public/project_cmbbm2iwckb1b01t39xed236t/subgraphs/uniswap-v3-hyperevm-position/prod/gn
 * No auth required — public subgraph.
 *
 * Docs: https://prjxdocs.notion.site/
 */

const PROJECTX_SUBGRAPH_URL =
  "https://api.goldsky.com/api/public/project_cmbbm2iwckb1b01t39xed236t/subgraphs/uniswap-v3-hyperevm-position/prod/gn";

export const PROJECTX_CHAIN_ID = 999; // HyperEVM
export const PROJECTX_CHAIN_SLUG = "hyper-evm";

// ─── GraphQL Types ────────────────────────────────────────────────

interface ProjectXToken {
  id: string;
  symbol: string;
  decimals: string;
}

interface ProjectXPool {
  id: string;
  token0: ProjectXToken;
  token1: ProjectXToken;
}

interface ProjectXPosition {
  id: string;
  owner: string;
  pool: ProjectXPool;
  liquidity: string;
  depositedToken0: string;
  depositedToken1: string;
  withdrawnToken0: string;
  withdrawnToken1: string;
  collectedFeesToken0: string;
  collectedFeesToken1: string;
  tickLower: string;
  tickUpper: string;
}

// ─── Fetch ──────────────────────────────────────────────────────

interface ProjectXGraphQLResponse {
  data: {
    positions: ProjectXPosition[];
  };
  errors?: Array<{ message: string }>;
}

export interface ProjectXPositionResult {
  id: string;
  owner: string;
  pool: ProjectXPool;
  liquidity: string;
  depositedToken0: string;
  depositedToken1: string;
  withdrawnToken0: string;
  withdrawnToken1: string;
  collectedFeesToken0: string;
  collectedFeesToken1: string;
}

export interface PoolPriceInfo {
  token0Usd: number;
  token1Usd: number;
  tvlUsd: number;        // total pool TVL in USD
  poolLiquidity: string; // raw pool liquidity (virtual units)
  lpPriceUsd: number;    // LP token price = tvlUsd / poolLiquidity
}

export interface FetchProjectXPositionsResult {
  positions: ProjectXPositionResult[];
  chainSlug: string;
  poolPrices: Record<string, PoolPriceInfo>;
}

export async function fetchProjectXPositions(
  address: string
): Promise<FetchProjectXPositionsResult> {
  const positionsQuery = `
    query GetPositions($owner: String!) {
      positions(where: { owner: $owner }) {
        id
        owner
        pool {
          id
          token0 { id symbol decimals }
          token1 { id symbol decimals }
        }
        liquidity
        depositedToken0
        depositedToken1
        withdrawnToken0
        withdrawnToken1
        collectedFeesToken0
        collectedFeesToken1
        tickLower
        tickUpper
      }
    }
  `;

  // Fetch positions with retry on SSL/network errors
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(PROJECTX_SUBGRAPH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: positionsQuery, variables: { owner: address.toLowerCase() } }),
        signal: AbortSignal.timeout(20_000),
      });

      if (!res.ok) {
        throw new Error(`ProjectX subgraph HTTP ${res.status}`);
      }

      const json = (await res.json()) as ProjectXGraphQLResponse;

      if (json.errors?.length) {
        throw new Error(`ProjectX GraphQL error: ${json.errors[0].message}`);
      }

      console.info(`[projectx] positions query returned ${json.data.positions.length} items`);

      // Filter to only positions with non-zero liquidity (active positions)
      const activePositions = json.data.positions.filter(
        (p) => BigInt(p.liquidity) > BigInt(0)
      );
      console.info(`[projectx] ${activePositions.length} have liquidity > 0`);

      if (activePositions.length === 0) {
        console.info("[projectx] early return: no active positions");
        return { positions: [], chainSlug: PROJECTX_CHAIN_SLUG, poolPrices: {} };
      }

      // Fetch pool prices for each unique pool
      const poolIds = [...new Set(activePositions.map((p) => p.pool.id))];

      const poolsQuery = `
        query GetPools($ids: [String!]!) {
          pools(where: { id_in: $ids }) {
            id
            liquidity
            token0Price
            totalValueLockedToken0
            totalValueLockedToken1
            totalValueLockedETH
            totalValueLockedUSD
          }
        }
      `;

      const poolsRes = await fetch(PROJECTX_SUBGRAPH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: poolsQuery, variables: { ids: poolIds } }),
        signal: AbortSignal.timeout(20_000),
      });

      const poolsJson = (await poolsRes.json()) as {
        data: {
          pools: Array<{
            id: string;
            liquidity: string;
            token0Price: string;
            totalValueLockedToken0: string;
            totalValueLockedToken1: string;
            totalValueLockedETH: string;
            totalValueLockedUSD: string;
          }>;
        };
        errors?: Array<{ message: string }>;
      };

      const poolPrices: Record<string, PoolPriceInfo> = {};

      for (const pool of poolsJson.data.pools) {
        const token0Price = parseFloat(pool.token0Price); // token1/token0

        // For WHYPE/USDC and WHYPE/USD₮ pools: token1 is the stablecoin
        // token0Price = stablecoin/WHYPE → 1 WHYPE = token0Price stablecoins
        const token1Usd = 1; // stablecoin
        const token0Usd = token0Price;

        // Use totalValueLockedUSD if available (preferred), otherwise compute from token amounts
        let tvlUsd: number;
        if (pool.totalValueLockedUSD && parseFloat(pool.totalValueLockedUSD) > 0) {
          tvlUsd = parseFloat(pool.totalValueLockedUSD);
        } else {
          // Fallback: compute TVL from token amounts
          const tvlToken0 = parseFloat(pool.totalValueLockedToken0);
          const tvlToken1 = parseFloat(pool.totalValueLockedToken1);
          tvlUsd = tvlToken0 * token0Usd + tvlToken1 * token1Usd;
        }

        // LP token price = total pool TVL / total liquidity (virtual units)
        // This gives price per LP token unit
        const lpPriceUsd = Number(pool.liquidity) > 0
          ? tvlUsd / Number(pool.liquidity)
          : 0;

        poolPrices[pool.id] = {
          token0Usd,
          token1Usd,
          tvlUsd,
          poolLiquidity: pool.liquidity,
          lpPriceUsd,
        };
      }

      return {
        positions: activePositions,
        chainSlug: PROJECTX_CHAIN_SLUG,
        poolPrices,
      };
    } catch (err) {
      lastError = err;
      // Retry on next attempt
    }
  }

  // All attempts failed
  throw lastError;
}
