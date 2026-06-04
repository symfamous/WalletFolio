/**
 * lib/aggregate/portfolio.ts — Zerion only.
 * Dust filter: hides unpriced zero-value tokens by default (not just ≤$5 priced ones).
 */

import type {
  NormalizedPosition, ProtocolPosition, Portfolio, PortfolioSummary,
  AggregatedHolding, CalculatorResult,
} from "../../types/index.ts";
import { MIN_VISIBLE_USD } from "../../types/index.ts";
import {
  aggregateHoldings, buildChainAllocations, buildProtocolAllocations,
} from "./holdings.ts";

function isAlwaysVisibleWalletAsset(
  pos: Pick<NormalizedPosition, "dataSource" | "symbol" | "protocolId">
): boolean {
  const symbol = pos.symbol.toUpperCase();
  return (
    pos.protocolId === "hyperliquid-perps" ||
    (pos.dataSource === "hyperliquid" && (symbol === "HYPE" || symbol === "WHYPE"))
  );
}

function sumUsd(positions: NormalizedPosition[]): number {
  return positions.reduce((s, p) => s + (p.usdValue ?? 0), 0);
}

export function buildPortfolio(
  address:      string,
  allPositions: NormalizedPosition[],
  protocols:    ProtocolPosition[]
): Portfolio {
  const walletPositions = allPositions.filter((p) => p.source === "wallet" && !p.isLiability);
  const defiPositions   = allPositions.filter((p) => p.source === "defi"   && !p.isLiability);
  const liabilities     = allPositions.filter((p) => p.isLiability);
  const aggregated      = aggregateHoldings(allPositions);

  const walletUsd      = sumUsd(walletPositions);
  const defiDepositUsd = sumUsd(defiPositions.filter((p) => ["deposit","lp"].includes(p.positionType)));
  const defiRewardUsd  = sumUsd(defiPositions.filter((p) => p.positionType === "reward"));
  const defiStakedUsd  = sumUsd(defiPositions.filter((p) => ["staked","locked"].includes(p.positionType)));
  const defiBorrowUsd  = sumUsd(liabilities);

  const defiGrossUsd = defiDepositUsd + defiRewardUsd + defiStakedUsd;
  const defiNetUsd   = defiGrossUsd - defiBorrowUsd;
  const totalUsd     = walletUsd + defiGrossUsd;

  const pricedPositions = allPositions.filter(
    (p) => p.priceAvailable && !p.isLiability && (p.usdValue ?? 0) > 0
  );

  let change24h: number | undefined;
  let change24hAbsolute: number | undefined;

  if (pricedPositions.length > 0 && totalUsd > 0) {
    change24h = pricedPositions.reduce((sum, p) => {
      return sum + (p.priceChange24h ?? 0) * ((p.usdValue ?? 0) / totalUsd);
    }, 0);

    change24hAbsolute = pricedPositions.reduce((sum, p) => {
      if (!p.priceChange24h || !p.usdValue) return sum;
      return sum + (p.usdValue - p.usdValue / (1 + p.priceChange24h / 100));
    }, 0);
  }

  const allNonLiability     = [...walletPositions, ...defiPositions];
  const chainAllocations    = buildChainAllocations(allNonLiability, totalUsd);
  const protocolAllocations = buildProtocolAllocations(protocols, defiNetUsd);

  const activeChains    = [...new Set(allNonLiability.map((p) => p.chainSlug))];
  const activeProtocols = [...new Set(protocols.map((p) => p.protocolId))];
  const largestHolding  = aggregated.find((h) => h.totalUsdValue > 0);

  const summary: PortfolioSummary = {
    totalUsdValue:        totalUsd,
    walletUsdValue:       walletUsd,
    defiNetUsdValue:      defiNetUsd,
    totalBorrowUsdValue:  defiBorrowUsd,
    activeChainCount:     activeChains.length,
    activeProtocolCount:  activeProtocols.length,
    pricedAssetCount:     pricedPositions.length,
    totalAssetCount:      allPositions.filter((p) => !p.isLiability).length,
    change24h,
    change24hAbsolute,
    largestHolding,
  };

  return {
    address, walletPositions, defiPositions, liabilities, protocols,
    aggregated, chainAllocations, protocolAllocations, summary,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── Dust / ownership filter ──────────────────────────────────────
//
// Logic:
//   - Always show borrows (liability transparency)
//   - Hide unpriced tokens that have NO USD value reference — these are
//     typically spam/airdrop tokens with no real market value
//   - Hide priced tokens worth ≤ $5 (dust)
//   - The "Priced only" toggle is additional on top of this baseline
//
export function filterDust(
  aggregated: AggregatedHolding[],
  threshold   = MIN_VISIBLE_USD
): AggregatedHolding[] {
  return aggregated.filter((h) => {
    // Zero balance = definitely don't own it
    if (h.totalBalance <= 0) return false;

    const isSpecialAsset = h.positions.some((p) => isAlwaysVisibleWalletAsset(p));
    if (isSpecialAsset) return true;

    if (!h.priceAvailable) {
      // Unpriced: only show if it has real DeFi value (vault deposit etc.)
      // or if it's a known stablecoin or native asset
      const hasDefiValue = h.defiUsdValue > 0;
      const isKnownAsset = h.isNative || h.isStablecoin;
      return hasDefiValue || isKnownAsset || isSpecialAsset;
    }

    // Priced: hide dust
    return h.totalUsdValue > threshold;
  });
}

export function filterPositionsDust(
  positions: NormalizedPosition[],
  threshold  = MIN_VISIBLE_USD
): NormalizedPosition[] {
  return positions.filter((p) => {
    if (p.isLiability)     return true;  // always show borrows
    if (p.balance <= 0)    return false; // no balance = skip
    if (isAlwaysVisibleWalletAsset(p)) return true;
    if (!p.priceAvailable) {
      return p.isNative || p.isStablecoin || isAlwaysVisibleWalletAsset(p) || (p.usdValue ?? 0) > 0;
    }
    return (p.usdValue ?? 0) > threshold;
  });
}

// ─── Target price calculator ──────────────────────────────────────

export function calcTargetPrice(
  holding:           AggregatedHolding,
  targetPrice:       number,
  portfolioTotalUsd: number
): CalculatorResult {
  const totalBalance        = holding.totalBalance;
  const currentTokenValue   = holding.totalUsdValue;
  const projectedTokenValue = totalBalance * targetPrice;
  const tokenGainLoss       = projectedTokenValue - currentTokenValue;
  const tokenGainLossPct    = currentTokenValue > 0 ? (tokenGainLoss / currentTokenValue) * 100 : 0;
  const projectedPortfolio  = portfolioTotalUsd - currentTokenValue + projectedTokenValue;

  return {
    totalBalance,
    currentTokenValue,
    projectedTokenValue,
    tokenGainLoss,
    tokenGainLossPct,
    currentPortfolioValue:   portfolioTotalUsd,
    projectedPortfolioValue: projectedPortfolio,
    portfolioGainLoss:       projectedPortfolio - portfolioTotalUsd,
    portfolioGainLossPct:    portfolioTotalUsd > 0
      ? ((projectedPortfolio - portfolioTotalUsd) / portfolioTotalUsd) * 100 : 0,
  };
}
