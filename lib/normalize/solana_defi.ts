import type { NormalizedPosition } from "@/types";
import { MIN_VISIBLE_USD } from "@/types";
import type { SolanaDeFiPosition } from "@/lib/providers/solana_defi";

const SOLANA_CHAIN = {
  slug: "solana",
  name: "Solana",
  color: "#9945FF",
  emoji: "\u25CE",
};

const SOL_DERIVATIVE_SYMBOLS = new Set(["MSOL", "JITOSOL"]);
const STABLE_SYMBOLS = new Set(["USDC", "USDT", "DAI", "USDR", "USDH", "UXD"]);

function isStable(symbol: string): boolean {
  return STABLE_SYMBOLS.has(symbol.toUpperCase());
}

function getFallbackPrice(position: SolanaDeFiPosition, solPrice: number): number | undefined {
  if (solPrice <= 0) return undefined;
  if (position.type === "stake" && SOL_DERIVATIVE_SYMBOLS.has(position.tokenSymbol.toUpperCase())) {
    return solPrice;
  }
  return undefined;
}

export function normalizeSolanaDefiData(
  rawPositions: SolanaDeFiPosition[],
  solPrice: number,
): NormalizedPosition[] {
  const positions: NormalizedPosition[] = [];

  for (const position of rawPositions) {
    const balance = position.balance ?? 0;
    if (balance <= 0) continue;

    const fallbackPrice = getFallbackPrice(position, solPrice);
    const price = position.usdValue && balance > 0
      ? position.usdValue / balance
      : fallbackPrice;
    const usdValue = position.usdValue ?? (price !== undefined ? balance * price : undefined);

    if (usdValue !== undefined && usdValue < MIN_VISIBLE_USD && !isStable(position.tokenSymbol)) {
      continue;
    }

    positions.push({
      id: `solana-rpc-${position.protocolSlug}-${position.tokenMint}-${position.poolAddress ?? "position"}`,
      symbol: position.tokenSymbol,
      name: position.validator
        ? `${position.tokenName} - ${position.validator}`
        : position.tokenName,
      logo: undefined,
      contractAddress: position.tokenMint,
      decimals: position.decimals,
      fungibleId: position.tokenMint,
      chainSlug: SOLANA_CHAIN.slug,
      chainName: SOLANA_CHAIN.name,
      chainColor: SOLANA_CHAIN.color,
      chainEmoji: SOLANA_CHAIN.emoji,
      balance,
      rawBalance: String(balance),
      price,
      priceChange24h: undefined,
      usdValue,
      priceAvailable: price !== undefined && price > 0,
      source: "defi",
      positionType: position.type === "lp" ? "lp" : "staked",
      isLiability: false,
      isNative: false,
      isStablecoin: isStable(position.tokenSymbol),
      isSpam: false,
      isVerified: true,
      dataSource: "helius",
      protocolId: position.protocolSlug,
      protocolName: position.protocol,
    });
  }

  return positions;
}
