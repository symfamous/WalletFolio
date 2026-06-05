/**
 * lib/aggregate/holdings.ts
 *
 * Aggregates NormalizedPositions into AggregatedHoldings.
 *
 * Grouping priority:
 *   1. fungible:{zerionFungibleId}  — most trustworthy (Zerion canonical ID)
 *   2. stable:{SYMBOL}              — known stablecoins by symbol
 *   3. isolated:{chain}:{address}   — unknown tokens, kept per-chain
 *
 * Borrows (isLiability) are NEVER included in aggregated totals.
 */

import type {
  NormalizedPosition,
  AggregatedHolding,
  ChainAllocation,
  ProtocolAllocation,
  ProtocolPosition,
} from "../../types/index.ts";

const STABLE_SYMBOLS = new Set([
  "USDC","USDT","DAI","FRAX","TUSD","USDP","GUSD","LUSD",
  "USDD","USDE","PYUSD","crvUSD","GHO","USDBC","USDbC",
  "USDB","XDAI","CUSD","FDUSD",
]);

type UnderlyingExposure = {
  key: string;
  symbol: string;
  name: string;
};

const ETH_EXPOSURE_SYMBOLS = new Set([
  "ETH", "WETH", "UETH",
  "STETH", "WSTETH", "RETH", "CBETH", "OSETH", "SFRXETH", "FRXETH",
  "EZETH", "RSETH", "WEETH", "METH", "SWETH", "ANKRETH", "LSETH",
  "OETH", "YNETH", "PUFETH", "UNIFIETH", "BEDROCKETH",
]);

const SOL_EXPOSURE_SYMBOLS = new Set([
  "SOL", "WSOL", "MSOL", "JITOSOL", "BSOL", "JSOL", "JUPSOL", "HUBSOL", "INF",
]);

const BTC_EXPOSURE_SYMBOLS = new Set([
  "BTC", "WBTC", "CBBTC", "TBTC", "RENBTC", "LBTC", "EBTC", "SOLVBTC", "UNIBTC",
]);

function normalizeExposureSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function getUnderlyingExposure(pos: NormalizedPosition): UnderlyingExposure | null {
  const symbol = normalizeExposureSymbol(pos.symbol);

  if (ETH_EXPOSURE_SYMBOLS.has(symbol)) {
    return { key: "underlying:ETH", symbol: "ETH", name: "Ethereum Exposure" };
  }
  if (SOL_EXPOSURE_SYMBOLS.has(symbol)) {
    return { key: "underlying:SOL", symbol: "SOL", name: "Solana Exposure" };
  }
  if (BTC_EXPOSURE_SYMBOLS.has(symbol)) {
    return { key: "underlying:BTC", symbol: "BTC", name: "Bitcoin Exposure" };
  }

  return null;
}

function getAggMeta(pos: NormalizedPosition): { key: string; exposure: UnderlyingExposure | null } {
  if (pos.protocolId === "hyperliquid-perps") {
    return { key: `isolated:${pos.chainSlug}:${pos.contractAddress}`, exposure: null };
  }

  const exposure = getUnderlyingExposure(pos);
  if (exposure) return { key: exposure.key, exposure };

  if (pos.fungibleId) return { key: `fungible:${pos.fungibleId}`, exposure: null };
  if (pos.isStablecoin || STABLE_SYMBOLS.has(pos.symbol.toUpperCase()))
    return { key: `stable:${pos.symbol.toUpperCase()}`, exposure: null };
  return { key: `isolated:${pos.chainSlug}:${pos.contractAddress}`, exposure: null };
}

