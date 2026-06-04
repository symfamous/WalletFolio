/**
 * lib/normalize/zapper.ts
 *
 * Converts Zapper portfolioV2 data → NormalizedPosition[].
 * Uses network.name to determine chain, tokenAddress for contract.
 */

import type { NormalizedPosition } from "@/types";
import type { ZapperResult } from "@/lib/providers/zapper";
import { getChainInfo } from "@/lib/chains/registry";

// ─── Zapper network name → internal chain slug ─────────────────

const ZAPPER_NETWORK_MAP: Record<string, string> = {
  "Ethereum Mainnet":     "ethereum",
  "Arbitrum One":         "arbitrum",
  "Arbitrum":             "arbitrum",
  "Optimism":             "optimism",
  "Base":                 "base",
  "Polygon":              "polygon",
  "Avalanche":            "avalanche",
  "Gnosis":               "gnosis",
  "Fantom":               "fantom",
  "Cronos":              "cronos",
  "Boba":                "boba",
  "zkSync Era":          "zksync-era",
  "Metis":               "metis",
  "Linea":               "linea",
  "Scroll":              "scroll",
  "Blast":               "blast",
  "Mode":                "mode",
  "Hyperliquid":         "hyperliquid",
  "HyperEVM":           "hyper-evm",
  "Mainnet":            "ethereum",     // catch-all for unknown
};

const STABLE = new Set([
  "USDC","USDT","DAI","FRAX","PYUSD","crvUSD","GHO","LUSD","USDE",
  "USDbC","USDBC","USDB","XDAI","FDUSD","USDD","GUSD","TUSD","USDP",
]);

function isStable(symbol: string): boolean {
  return STABLE.has(symbol?.toUpperCase() ?? "");
}

export interface ZapperNormalizeResult {
  positions: NormalizedPosition[];
}

export function normalizeZapperTokens(result: ZapperResult): ZapperNormalizeResult {
  const positions: NormalizedPosition[] = [];
  const edges = result.portfolio?.tokenBalances?.byToken?.edges ?? [];

  for (const edge of edges) {
    const node = edge?.node;
    if (!node) continue;

    const balance = parseFloat(node.balance);
    if (balance <= 0) continue;

    const symbol = node.symbol ?? "???";
    const name = node.name ?? symbol;
    const usdValue = node.balanceUSD;

    // Filter dust — below $5 and not a stablecoin
    if (usdValue < 5 && !isStable(symbol)) continue;

    const networkName = node.network?.name ?? "Mainnet";
    const chainSlug = ZAPPER_NETWORK_MAP[networkName] ?? ZAPPER_NETWORK_MAP[networkName.replace(/\s+/g, "")] ?? "ethereum";
    const chain = getChainInfo(chainSlug);

    positions.push({
      id:              `zapper-${node.tokenAddress ?? symbol}-${chainSlug}`,
      symbol,
      name,
      logo:            undefined,
      contractAddress: node.tokenAddress ?? "0x0000000000000000000000000000000000000000",
      decimals:        18,
      rawBalance:      node.balance,
      chainSlug,
      chainName:       chain.name,
      chainColor:      chain.color,
      chainEmoji:      chain.emoji,
      balance,
      price:           node.price > 0 ? node.price : (usdValue > 0 && balance > 0 ? usdValue / balance : undefined),
      priceChange24h:  undefined,
      usdValue,
      priceAvailable:  node.price > 0 || usdValue > 0,
      source:          "wallet",
      positionType:    "wallet",
      isLiability:     false,
      isNative:        false,
      isStablecoin:    isStable(symbol),
      isSpam:          false,
      isVerified:      true,
      dataSource:      "zapper",
    });
  }

  return { positions };
}
