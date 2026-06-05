/**
 * lib/normalize/jupiter.ts
 *
 * Converts Jupiter Portfolio API positions → NormalizedPosition[] + ProtocolPosition[].
 *
 * Covers: Marinade, Jito, Raydium, Orca, Francium, Solend, Marginfi, Drift, etc.
 * Each position becomes a NormalizedPosition with source="defi" and protocolId set.
 * Protocol positions are grouped into ProtocolPosition objects.
 */

import type { NormalizedPosition, ProtocolPosition, ProtocolCategory } from "@/types";
import type { JupiterPosition } from "@/lib/providers/jupiter";

const SOLANA_CHAIN = {
  slug:  "solana",
  name:  "Solana",
  color: "#9945FF",
  emoji: "◎",
};

const STABLE_SYMBOLS = new Set(["USDC","USDT","DAI","USDR","USDH","UXD","USDP"]);

function isStable(symbol: string): boolean {
  return STABLE_SYMBOLS.has(symbol?.toUpperCase() ?? "");
}

function rawToFloat(raw: string, decimals: number): number {
  if (!raw || raw === "0") return 0;
  try {
    const d = Math.min(decimals, 18);
    const padded = raw.padStart(d + 1, "0");
    const intPart  = padded.slice(0, padded.length - d) || "0";
    const fracPart = padded.slice(padded.length - d);
    return parseFloat(`${intPart}.${fracPart}`);
  } catch {
    return parseFloat(raw) / Math.pow(10, decimals);
  }
}

function sumUsd(positions: NormalizedPosition[]): number {
  return positions.reduce((s, p) => s + (p.usdValue ?? 0), 0);
}

// ─── Protocol → human name ─────────────────────────────────────────

const PROTOCOL_NAMES: Record<string, string> = {
  marinade:      "Marinade Finance",
  jito:          "Jito",
  raydium:       "Raydium",
  orca:          "Orca",
  francium:      "Francium",
  solend:        "Solend",
  marginfi:      "Marginfi",
  drift:         "Drift",
  apricot:       "Apricot",
  port:          "Port Finance",
  sanctum:       "Sanctum",
  cactus:        "Cactus",
  lifinity:      "Lifinity",
  step:          "Step Finance",
  soluble:       "Soluble Finance",
};

function getProtocolName(slug: string, fallback: string): string {
  return PROTOCOL_NAMES[slug.toLowerCase()] ?? fallback ?? slug;
}

// ─── Position type → NormalizedPosition mapping ───────────────────

function positionTypeToUiType(jupiterType: string): NormalizedPosition["positionType"] {
  switch (jupiterType.toLowerCase()) {
    case "stake":       return "staked";
    case "lp":
    case "liquidity":  return "lp";
    case "lend":
    case "deposit":     return "deposit";
    case "borrow":      return "borrow";
    case "dca":         return "deposit";
    case "limitorder":
    case "limit_order": return "deposit";
    default:            return "deposit";
  }
}

// ─── Single Jupiter position → NormalizedPosition ─────────────────

function normalizeJupiterPosition(pos: JupiterPosition): NormalizedPosition {
  const decimals = pos.token.decimals ?? 9;
  const balance  = rawToFloat(pos.amount, decimals);
  const price    = pos.amountUsd && balance > 0 ? pos.amountUsd / balance : 0;
  const usdValue = pos.amountUsd ?? (price > 0 ? balance * price : undefined);

  const isLiability = ["borrow"].includes(pos.type.toLowerCase());

  return {
    id:              `jupiter-${pos.protocolSlug}-${pos.token.mint}-${pos.poolAddress ?? "unknown"}`,
    symbol:          pos.token.symbol,
    name:            pos.token.symbol,
    logo:            undefined,
    contractAddress: pos.token.mint,
    decimals,
    fungibleId:      pos.token.mint,
    coingeckoId:     pos.token.coingeckoId,

    chainSlug:   SOLANA_CHAIN.slug,
    chainName:   SOLANA_CHAIN.name,
    chainColor:  SOLANA_CHAIN.color,
    chainEmoji:  SOLANA_CHAIN.emoji,

    balance,
    rawBalance:  pos.amount,

    price:        price > 0 ? price : undefined,
    priceChange24h: undefined,
    usdValue,
    priceAvailable: price > 0,

    source:        "defi",
    positionType:  positionTypeToUiType(pos.type),
    isLiability,
    isNative:      false,
    isStablecoin:  isStable(pos.token.symbol),
    isSpam:        false,
    isVerified:    true,

    dataSource:    "jupiter",

    protocolId:   pos.protocolSlug,
    protocolName: getProtocolName(pos.protocolSlug, pos.protocol),
  };
}

