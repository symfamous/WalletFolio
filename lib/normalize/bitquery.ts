/**
 * lib/normalize/bitquery.ts
 *
 * Converts BitQuery API data into NormalizedPosition + ProtocolPosition objects.
 * This normalizer handles Solana DeFi positions (Marinade, Raydium, etc.)
 * and EVM positions in the same shape as Zerion's output.
 *
 * BitQuery data is SUPPLEMENTAL — it fills gaps where Zerion/Helius don't cover.
 */

import type {
  NormalizedPosition,
  ProtocolPosition,
  ProtocolCategory,
} from "@/types";
import type { BitQuerySolanaData, BitQuerySolanaDefiPosition } from "@/lib/providers/bitquery";
import { getChainInfo } from "@/lib/chains/registry";

// ─── Solana chain info ──────────────────────────────────────────

const SOLANA_CHAIN = {
  slug: "solana",
  name: "Solana",
  numericId: undefined,
  color: "#9945FF",
  emoji: "◎",
};

// ─── Stablecoin check ───────────────────────────────────────────

const STABLE = new Set([
  "USDC", "USDT", "DAI", "FRAX", "PYUSD", "crvUSD", "GHO", "LUSD", "USDE",
  "USDbC", "USDBC", "USDB", "XDAI", "FDUSD", "USDD", "GUSD", "TUSD", "USDP",
]);

function isStable(symbol: string): boolean {
  return STABLE.has(symbol?.toUpperCase() ?? "");
}

// ─── Raw amount parser ──────────────────────────────────────────

function rawToFloat(raw: string | null | undefined, decimals: number): number {
  if (!raw || raw === "0") return 0;
  try {
    const d = Math.min(decimals, 18);
    const padded = raw.padStart(d + 1, "0");
    const intPart = padded.slice(0, padded.length - d) || "0";
    const fracPart = padded.slice(padded.length - d);
    return parseFloat(`${intPart}.${fracPart}`);
  } catch {
    return parseFloat(raw) / Math.pow(10, decimals);
  }
}

function sumUsd(positions: NormalizedPosition[]): number {
  return positions.reduce((s, p) => s + (p.usdValue ?? 0), 0);
}

// ─── Solana balance → NormalizedPosition ────────────────────────

function normalizeSolanaBalance(
  balance: {
    address: string;
    balance: number;
    token: {
      symbol: string;
      name: string;
      decimals: number;
      mintAddress: string;
      priceUsd?: number;
    };
  }
): NormalizedPosition {
  const token = balance.token;
  const balance_ = balance.balance;
  const price = token.priceUsd;
  const usdValue = price ? balance_ * price : undefined;

  return {
    id: `bitquery-solana-${token.mintAddress}-wallet`,
    symbol: token.symbol,
    name: token.name,
    logo: undefined,
    contractAddress: token.mintAddress,
    decimals: token.decimals,
    fungibleId: undefined,
    coingeckoId: undefined,

    chainSlug: SOLANA_CHAIN.slug,
    chainName: SOLANA_CHAIN.name,
    chainNumericId: SOLANA_CHAIN.numericId,
    chainColor: SOLANA_CHAIN.color,
    chainEmoji: SOLANA_CHAIN.emoji,

    balance: balance_,
    rawBalance: String(balance.balance),

    price,
    priceChange24h: undefined,
    usdValue,
    priceAvailable: (price ?? 0) > 0,

    source: "wallet",
    positionType: "wallet",
    isLiability: false,
    isNative: token.mintAddress === "So11111111111111111111111111111111111111112",
    isStablecoin: isStable(token.symbol),
    isSpam: false,
    isVerified: false,

    dataSource: "bitquery",

    protocolId: undefined,
    protocolName: undefined,
  };
}

// ─── Solana DeFi position → NormalizedPosition ──────────────────

function normalizeSolanaDefiPosition(
  pos: BitQuerySolanaDefiPosition
): NormalizedPosition {
  const decimals = pos.token.decimals || 9;
  const balance = rawToFloat(pos.amount, decimals);
  const price = pos.token.priceUsd;
  const usdValue = pos.amountUsd ?? (price ? balance * price : undefined);

  const positionType = pos.type === "stake" ? "staked"
    : pos.type === "lp" ? "lp"
    : "deposit";

  return {
    id: `bitquery-solana-${pos.protocolSlug}-${pos.token.mintAddress}`,
    symbol: pos.token.symbol,
    name: pos.token.name,
    logo: undefined,
    contractAddress: pos.token.mintAddress,
    decimals,
    fungibleId: undefined,
    coingeckoId: undefined,

    chainSlug: SOLANA_CHAIN.slug,
    chainName: SOLANA_CHAIN.name,
    chainNumericId: SOLANA_CHAIN.numericId,
    chainColor: SOLANA_CHAIN.color,
    chainEmoji: SOLANA_CHAIN.emoji,

    balance,
    rawBalance: pos.amount,

    price,
    priceChange24h: undefined,
    usdValue,
    priceAvailable: (price ?? 0) > 0,

    source: "defi",
    positionType,
    isLiability: false,
    isNative: false,
    isStablecoin: isStable(pos.token.symbol),
    isSpam: false,
    isVerified: true,

    dataSource: "bitquery",

    protocolId: pos.protocolSlug,
    protocolName: pos.protocol,
  };
}

// ─── Protocol position builder ──────────────────────────────────

function buildSolanaProtocols(
  positions: NormalizedPosition[]
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
    const deposits = protocolPositions.filter((p) => !p.isLiability && p.positionType !== "wallet");
    const borrows = protocolPositions.filter((p) => p.isLiability);

    const category: ProtocolCategory =
      borrows.length > 0 ? "lending" : "vault";

    protocols.push({
      id: `bitquery-solana-${protocolId}`,
      protocolId,
      protocolName: protocolPositions[0]?.protocolName ?? protocolId,
      protocolLogo: undefined,
      dataSource: "bitquery",
      chainSlug: SOLANA_CHAIN.slug,
      chainName: SOLANA_CHAIN.name,
      chainColor: SOLANA_CHAIN.color,
      chainEmoji: SOLANA_CHAIN.emoji,
      category,
      deposits,
      borrows,
      rewards: [],
      staked: [],
      locked: [],
      totalDepositUsd: sumUsd(deposits),
      totalBorrowUsd: sumUsd(borrows),
      totalRewardUsd: 0,
      totalStakedUsd: sumUsd(protocolPositions.filter((p) => p.positionType === "staked")),
      netUsdValue: sumUsd(deposits) - sumUsd(borrows),
    });
  }

  return protocols;
}

// ─── Main normalizer ─────────────────────────────────────────────

export interface BitQueryNormalizeResult {
  positions: NormalizedPosition[];
  protocols: ProtocolPosition[];
}

export function normalizeBitQuerySolanaData(
  data: BitQuerySolanaData
): BitQueryNormalizeResult {
  const allPositions: NormalizedPosition[] = [];

  // Wallet balances (non-zero only)
  for (const balance of data.balances) {
    if (balance.balance > 0) {
      allPositions.push(normalizeSolanaBalance(balance));
    }
  }

  // DeFi positions
  for (const pos of data.defiPositions) {
    const normalized = normalizeSolanaDefiPosition(pos);
    if (normalized.balance > 0 || (normalized.usdValue ?? 0) > 0) {
      allPositions.push(normalized);
    }
  }

  // Build protocol groupings for DeFi positions
  const defiPositions = allPositions.filter((p) => p.source === "defi");
  const protocols = buildSolanaProtocols(defiPositions);

  return { positions: allPositions, protocols };
}
