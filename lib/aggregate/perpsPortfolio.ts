import type { NormalizedPosition, PerpsApiResponse, Portfolio } from "../../types/index.ts";
import { aggregateHoldings, buildChainAllocations } from "./holdings.ts";

const HYPERLIQUID_PERPS_PROTOCOL_ID = "hyperliquid-perps";

function getExistingHyperliquidPerpValue(portfolio: Portfolio): number {
  return [...portfolio.walletPositions, ...portfolio.defiPositions]
    .filter((position) => position.protocolId === HYPERLIQUID_PERPS_PROTOCOL_ID && !position.isLiability)
    .reduce((sum, position) => sum + (position.usdValue ?? 0), 0);
}

function getHyperliquidAccountValue(perpsData?: PerpsApiResponse | null): number {
  const hyperliquid = perpsData?.platforms.find((platform) => platform.platform.toLowerCase() === "hyperliquid");
  const accountValue = hyperliquid?.accountSummary?.accountValue ?? 0;
  const withdrawable = hyperliquid?.accountSummary?.withdrawable ?? 0;
  return Math.max(accountValue, withdrawable);
}

function buildHyperliquidPerpPosition(accountValueUsd: number): NormalizedPosition {
  return {
    id: "hyperliquid-perp-equity",
    symbol: "USDC",
    name: "Hyperliquid Perp Equity",
    contractAddress: "hyperliquid-perp-equity",
    decimals: 6,
    chainSlug: "hyperliquid",
    chainName: "Hyperliquid",
    chainColor: "#00FF79",
    chainEmoji: "HL",
    balance: accountValueUsd,
    rawBalance: String(Math.round(accountValueUsd * 1_000_000)),
    price: 1,
    priceAvailable: true,
    usdValue: accountValueUsd,
    source: "wallet",
    positionType: "wallet",
    isLiability: false,
    isNative: false,
    isStablecoin: true,
    isSpam: false,
    isVerified: true,
    dataSource: "hyperliquid",
    protocolId: HYPERLIQUID_PERPS_PROTOCOL_ID,
    protocolName: "Hyperliquid Perps",
  };
}

export function portfolioWithPerpsAccountValue(
  portfolio: Portfolio | undefined,
  perpsData?: PerpsApiResponse | null
): Portfolio | undefined {
  if (!portfolio) return portfolio;

  const hyperliquidAccountValue = getHyperliquidAccountValue(perpsData);
  const existingHyperliquidValue = getExistingHyperliquidPerpValue(portfolio);
  const missingHyperliquidValue = Math.max(0, hyperliquidAccountValue - existingHyperliquidValue);

  if (missingHyperliquidValue <= 0) return portfolio;

  // The portfolio route may already carry a "hyperliquid-perp-equity" position.
  // Top that one up in place rather than appending a second position with the
  // same id (which double-renders and triggers React duplicate-key warnings).
  const PERP_EQUITY_ID = "hyperliquid-perp-equity";
  const existingIdx = portfolio.walletPositions.findIndex((p) => p.id === PERP_EQUITY_ID);
  const existingPerpEquityValue =
    existingIdx >= 0 ? portfolio.walletPositions[existingIdx].usdValue ?? 0 : 0;
  const hyperliquidPerpPosition = buildHyperliquidPerpPosition(
    existingPerpEquityValue + missingHyperliquidValue
  );
  const walletPositions =
    existingIdx >= 0
      ? portfolio.walletPositions.map((p, i) => (i === existingIdx ? hyperliquidPerpPosition : p))
      : [...portfolio.walletPositions, hyperliquidPerpPosition];

  const allNonLiabilityPositions = [...walletPositions, ...portfolio.defiPositions];
  const aggregated = aggregateHoldings([...allNonLiabilityPositions, ...portfolio.liabilities]);
  const totalUsdValue = portfolio.summary.totalUsdValue + missingHyperliquidValue;
  const activeChains = new Set(allNonLiabilityPositions.map((position) => position.chainSlug));
  // Only count a brand-new asset when we actually appended one.
  const addedNewAsset = existingIdx < 0 ? 1 : 0;
  const pricedAssetCount = portfolio.summary.pricedAssetCount + addedNewAsset;
  const totalAssetCount = portfolio.summary.totalAssetCount + addedNewAsset;

  return {
    ...portfolio,
    walletPositions,
    aggregated,
    chainAllocations: buildChainAllocations(allNonLiabilityPositions, totalUsdValue),
    summary: {
      ...portfolio.summary,
      totalUsdValue,
      walletUsdValue: portfolio.summary.walletUsdValue + missingHyperliquidValue,
      activeChainCount: activeChains.size,
      pricedAssetCount,
      totalAssetCount,
      largestHolding: aggregated.find((holding) => holding.totalUsdValue > 0),
    },
  };
}