// ─── Rewards → NormalizedPosition ─────────────────────────────────

function normalizeReward(
  reward: { symbol: string; mint: string; decimals: number; amount: string; amountUsd?: number },
  protocolSlug: string,
  protocolName: string,
): NormalizedPosition | null {
  if (!reward) return null;
  const decimals = reward.decimals ?? 9;
  const balance  = rawToFloat(reward.amount, decimals);
  if (balance <= 0) return null;

  return {
    id:              `jupiter-reward-${protocolSlug}-${reward.mint}`,
    symbol:          reward.symbol,
    name:            reward.symbol,
    logo:            undefined,
    contractAddress: reward.mint,
    decimals,
    fungibleId:      reward.mint,

    chainSlug:   SOLANA_CHAIN.slug,
    chainName:   SOLANA_CHAIN.name,
    chainColor:  SOLANA_CHAIN.color,
    chainEmoji:  SOLANA_CHAIN.emoji,

    balance,
    rawBalance:  reward.amount,

    price:        undefined,
    priceChange24h: undefined,
    usdValue:     reward.amountUsd,
    priceAvailable: false,

    source:        "defi",
    positionType:  "reward",
    isLiability:  false,
    isNative:      false,
    isStablecoin:  isStable(reward.symbol),
    isSpam:        false,
    isVerified:    true,

    dataSource:   "jupiter",

    protocolId:   protocolSlug,
    protocolName: `Rewards from ${protocolName}`,
  };
}

// ─── Build protocol groupings ──────────────────────────────────────

function buildJupiterProtocols(
  positions: NormalizedPosition[],
): ProtocolPosition[] {
  const byProtocol = new Map<string, NormalizedPosition[]>();

  for (const pos of positions) {
    if (!pos.protocolId) continue;
    const existing = byProtocol.get(pos.protocolId) ?? [];
    existing.push(pos);
    byProtocol.set(pos.protocolId, existing);
  }

  const protocols: ProtocolPosition[] = [];

  for (const [protocolId, protocolPositions] of byProtocol) {
    const deposits = protocolPositions.filter((p) => !p.isLiability && p.positionType !== "reward");
    const borrows  = protocolPositions.filter((p) => p.isLiability);
    const rewards  = protocolPositions.filter((p) => p.positionType === "reward");
    const staked  = protocolPositions.filter((p) => p.positionType === "staked");

    const hasBorrows = borrows.length > 0;
    const category: ProtocolCategory = hasBorrows ? "lending" : "vault";

    const protocolName = protocolPositions[0]?.protocolName ?? getProtocolName(protocolId, protocolId);

    protocols.push({
      id:              `jupiter-${protocolId}`,
      protocolId,
      protocolName,
      protocolLogo:    undefined,
      dataSource:      "jupiter",
      chainSlug:       SOLANA_CHAIN.slug,
      chainName:       SOLANA_CHAIN.name,
      chainColor:      SOLANA_CHAIN.color,
      chainEmoji:      SOLANA_CHAIN.emoji,
      category,
      deposits,
      borrows,
      rewards,
      staked,
      locked:   [],
      totalDepositUsd: sumUsd(deposits),
      totalBorrowUsd:  sumUsd(borrows),
      totalRewardUsd:  sumUsd(rewards),
      totalStakedUsd:  sumUsd(staked),
      netUsdValue:     sumUsd(deposits) + sumUsd(rewards) + sumUsd(staked) - sumUsd(borrows),
    });
  }

  return protocols;
}

// ─── Main normalizer ─────────────────────────────────────────────

export interface JupiterNormalizeResult {
  positions:  NormalizedPosition[];
  protocols: ProtocolPosition[];
}

export function normalizeJupiterPortfolio(
  jupiterPositions: JupiterPosition[],
): JupiterNormalizeResult {
  const positions: NormalizedPosition[] = [];

  for (const pos of jupiterPositions) {
    const normalized = normalizeJupiterPosition(pos);
    // Skip zero-value positions
    if (normalized.balance <= 0 && !(normalized.usdValue ?? 0 > 0)) continue;
    positions.push(normalized);

    // Add reward positions
    for (const reward of pos.rewards ?? []) {
      const rewardPos = normalizeReward(reward, pos.protocolSlug, pos.protocol);
      if (rewardPos) positions.push(rewardPos);
    }
  }

  const protocols = buildJupiterProtocols(positions);

  return { positions, protocols };
}