export function aggregateHoldings(positions: NormalizedPosition[]): AggregatedHolding[] {
  const map = new Map<string, AggregatedHolding>();

  for (const pos of positions) {
    if (pos.isLiability) continue;

    const { key, exposure } = getAggMeta(pos);

    if (!map.has(key)) {
      map.set(key, {
        aggregateKey:   key,
        symbol:         exposure?.symbol ?? pos.symbol,
        name:           exposure?.name ?? pos.name,
        logo:           pos.logo,
        fungibleId:     exposure ? undefined : pos.fungibleId,
        coingeckoId:    pos.coingeckoId,
        price:          pos.price,
        priceChange24h: pos.priceChange24h,
        priceAvailable: pos.priceAvailable,
        totalBalance:   0,
        totalUsdValue:  0,
        walletBalance:  0,
        walletUsdValue: 0,
        defiBalance:    0,
        defiUsdValue:   0,
        isNative:       pos.isNative,
        isStablecoin:   pos.isStablecoin,
        positions:      [],
      });
    }

    const agg = map.get(key)!;

    const normalizedBalance = exposure && agg.price && pos.usdValue !== undefined && agg.price > 0
      ? pos.usdValue / agg.price
      : pos.balance;

    agg.totalBalance  += normalizedBalance;
    agg.totalUsdValue += pos.usdValue ?? 0;

    if (pos.source === "wallet") {
      agg.walletBalance  += normalizedBalance;
      agg.walletUsdValue += pos.usdValue ?? 0;
    } else {
      agg.defiBalance  += normalizedBalance;
      agg.defiUsdValue += pos.usdValue ?? 0;
    }

    if (!agg.logo && pos.logo)             agg.logo          = pos.logo;
    if (!exposure && !agg.fungibleId && pos.fungibleId) agg.fungibleId = pos.fungibleId;
    if (!agg.price && pos.price)           agg.price         = pos.price;
    if (pos.priceChange24h !== undefined)  agg.priceChange24h = pos.priceChange24h;
    if (pos.priceAvailable)                agg.priceAvailable = true;

    agg.positions.push(pos);
  }

  // A holding can span several positions (same asset across chains, or grouped by
  // exposure like ETH+stETH+WETH). Its 24h change must be the USD-weighted blend of
  // its positions' changes — not whichever position happened to be processed last,
  // which made dust or wrapped legs dictate the headline number.
  for (const agg of map.values()) {
    let weightedChange = 0;
    let weightUsd = 0;
    for (const pos of agg.positions) {
      if (pos.priceChange24h === undefined) continue;
      const usd = pos.usdValue ?? 0;
      if (usd <= 0) continue;
      weightedChange += pos.priceChange24h * usd;
      weightUsd += usd;
    }
    if (weightUsd > 0) agg.priceChange24h = weightedChange / weightUsd;
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.totalUsdValue > 0 && b.totalUsdValue > 0) return b.totalUsdValue - a.totalUsdValue;
    if (a.totalUsdValue > 0) return -1;
    if (b.totalUsdValue > 0) return 1;
    return a.symbol.localeCompare(b.symbol);
  });
}

export function buildChainAllocations(
  positions: NormalizedPosition[],
  totalUsd:  number
): ChainAllocation[] {
  const map = new Map<string, ChainAllocation>();

  for (const pos of positions) {
    if (pos.isLiability) continue;

    if (!map.has(pos.chainSlug)) {
      map.set(pos.chainSlug, {
        chainSlug:     pos.chainSlug,
        chainName:     pos.chainName,
        chainColor:    pos.chainColor,
        chainEmoji:    pos.chainEmoji,
        totalUsdValue: 0,
        percentage:    0,
        tokenCount:    0,
      });
    }

    const a = map.get(pos.chainSlug)!;
    a.totalUsdValue += pos.usdValue ?? 0;
    a.tokenCount    += 1;
  }

  return Array.from(map.values())
    .map((a) => ({ ...a, percentage: totalUsd > 0 ? (a.totalUsdValue / totalUsd) * 100 : 0 }))
    .sort((a, b) => b.totalUsdValue - a.totalUsdValue);
}

export function buildProtocolAllocations(
  protocols: ProtocolPosition[],
  totalUsd:  number
): ProtocolAllocation[] {
  return protocols
    .filter((p) => p.netUsdValue > 0)
    .map((p) => ({
      protocolId:   p.protocolId,
      protocolName: p.protocolName,
      netUsdValue:  p.netUsdValue,
      percentage:   totalUsd > 0 ? (p.netUsdValue / totalUsd) * 100 : 0,
      category:     p.category,
      chainSlug:    p.chainSlug,
      chainName:    p.chainName,
      chainColor:   p.chainColor,
    }))
    .sort((a, b) => b.netUsdValue - a.netUsdValue);
}
