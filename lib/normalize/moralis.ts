/**
 * lib/normalize/moralis.ts
 *
 * Converts Moralis token data → NormalizedPosition[].
 * Moralis tokens are returned per-chain — all treated as wallet positions.
 * Prices are not in the response — computed from the Zerion price map when available.
 */

import type { NormalizedPosition } from "@/types";
import { getChainInfo } from "@/lib/chains/registry";

interface MoralisTokenItem {
  token_address?:  string;
  name?:          string;
  symbol?:        string;
  decimals?:      number;
  logo?:          string;
  thumbnail?:     string;
  balance?:       string;
}

const STABLE = new Set([
  "USDC","USDT","DAI","FRAX","PYUSD","crvUSD","GHO","LUSD","USDE",
  "USDbC","USDBC","USDB","XDAI","FDUSD","USDD","GUSD","TUSD","USDP",
]);

function isStable(symbol: string): boolean {
  return STABLE.has(symbol?.toUpperCase() ?? "");
}

export interface MoralisNormalizeResult {
  positions: NormalizedPosition[];
}

/**
 * Normalize Moralis raw token array to NormalizedPosition[].
 * pricesFromZerion — token price map from Zerion (symbol → USD price).
 */
export function normalizeMoralisTokens(
  rawTokens: unknown[],
  pricesFromZerion?: Record<string, number>
): MoralisNormalizeResult {
  const positions: NormalizedPosition[] = [];

  for (const item of rawTokens) {
    const token = item as MoralisTokenItem;
    if (!token?.symbol) continue;

    const decimals = token.decimals ?? 18;
    const rawBalance = token.balance ?? "0";
    const balance = parseFloat(rawBalance) / Math.pow(10, decimals);
    if (balance <= 0) continue;

    const symbol = token.symbol ?? "???";
    const name = token.name ?? symbol;

    // Try to get price from Zerion map; Moralis tokens endpoint doesn't include price
    const price = pricesFromZerion?.[symbol.toUpperCase()] ?? 0;
    const usdValue = price > 0 ? balance * price : undefined;

    // Filter dust
    if (usdValue !== undefined && usdValue < 5 && !isStable(symbol)) continue;

    // Moralis doesn't return chain per token in the simple endpoint — tag as "ethereum" by default
    // The tokens array from Moralis doesn't include chain info in each item
    const chainSlug = "ethereum";
    const chainInfo = getChainInfo(chainSlug);

    positions.push({
      id:              `moralis-${token.token_address ?? symbol}-${chainSlug}`,
      symbol,
      name,
      logo:            token.logo ?? token.thumbnail,
      contractAddress: token.token_address ?? "0x0000000000000000000000000000000000000000",
      decimals,
      rawBalance,
      chainSlug,
      chainName:       chainInfo.name,
      chainColor:      chainInfo.color,
      chainEmoji:      chainInfo.emoji,
      balance,
      price:           price > 0 ? price : undefined,
      priceChange24h:  undefined,
      usdValue,
      priceAvailable:  price > 0,
      source:          "wallet",
      positionType:    "wallet",
      isLiability:     false,
      isNative:        false,
      isStablecoin:    isStable(symbol),
      isSpam:          false,
      isVerified:      true,
      dataSource:      "moralis",
    });
  }

  return { positions };
}
