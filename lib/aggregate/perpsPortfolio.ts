import type { NormalizedPosition, PerpsApiResponse, Portfolio } from "../../types/index.ts";
import { aggregateHoldings, buildChainAllocations } from "./holdings.ts";

const HYPERLIQUID_PERPS_PROTOCOL_ID = "hyperliquid-perps";
const PERP_EQUITY_ID = "hyperliquid-perp-equity";

/**
 * Live Hyperliquid account value from the perps feed, or `null` when no live
 * Hyperliquid data is present (feed loading / platform absent). Returning `null`
 * — rather than 0 — lets callers keep the portfolio's snapshot value instead of
 * wrongly zeroing perp equity while the perps request is still in flight.
 */
function getHyperliquidAccountValue(perpsData?: PerpsApiResponse | null): number | null {
  const hyperliquid = perpsData?.platforms.find((platform) => platform.platform.toLowerCase() === "hyperliquid");
  if (!hyperliquid?.accountSummary) return null;
  const accountValue = hyperliquid.accountSummary.accountValue ?? 0;
  const withdrawable = hyperliquid.accountSummary.withdrawable ?? 0;
  return Math.max(0, accountValue, withdrawable);
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

  // Live perp equity. `null` means no live data → leave the snapshot untouched.
  const liveAccountValue = getHyperliquidAccountValue(perpsData);
  if (liveAccountValue === null) return portfolio;

  // The portfolio route may already carry a "hyperliquid-perp-equity" position
  // (a snapshot taken when the portfolio was fetched). Reconcile that single
  // position to the live value — in BOTH directions — so the displayed total
  // tracks perp price movement up and down, not just up.
  const existingIdx = portfolio.walletPositions.findIndex((p) => p.id === PERP_EQUITY_ID);
  const existingValue = existingIdx >= 0 ? portfolio.walletPositions[existingIdx].usdValue ?? 0 : 0;

  // Nothing to reconcile: no live perp exposure and none in the snapshot.
  if (existingIdx < 0 && liveAccountValue <= 0) return portfolio;

  const delta = liveAccountValue - existingValue;
  // Already in sync (within a cent) — avoid needless re-renders.
  if (existingIdx >= 0 && Math.abs(delta) < 0.01) return portfolio;

  const hyperliquidPerpPosition = buildHyperliquidPerpPosition(liveAccountValue);
  const walletPositions =
    existingIdx >= 0
      ? portfolio.walletPositions.map((p, i) => (i === existingIdx ? hyperliquidPerpPosition : p))
      : [...portfolio.walletPositions, hyperliquidPerpPosition];

  const allNonLiabilityPositions = [...walletPositions, ...portfolio.defiPositions];
  const aggregated = aggregateHoldings([...allNonLiabilityPositions, ...portfolio.liabilities]);
  const totalUsdValue = Math.max(0, portfolio.summary.totalUsdValue + delta);
  const walletUsdValue = Math.max(0, portfolio.summary.walletUsdValue + delta);
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
      walletUsdValue,
      activeChainCount: activeChains.size,
      pricedAssetCount,
      totalAssetCount,
      largestHolding: aggregated.find((holding) => holding.totalUsdValue > 0),
    },
  };
}
