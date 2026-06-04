/**
 * lib/normalize/hyperliquid.ts
 *
 * Normalizes Hyperliquid spot/DEX balances for portfolio holdings.
 *
 * Spot token balances (e.g. HYPE) held on Hyperliquid L1.
 * USDC withdrawable is shown in Perps section, not here.
 */

import type { NormalizedPosition, ProtocolPosition } from "@/types";
import { MIN_VISIBLE_USD } from "@/types";
import type { HyperliquidSpotResult } from "@/lib/providers/perps/hyperliquid";

const MIN_USD_VALUE = MIN_VISIBLE_USD;
const HYPERLIQUID_CHAIN_SLUG  = "hyperliquid";
const HYPERLIQUID_CHAIN_NAME = "Hyperliquid";
const HYPERLIQUID_CHAIN_COLOR = "#00FF79";
const HYPERLIQUID_CHAIN_EMOJI = "🔵";

export interface HyperliquidNormalizeResult {
  positions: NormalizedPosition[];
  protocols: ProtocolPosition[];
}

const KNOWN_HYPERLIQUID_ASSETS: Record<string, { name?: string; logo?: string }> = {
  HYPE:  { name: "Hyperliquid", logo: "/tokens/hype.svg" },
  WHYPE: { name: "Wrapped Hyperliquid", logo: "/tokens/hype.svg" },
};

/**
 * Token decimals for known Hyperliquid tokens.
 * Fallback to 18 if unknown.
 */
function getTokenDecimals(symbol: string): number {
  const known: Record<string, number> = {
    USDC: 6,
    USDT: 6,
    HYPE: 18,
    WETH: 18,
    WBTC: 8,
  };
  return known[symbol.toUpperCase()] ?? 18;
}

export function normalizeHyperliquidSpot(
  data: HyperliquidSpotResult,
  tokenPrices: Record<string, number> = {}
): HyperliquidNormalizeResult {
  const positions: NormalizedPosition[] = [];

  // Spot token balances (HYPE, WETH, etc.) — USDC is normalized as perp equity below.
  for (const bal of data.balances) {
    if (bal.total <= 0) continue;
    // Skip USDC here so the same Hyperliquid cash balance appears once as perp equity.
    if (bal.coin.toUpperCase() === "USDC") continue;

    const coin = bal.coin.toUpperCase();
    const knownAsset = KNOWN_HYPERLIQUID_ASSETS[coin];
    const isCoreHyperliquidAsset = coin === "HYPE" || coin === "WHYPE";
    const price = tokenPrices[coin] ?? (isCoreHyperliquidAsset ? (bal.price ?? 0) : 0);
    const usdValue = price > 0 ? bal.total * price : undefined;
    // Show if: has USD value >= threshold, OR is HYPE/WHYPE (always show core HL asset)
    if (usdValue !== undefined && usdValue < MIN_USD_VALUE && !isCoreHyperliquidAsset) continue;
    if (usdValue === undefined && !isCoreHyperliquidAsset && bal.total < 0.001) continue;

    const decimals = getTokenDecimals(bal.coin);
    const posId = `hyperliquid-${bal.coin.toLowerCase()}`;

    positions.push({
      id:              posId,
      symbol:          bal.coin,
      name:            (typeof bal.fullName === "string" && bal.fullName) ? bal.fullName : (knownAsset?.name ?? bal.coin),
      logo:            knownAsset?.logo,
      contractAddress: typeof bal.evmContract === "string" ? bal.evmContract.toLowerCase() : bal.coin.toLowerCase(),
      decimals,
      fungibleId:      bal.tokenId,
      chainSlug:       HYPERLIQUID_CHAIN_SLUG,
      chainName:       HYPERLIQUID_CHAIN_NAME,
      chainColor:      HYPERLIQUID_CHAIN_COLOR,
      chainEmoji:      HYPERLIQUID_CHAIN_EMOJI,
      balance:         bal.total,
      rawBalance:      String(Math.round(bal.total * Math.pow(10, decimals))),
      price:           price,
      priceChange24h:  isCoreHyperliquidAsset ? bal.priceChange24h : undefined,
      priceAvailable:  price > 0,
      usdValue,
      source:          "wallet",
      positionType:    "wallet",
      isLiability:     false,
      isNative:        false,
      isStablecoin:    false,
      isSpam:          false,
      isVerified:      true,
      dataSource:      "hyperliquid",
      protocolId:      "hyperliquid",
      protocolName:    "Hyperliquid",
    });
  }

  // Build protocol grouping
  const deposits = positions.filter((p) => !p.isLiability);
  const protocols: ProtocolPosition[] = [{
    id:             "hyperliquid",
    protocolId:     "hyperliquid",
    protocolName:   "Hyperliquid",
    protocolLogo:   undefined,
    dataSource:     "hyperliquid",
    chainSlug:      HYPERLIQUID_CHAIN_SLUG,
    chainName:      HYPERLIQUID_CHAIN_NAME,
    chainColor:     HYPERLIQUID_CHAIN_COLOR,
    chainEmoji:     HYPERLIQUID_CHAIN_EMOJI,
    category:       "dex",
    deposits,
    borrows:        [],
    rewards:        [],
    staked:         [],
    locked:         [],
    totalDepositUsd: deposits.reduce((s, p) => s + (p.usdValue ?? 0), 0),
    totalBorrowUsd:  0,
    totalRewardUsd:  0,
    totalStakedUsd:  0,
    netUsdValue:     deposits.reduce((s, p) => s + (p.usdValue ?? 0), 0),
  }];

  return { positions, protocols };
}

export function normalizeHyperliquidPerpEquity(
  data: Pick<HyperliquidSpotResult, "accountValue" | "totalMarginUsed" | "withdrawable" | "spotUsdc">
): NormalizedPosition | null {
  const accountValueUsd = data.accountValue ?? 0;
  const marginUsedUsd = data.totalMarginUsed ?? 0;
  const withdrawableUsd = data.withdrawable ?? 0;
  const spotUsdc = data.spotUsdc ?? 0;
  const equityUsd = Math.max(accountValueUsd, marginUsedUsd, withdrawableUsd, spotUsdc);
  if (equityUsd <= 0) return null;

  return {
    id:              "hyperliquid-perp-equity",
    symbol:          "USDC",
    name:            "Hyperliquid Perp Equity",
    contractAddress: "hyperliquid-perp-equity",
    decimals:        6,
    chainSlug:       HYPERLIQUID_CHAIN_SLUG,
    chainName:       HYPERLIQUID_CHAIN_NAME,
    chainColor:      HYPERLIQUID_CHAIN_COLOR,
    chainEmoji:      HYPERLIQUID_CHAIN_EMOJI,
    balance:         equityUsd,
    rawBalance:      String(Math.round(equityUsd * 1_000_000)),
    price:           1,
    priceAvailable:  true,
    usdValue:        equityUsd,
    source:          "wallet",
    positionType:    "wallet",
    isLiability:     false,
    isNative:        false,
    isStablecoin:    true,
    isSpam:          false,
    isVerified:      true,
    dataSource:      "hyperliquid",
    protocolId:      "hyperliquid-perps",
    protocolName:    "Hyperliquid Perps",
  };
}
