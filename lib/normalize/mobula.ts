import { MIN_VISIBLE_USD, type NormalizedPosition, type ProtocolPosition } from "@/types";
import { buildProtocolPositions } from "@/lib/normalize/protocols";
import type {
  MobulaDefiPositionEntry,
  MobulaProtocolGroup,
  MobulaTokenAmount,
} from "@/lib/providers/mobula";

const SOLANA_CHAIN = {
  slug: "solana",
  name: "Solana",
  color: "#9945FF",
  emoji: "\u25CE",
};

const STABLE_SYMBOLS = new Set(["USDC", "USDT", "DAI", "USDR", "USDH", "UXD", "USDP", "USDB"]);

function isStable(symbol: string): boolean {
  return STABLE_SYMBOLS.has(symbol.toUpperCase());
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeApy(value: unknown): number | undefined {
  const parsed = toNumber(value);
  if (parsed === undefined) return undefined;
  return parsed <= 1 ? parsed * 100 : parsed;
}

function inferPositionType(
  entryType: string | undefined,
  protocolCategory: string | undefined,
  metadataType: string | undefined,
): Exclude<NormalizedPosition["positionType"], "reward" | "wallet"> | null {
  const label = `${entryType ?? ""} ${protocolCategory ?? ""} ${metadataType ?? ""}`.toLowerCase();

  if (label.includes("perp") || label.includes("leverage")) return null;
  if (label.includes("borrow")) return "borrow";
  if (label.includes("stake") || label.includes("staking") || label.includes("restaking")) return "staked";
  if (label.includes("liquidity") || label.includes("lp")) return "lp";
  if (label.includes("lend") || label.includes("deposit") || label.includes("supply") || label.includes("vault")) {
    return "deposit";
  }
  return "deposit";
}

function getTokenBalance(token: MobulaTokenAmount): number {
  const formatted = toNumber(token.amountFormatted);
  if (formatted !== undefined) return formatted;

  const raw = typeof token.amountRaw === "string" ? token.amountRaw : undefined;
  const decimals = typeof token.decimals === "number" ? token.decimals : 0;
  if (!raw) return 0;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 0;
  return parsed / Math.pow(10, decimals);
}

function shouldKeepPosition(symbol: string, usdValue: number | undefined): boolean {
  if (usdValue === undefined) return true;
  if (usdValue >= MIN_VISIBLE_USD) return true;
  return isStable(symbol);
}

function makePosition(
  token: MobulaTokenAmount,
  position: MobulaDefiPositionEntry,
  protocol: MobulaProtocolGroup["protocol"],
  index: number,
  positionType: Exclude<NormalizedPosition["positionType"], "reward">,
): NormalizedPosition | null {
  const symbol = token.symbol?.trim();
  const name = token.name?.trim() ?? position.name?.trim() ?? symbol;
  if (!symbol || !name) return null;

  const balance = getTokenBalance(token);
  const price = toNumber(token.priceUSD);
  const fallbackPositionValue = (position.tokens?.length ?? 0) === 1 ? toNumber(position.valueUSD) : undefined;
  const usdValue = toNumber(token.valueUSD) ?? (price !== undefined ? balance * price : fallbackPositionValue);
  if (balance <= 0 && !(usdValue !== undefined && usdValue > 0)) return null;
  if (!shouldKeepPosition(symbol, usdValue)) return null;

  const metadata = position.metadata ?? {};

  return {
    id: `mobula-${protocol.id}-${position.id}-token-${index}`,
    symbol,
    name,
    logo: token.logo ?? protocol.logo,
    contractAddress: token.address ?? `${protocol.id}:${position.id}:${index}`,
    decimals: typeof token.decimals === "number" ? token.decimals : 9,
    fungibleId: token.address,
    chainSlug: SOLANA_CHAIN.slug,
    chainName: SOLANA_CHAIN.name,
    chainColor: SOLANA_CHAIN.color,
    chainEmoji: SOLANA_CHAIN.emoji,
    balance,
    rawBalance: token.amountRaw ?? String(balance),
    price,
    priceChange24h: undefined,
    usdValue,
    priceAvailable: price !== undefined && price > 0,
    source: "defi",
    positionType,
    isLiability: positionType === "borrow",
    isNative: false,
    isStablecoin: isStable(symbol),
    isSpam: false,
    isVerified: true,
    dataSource: "mobula",
    protocolId: protocol.id,
    protocolName: protocol.name,
    healthFactor: toNumber(metadata.healthFactor),
    collateralRatio: toNumber(metadata.collateralRatio),
    liquidationPrice: toNumber(metadata.liquidationPriceQuote) ?? toNumber(metadata.liquidationPrice),
    apy: normalizeApy(metadata.apy),
  };
}

function makeRewardPosition(
  reward: MobulaTokenAmount,
  position: MobulaDefiPositionEntry,
  protocol: MobulaProtocolGroup["protocol"],
  index: number,
): NormalizedPosition | null {
  const symbol = reward.symbol?.trim();
  const name = reward.name?.trim() ?? symbol;
  if (!symbol || !name) return null;

  const balance = getTokenBalance(reward);
  const price = toNumber(reward.priceUSD);
  const usdValue = toNumber(reward.valueUSD) ?? (price !== undefined ? balance * price : undefined);
  if (balance <= 0 && !(usdValue !== undefined && usdValue > 0)) return null;
  if (!shouldKeepPosition(symbol, usdValue)) return null;

  return {
    id: `mobula-${protocol.id}-${position.id}-reward-${index}`,
    symbol,
    name,
    logo: reward.logo ?? protocol.logo,
    contractAddress: reward.address ?? `${protocol.id}:${position.id}:reward:${index}`,
    decimals: typeof reward.decimals === "number" ? reward.decimals : 9,
    fungibleId: reward.address,
    chainSlug: SOLANA_CHAIN.slug,
    chainName: SOLANA_CHAIN.name,
    chainColor: SOLANA_CHAIN.color,
    chainEmoji: SOLANA_CHAIN.emoji,
    balance,
    rawBalance: reward.amountRaw ?? String(balance),
    price,
    priceChange24h: undefined,
    usdValue,
    priceAvailable: price !== undefined && price > 0,
    source: "defi",
    positionType: "reward",
    isLiability: false,
    isNative: false,
    isStablecoin: isStable(symbol),
    isSpam: false,
    isVerified: true,
    dataSource: "mobula",
    protocolId: protocol.id,
    protocolName: protocol.name,
  };
}

export interface MobulaNormalizeResult {
  positions: NormalizedPosition[];
  protocols: ProtocolPosition[];
}

export function normalizeMobulaData(
  protocolGroups: MobulaProtocolGroup[],
): MobulaNormalizeResult {
  const positions: NormalizedPosition[] = [];
  if (!Array.isArray(protocolGroups)) {
    return { positions, protocols: [] };
  }

  for (const group of protocolGroups) {
    const protocol = group.protocol;
    if (!protocol?.id || !protocol?.name) continue;

    for (const entry of group.positions ?? []) {
      const positionType = inferPositionType(
        entry.type,
        protocol.category,
        typeof entry.metadata?.type === "string" ? entry.metadata.type : undefined,
      );
      if (!positionType) continue;

      for (const [index, token] of (entry.tokens ?? []).entries()) {
        const normalized = makePosition(token, entry, protocol, index, positionType);
        if (normalized) positions.push(normalized);
      }

      for (const [index, reward] of (entry.rewards ?? []).entries()) {
        const normalizedReward = makeRewardPosition(reward, entry, protocol, index);
        if (normalizedReward) positions.push(normalizedReward);
      }
    }
  }

  return {
    positions,
    protocols: buildProtocolPositions(positions),
  };
}
