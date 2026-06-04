/**
 * lib/providers/graph/defi.ts
 *
 * The Graph subgraph queries for EVM DeFi positions:
 *   - Aave v3 (supply/borrow/rewards)
 *   - Compound v3 (supply/borrow)
 *   - Uniswap v3 (LP positions)
 *
 * These supplement Zerion when it returns sparse or no DeFi data.
 */

import { SUBGRAPHS, querySubgraph } from "./index";
import type { NormalizedPosition } from "@/types";
import { getChainInfo } from "@/lib/chains/registry";

// ─── Aave v3 ─────────────────────────────────────────────────────

const AAVE_USER_QUERY = `
  query AaveUserPositions($address: String!) {
    account(id: $address) {
      id
      deposits(orderBy: valueUSD, orderDirection: desc) {
        id
        market { id symbol name underlyingAsset { id symbol decimals priceUsd } }
        tokens { id balance amountUSD }
      }
      borrowings(orderBy: valueUSD, orderDirection: desc) {
        id
        market { id symbol name underlyingAsset { id symbol decimals priceUsd } }
        tokens { id balance amountUSD }
      }
      rewards(orderBy: valueUSD, orderDirection: desc) {
        id
        asset { id symbol decimals }
        rewardAmount
        rewardAmountUSD
      }
    }
  }
`;

// ─── Compound v3 ─────────────────────────────────────────────────

const COMPOUND_USER_QUERY = `
  query CompoundUserPositions($address: String!) {
    account(id: $address) {
      id
      tokens(orderBy: valueUSD, orderDirection: desc) {
        id
        symbol
        name
        underlyingAsset { id symbol decimals }
        market { id cToken }
        supplyBalance
        supplyValueUSD
        borrowBalance
        borrowValueUSD
      }
      rewards {
        id
        asset { id symbol }
        amount
        amountUSD
      }
    }
  }
`;

// ─── Uniswap v3 ──────────────────────────────────────────────────

const UNISWAP_V3_POSITIONS_QUERY = `
  query UniswapV3Positions($address: String!) {
    positions(where: { owner: $address, liquidity_gt: 0 }) {
      id
      token0 { id symbol decimals }
      token1 { id symbol decimals }
      feeTier
      liquidity
      depositedToken0
      depositedToken1
      withdrawnToken0
      withdrawnToken1
    }
  }
`;

// ─── Result type ──────────────────────────────────────────────────

export interface GraphDefiPosition {
  protocolId: string;
  protocolName: string;
  chainSlug: string;
  chainName: string;
  chainColor: string;
  type: "deposit" | "borrow" | "staked" | "lp" | "reward";
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  usdValue: number | undefined;
  price: number | undefined;
}

// ─── Aave v3 fetcher ─────────────────────────────────────────────

interface AaveMarketToken {
  id: string;
  symbol: string;
  name: string;
  underlyingAsset: {
    id: string;
    symbol: string;
    decimals: string;
    priceUsd: string;
  };
}

