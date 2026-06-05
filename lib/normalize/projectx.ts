/**
 * lib/normalize/projectx.ts
 *
 * Normalizes ProjectX (Uniswap V3 on HyperEVM) LP positions.
 *
 * LP valuation: LP token balance × LP token price.
 * LP price = pool TVL (USD) / total liquidity (virtual units).
 * This correctly tracks the market value of LP tokens as they fluctuate with pool composition.
 */

import type { NormalizedPosition, ProtocolPosition } from "@/types";
import type { FetchProjectXPositionsResult } from "@/lib/providers/projectx";
import { getChainInfo } from "@/lib/chains/registry";

const MIN_USD_VALUE = 5;

export interface ProjectXNormalizeResult {
  positions: NormalizedPosition[];
  protocols: ProtocolPosition[];
}

export function normalizeProjectXData(
  data: FetchProjectXPositionsResult,
  poolPrices: Record<string, { token0Usd: number; token1Usd: number; tvlUsd: number; poolLiquidity: string; lpPriceUsd: number }>
): ProjectXNormalizeResult {
  const chain = getChainInfo(data.chainSlug);
  const allPositions: NormalizedPosition[] = [];

  for (const pos of data.positions) {
    const priceInfo = poolPrices[pos.pool.id];
    if (!priceInfo) continue;

    // LP value = LP token balance × LP token price
    // LP price = pool TVL (USD) / total liquidity (virtual units)
    // This correctly tracks the market value of LP tokens (not proportional share of TVL)
    const { lpPriceUsd } = priceInfo;
    const balance = Number(pos.liquidity) / Math.pow(10, 18);
    const usdValue = balance * lpPriceUsd;

    if (usdValue < MIN_USD_VALUE) continue;

    const posId = `projectx-${pos.id}`;

    // Push a single combined LP position (not separate token sides)
    const lpSymbol = `${pos.pool.token0.symbol}-${pos.pool.token1.symbol} LP`;

    allPositions.push({
      id: posId,
      symbol: lpSymbol,
      name: lpSymbol,
      logo: undefined,
      contractAddress: pos.pool.id, // pool address as position identifier
      decimals: 18, // LP tokens are typically 18 decimals
      rawBalance: pos.liquidity,
      chainSlug: data.chainSlug,
      chainName: chain.name,
      chainColor: chain.color,
      chainEmoji: chain.emoji,
      balance,
      price: lpPriceUsd,
      priceChange24h: undefined,
      usdValue,
      priceAvailable: true,
      source: "defi",
      positionType: "lp",
      isLiability: false,
      isNative: false,
      isStablecoin: false,
      isSpam: false,
      isVerified: true,
      dataSource: "projectx",
      protocolId: "projectx",
      protocolName: "ProjectX",
    });
  }

  // Build protocol grouping
  const deposits = allPositions.filter((p) => !p.isLiability);
  const protocols: ProtocolPosition[] = [{
    id: "projectx",
    protocolId: "projectx",
    protocolName: "ProjectX",
    protocolLogo: undefined,
    dataSource: "projectx",
    chainSlug: data.chainSlug,
    chainName: chain.name,
    chainColor: chain.color,
    chainEmoji: chain.emoji,
    category: "liquidity",
    deposits,
    borrows: [],
    rewards: [],
    staked: [],
    locked: [],
    totalDepositUsd: deposits.reduce((s, p) => s + (p.usdValue ?? 0), 0),
    totalBorrowUsd: 0,
    totalRewardUsd: 0,
    totalStakedUsd: 0,
    netUsdValue: deposits.reduce((s, p) => s + (p.usdValue ?? 0), 0),
  }];

  return { positions: allPositions, protocols };
}
