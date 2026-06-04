/**
 * lib/normalize/graph/defi.ts
 *
 * Converts Graph DeFi subgraph positions → NormalizedPosition + ProtocolPosition.
 */

import type {
  NormalizedPosition,
  ProtocolPosition,
  ProtocolCategory,
} from "@/types";
import type { GraphDefiPosition } from "@/lib/providers/graph/defi";

const STABLE = new Set([
  "USDC","USDT","DAI","FRAX","PYUSD","crvUSD","GHO","LUSD","USDE",
  "USDbC","USDBC","USDB","XDAI","FDUSD","USDD","GUSD","TUSD","USDP",
]);

function isStable(symbol: string): boolean {
  return STABLE.has(symbol?.toUpperCase() ?? "");
}

function sumUsd(positions: NormalizedPosition[]): number {
  return positions.reduce((s, p) => s + (p.usdValue ?? 0), 0);
}

export interface GraphDefiNormalizeResult {
  positions: NormalizedPosition[];
  protocols: ProtocolPosition[];
}

export function normalizeGraphDefiPositions(
  positions: GraphDefiPosition[]
): GraphDefiNormalizeResult {
  const allPositions: NormalizedPosition[] = [];

  for (const pos of positions) {
    const priceAvailable = (pos.price ?? 0) > 0;
    const usdValue = pos.usdValue ?? (pos.price ? pos.balance * pos.price : undefined);

    const positionType = pos.type === "deposit" ? "deposit"
      : pos.type === "borrow" ? "borrow"
      : pos.type === "reward" ? "reward"
      : pos.type === "staked" ? "staked"
      : "lp";

    allPositions.push({
      id: `graph-${pos.protocolId}-${pos.chainSlug}-${pos.tokenAddress}-${pos.type}`,
      symbol: pos.symbol,
      name: pos.name,
      logo: undefined,
      contractAddress: pos.tokenAddress,
      decimals: pos.decimals,
      rawBalance: String(pos.balance * Math.pow(10, pos.decimals)),
      chainSlug: pos.chainSlug,
      chainName: pos.chainName,
      chainColor: pos.chainColor,
      chainEmoji: "",
      balance: pos.balance,
      price: pos.price,
      priceChange24h: undefined,
      usdValue,
      priceAvailable,
      source: "defi",
      positionType,
      isLiability: pos.type === "borrow",
      isNative: false,
      isStablecoin: isStable(pos.symbol),
      isSpam: false,
      isVerified: true,
      dataSource: "bitquery",
      protocolId: pos.protocolId,
      protocolName: pos.protocolName,
    });
  }

  // Build protocol groups
  const byKey = new Map<string, NormalizedPosition[]>();

  for (const pos of allPositions) {
    const key = `${pos.chainSlug}-${pos.protocolId}`;
    const existing = byKey.get(key) ?? [];
    existing.push(pos);
    byKey.set(key, existing);
  }

  const protocols: ProtocolPosition[] = [];

  for (const [key, protoPositions] of byKey) {
    const [chainSlug, protocolId] = key.split("-");
    const deposits = protoPositions.filter((p) => !p.isLiability && p.positionType !== "wallet");
    const borrows = protoPositions.filter((p) => p.isLiability);

    const category: ProtocolCategory =
      borrows.length > 0 && deposits.length > 0 ? "lending"
      : borrows.length > 0 ? "borrowing"
      : protoPositions[0]?.positionType === "lp" ? "liquidity"
      : "vault";

    protocols.push({
      id: `graph-${key}`,
      protocolId,
      protocolName: protoPositions[0]?.protocolName ?? protocolId,
      protocolLogo: undefined,
      dataSource: "bitquery",
      chainSlug,
      chainName: protoPositions[0]?.chainName ?? chainSlug,
      chainColor: protoPositions[0]?.chainColor ?? "#5a78a0",
      chainEmoji: protoPositions[0]?.chainEmoji ?? "",
      category,
      deposits,
      borrows,
      rewards: protoPositions.filter((p) => p.positionType === "reward"),
      staked: protoPositions.filter((p) => p.positionType === "staked"),
      locked: [],
      totalDepositUsd: sumUsd(deposits),
      totalBorrowUsd: sumUsd(borrows),
      totalRewardUsd: sumUsd(protoPositions.filter((p) => p.positionType === "reward")),
      totalStakedUsd: sumUsd(protoPositions.filter((p) => p.positionType === "staked")),
      netUsdValue: sumUsd(deposits) - sumUsd(borrows),
    });
  }

  return { positions: allPositions, protocols };
}