async function fetchAaveForNetwork(
  address: string,
  networkKey: string,
  apiKey: string
): Promise<GraphDefiPosition[]> {
  const subgraph = SUBGRAPHS[`aave-v3-${networkKey}`];
  if (!subgraph) return [];

  const data = await querySubgraph<{
    account?: {
      deposits: Array<{
        id: string;
        market: AaveMarketToken;
        tokens: Array<{ id: string; balance: string; amountUSD: string }>;
      }>;
      borrowings: Array<{
        id: string;
        market: AaveMarketToken;
        tokens: Array<{ id: string; balance: string; amountUSD: string }>;
      }>;
      rewards: Array<{
        id: string;
        asset: { id: string; symbol: string; decimals: string };
        rewardAmount: string;
        rewardAmountUSD: string;
      }>;
    };
  }>(subgraph, AAVE_USER_QUERY, { address: address.toLowerCase() }, apiKey);

  const positions: GraphDefiPosition[] = [];
  const chainInfo = getChainInfo(networkKey);

  // Deposits
  for (const dep of data?.account?.deposits ?? []) {
    const market = dep.market;
    const asset = market.underlyingAsset;
    const token = dep.tokens?.[0];
    const bal = parseFloat(token?.balance ?? "0") / Math.pow(10, parseInt(asset.decimals ?? "18"));
    const usd = parseFloat(token?.amountUSD ?? "0");

    if (bal > 0) {
      positions.push({
        protocolId: "aave-v3",
        protocolName: `Aave v3`,
        chainSlug: networkKey,
        chainName: chainInfo.name,
        chainColor: chainInfo.color,
        type: "deposit",
        tokenAddress: asset.id,
        symbol: asset.symbol,
        name: market.name || asset.symbol,
        decimals: parseInt(asset.decimals ?? "18"),
        balance: bal,
        usdValue: usd || undefined,
        price: parseFloat(asset.priceUsd ?? "0") || undefined,
      });
    }
  }

  // Borrows
  for (const bor of data?.account?.borrowings ?? []) {
    const market = bor.market;
    const asset = market.underlyingAsset;
    const token = bor.tokens?.[0];
    const bal = parseFloat(token?.balance ?? "0") / Math.pow(10, parseInt(asset.decimals ?? "18"));
    const usd = parseFloat(token?.amountUSD ?? "0");

    if (bal > 0) {
      positions.push({
        protocolId: "aave-v3",
        protocolName: `Aave v3`,
        chainSlug: networkKey,
        chainName: chainInfo.name,
        chainColor: chainInfo.color,
        type: "borrow",
        tokenAddress: asset.id,
        symbol: asset.symbol,
        name: market.name || asset.symbol,
        decimals: parseInt(asset.decimals ?? "18"),
        balance: bal,
        usdValue: usd || undefined,
        price: parseFloat(asset.priceUsd ?? "0") || undefined,
      });
    }
  }

  // Rewards
  for (const rew of data?.account?.rewards ?? []) {
    const bal = parseFloat(rew.rewardAmount ?? "0") / Math.pow(10, parseInt(rew.asset.decimals ?? "18"));
    const usd = parseFloat(rew.rewardAmountUSD ?? "0");

    if (bal > 0) {
      positions.push({
        protocolId: "aave-v3",
        protocolName: `Aave v3`,
        chainSlug: networkKey,
        chainName: chainInfo.name,
        chainColor: chainInfo.color,
        type: "reward",
        tokenAddress: rew.asset.id,
        symbol: rew.asset.symbol,
        name: rew.asset.symbol,
        decimals: parseInt(rew.asset.decimals ?? "18"),
        balance: bal,
        usdValue: usd || undefined,
        price: usd && bal > 0 ? usd / bal : undefined,
      });
    }
  }

  return positions;
}

// ─── Compound v3 fetcher ──────────────────────────────────────────

async function fetchCompoundForNetwork(
  address: string,
  networkKey: string,
  apiKey: string
): Promise<GraphDefiPosition[]> {
  const subgraph = SUBGRAPHS[`compound-v3-${networkKey}`];
  if (!subgraph) return [];

  const data = await querySubgraph<{
    account?: {
      tokens: Array<{
        id: string;
        symbol: string;
        name: string;
        underlyingAsset: { id: string; symbol: string; decimals: string };
        supplyBalance: string;
        supplyValueUSD: string;
        borrowBalance: string;
        borrowValueUSD: string;
      }>;
      rewards: Array<{
        id: string;
        asset: { id: string; symbol: string };
        amount: string;
        amountUSD: string;
      }>;
    };
  }>(subgraph, COMPOUND_USER_QUERY, { address: address.toLowerCase() }, apiKey);

  const positions: GraphDefiPosition[] = [];
  const chainInfo = getChainInfo(networkKey);

  for (const tok of data?.account?.tokens ?? []) {
    const asset = tok.underlyingAsset;
    const decimals = parseInt(asset.decimals ?? "18");

    // Supply position
    const supplyBal = parseFloat(tok.supplyBalance ?? "0") / Math.pow(10, decimals);
    const supplyUsd = parseFloat(tok.supplyValueUSD ?? "0");
    if (supplyBal > 0) {
      positions.push({
        protocolId: "compound-v3",
        protocolName: `Compound v3`,
        chainSlug: networkKey,
        chainName: chainInfo.name,
        chainColor: chainInfo.color,
        type: "deposit",
        tokenAddress: asset.id,
        symbol: asset.symbol,
        name: tok.name || asset.symbol,
        decimals,
        balance: supplyBal,
        usdValue: supplyUsd || undefined,
        price: supplyUsd && supplyBal > 0 ? supplyUsd / supplyBal : undefined,
      });
    }

    // Borrow position
    const borrowBal = parseFloat(tok.borrowBalance ?? "0") / Math.pow(10, decimals);
    const borrowUsd = parseFloat(tok.borrowValueUSD ?? "0");
    if (borrowBal > 0) {
      positions.push({
        protocolId: "compound-v3",
        protocolName: `Compound v3`,
        chainSlug: networkKey,
        chainName: chainInfo.name,
        chainColor: chainInfo.color,
        type: "borrow",
        tokenAddress: asset.id,
        symbol: asset.symbol,
        name: tok.name || asset.symbol,
        decimals,
        balance: borrowBal,
        usdValue: borrowUsd || undefined,
        price: borrowUsd && borrowBal > 0 ? borrowUsd / borrowBal : undefined,
      });
    }
  }

  // Rewards
  for (const rew of data?.account?.rewards ?? []) {
    const bal = parseFloat(rew.amount ?? "0");
    const usd = parseFloat(rew.amountUSD ?? "0");
    if (bal > 0) {
      positions.push({
        protocolId: "compound-v3",
        protocolName: `Compound v3`,
        chainSlug: networkKey,
        chainName: chainInfo.name,
        chainColor: chainInfo.color,
        type: "reward",
        tokenAddress: rew.asset.id,
        symbol: rew.asset.symbol,
        name: rew.asset.symbol,
        decimals: 18,
        balance: bal,
        usdValue: usd || undefined,
        price: usd && bal > 0 ? usd / bal : undefined,
      });
    }
  }

  return positions;
}

// ─── Uniswap v3 LP fetcher ────────────────────────────────────────

async function fetchUniswapV3ForNetwork(
  address: string,
  networkKey: string,
  apiKey: string
): Promise<GraphDefiPosition[]> {
  const subgraph = SUBGRAPHS[`uniswap-v3-${networkKey}`];
  if (!subgraph) return [];

  const data = await querySubgraph<{
    positions: Array<{
      id: string;
      token0: { id: string; symbol: string; decimals: string };
      token1: { id: string; symbol: string; decimals: string };
      feeTier: string;
      liquidity: string;
      depositedToken0: string;
      depositedToken1: string;
    }>;
  }>(subgraph, UNISWAP_V3_POSITIONS_QUERY, { address: address.toLowerCase() }, apiKey);

  const positions: GraphDefiPosition[] = [];
  const chainInfo = getChainInfo(networkKey);

  for (const pos of data?.positions ?? []) {
    if (parseFloat(pos.liquidity) <= 0) continue;

    const decimals0 = parseInt(pos.token0.decimals ?? "18");
    const decimals1 = parseInt(pos.token1.decimals ?? "18");
    const bal0 = parseFloat(pos.depositedToken0) / Math.pow(10, decimals0);
    const bal1 = parseFloat(pos.depositedToken1) / Math.pow(10, decimals1);

    // Create LP position entries for each token
    for (const [tok, bal, dec] of [
      [pos.token0, bal0, decimals0],
      [pos.token1, bal1, decimals1],
    ] as const) {
      if (bal > 0) {
        positions.push({
          protocolId: "uniswap-v3",
          protocolName: `Uniswap V3 (${pos.feeTier}%)`,
          chainSlug: networkKey,
          chainName: chainInfo.name,
          chainColor: chainInfo.color,
          type: "lp",
          tokenAddress: tok.id,
          symbol: tok.symbol,
          name: tok.symbol,
          decimals: dec,
          balance: bal,
          usdValue: undefined, // LP positions need price oracle for USD value
          price: undefined,
        });
      }
    }
  }

  return positions;
}

// ─── Main EVM DeFi fetcher ────────────────────────────────────────

const NETWORKS = ["ethereum", "arbitrum-one"];

export async function fetchGraphDefiPositions(
  address: string,
  apiKey: string
): Promise<GraphDefiPosition[]> {
  if (!apiKey) return [];

  const results = await Promise.allSettled(
    NETWORKS.flatMap((network) => [
      fetchAaveForNetwork(address, network, apiKey),
      fetchCompoundForNetwork(address, network, apiKey),
      fetchUniswapV3ForNetwork(address, network, apiKey),
    ])
  );

  return results
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .filter((p) => p.balance > 0);
}
