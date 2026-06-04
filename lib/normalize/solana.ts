/**
 * Converts raw Helius Solana data into NormalizedPosition[] so the shared
 * aggregation and UI pipeline can treat Solana like the rest of the app.
 */

import type { NormalizedPosition } from "@/types";
import { MIN_VISIBLE_USD } from "@/types";
import type { HeliusAsset, SolanaRawData } from "@/lib/providers/solana";

const LAMPORTS_PER_SOL = 1_000_000_000;
const SOLANA_CHAIN = "solana";
const SOLANA_COLOR = "#9945FF";
const SOLANA_EMOJI = "\u25CE";
const EPOCHS_PER_YEAR_ESTIMATE = 182.5;
const MAX_SOLANA_EPOCH = "18446744073709551615";
const SOL_LOGO =
  "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png";

const STABLE_MINTS = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  "EjmyN6qEC1Tf1JxiG1ae7UTJhUxSwk1TCWNWqxWV4J6o",
]);

const STABLE_SYMBOLS = new Set(["USDC", "USDT", "DAI", "BUSD", "USDH", "USDR", "UXD"]);

function isStablecoin(mint: string, symbol?: string): boolean {
  if (STABLE_MINTS.has(mint)) return true;
  if (symbol && STABLE_SYMBOLS.has(symbol.toUpperCase())) return true;
  return false;
}

function getTokenLogo(asset: HeliusAsset): string | undefined {
  return (
    asset.content?.links?.image ??
    asset.content?.files?.[0]?.cdn_uri ??
    asset.content?.files?.[0]?.uri
  );
}

function parseEpoch(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeSolanaTokens(data: SolanaRawData): NormalizedPosition[] {
  const positions: NormalizedPosition[] = [];

  if (data.solAsset) {
    const nativeBalance = data.solAsset.nativeBalance;
    const lamports = nativeBalance?.lamports ?? 0;
    const balance = lamports / LAMPORTS_PER_SOL;
    const price = nativeBalance?.price_per_sol ?? 0;
    const usdValue = nativeBalance?.total_price ?? balance * price;

    if (balance > 0) {
      positions.push({
        id: "sol:native",
        symbol: "SOL",
        name: "Solana",
        logo: SOL_LOGO,
        contractAddress: "native",
        decimals: 9,
        rawBalance: String(lamports),
        chainSlug: SOLANA_CHAIN,
        chainName: "Solana",
        chainColor: SOLANA_COLOR,
        chainEmoji: SOLANA_EMOJI,
        balance,
        usdValue,
        price: price || undefined,
        priceChange24h: undefined,
        priceAvailable: price > 0,
        source: "wallet",
        positionType: "wallet",
        isNative: true,
        isLiability: false,
        isStablecoin: false,
        isSpam: false,
        isVerified: true,
        fungibleId: "solana",
        dataSource: "helius",
      });
    }
  }

  for (const asset of data.tokens) {
    const tokenInfo = asset.token_info;
    if (!tokenInfo) continue;

    const rawBalance = tokenInfo.balance ?? 0;
    const decimals = tokenInfo.decimals ?? 0;
    const balance = rawBalance / Math.pow(10, decimals);
    if (balance <= 0) continue;

    const symbol = tokenInfo.symbol ?? asset.content?.metadata?.symbol ?? "???";
    const name = asset.content?.metadata?.name ?? symbol;
    const price = tokenInfo.price_info?.price_per_token ?? 0;
    const usdValue = tokenInfo.price_info?.total_price ?? (price > 0 ? balance * price : undefined);

    if (usdValue !== undefined && usdValue < MIN_VISIBLE_USD && !isStablecoin(asset.id, symbol)) {
      continue;
    }

    positions.push({
      id: `sol:${asset.id}`,
      symbol,
      name,
      logo: getTokenLogo(asset),
      contractAddress: asset.id,
      decimals,
      rawBalance: String(rawBalance),
      chainSlug: SOLANA_CHAIN,
      chainName: "Solana",
      chainColor: SOLANA_COLOR,
      chainEmoji: SOLANA_EMOJI,
      balance,
      usdValue,
      price: price > 0 ? price : undefined,
      priceChange24h: undefined,
      priceAvailable: price > 0,
      source: "wallet",
      positionType: "wallet",
      isNative: false,
      isLiability: false,
      isStablecoin: isStablecoin(asset.id, symbol),
      isSpam: false,
      isVerified: true,
      fungibleId: asset.id,
      dataSource: "helius",
    });
  }

  return positions;
}

export function normalizeSolanaStake(
  raw: SolanaRawData,
  solPrice: number,
): NormalizedPosition[] {
  const positions: NormalizedPosition[] = [];
  const currentEpoch = raw.currentEpoch;
  const inflationRewards = raw.inflationRewards ?? {};

  for (const account of raw.stakeAccounts) {
    const lamports = account.lamports ?? 0;
    if (lamports <= 0) continue;

    const parsed = account.data?.parsed;
    const parsedType = parsed?.type?.toLowerCase();
    const delegation = parsed?.info?.stake?.delegation;
    const delegatedLamports = delegation?.stake
      ? Number.parseInt(delegation.stake, 10)
      : 0;
    const rentExemptReserve = parsed?.info?.meta?.rentExemptReserve
      ? Number.parseInt(parsed.info.meta.rentExemptReserve, 10)
      : 0;
    const stakeLamports = delegatedLamports > 0
      ? delegatedLamports
      : Math.max(0, lamports - rentExemptReserve);
    const balance = stakeLamports / LAMPORTS_PER_SOL;
    if (balance < 0.001) continue;

    const activationEpoch = parseEpoch(delegation?.activationEpoch);
    const deactivationEpoch = delegation?.deactivationEpoch;
    const isDeactivating = Boolean(
      deactivationEpoch &&
      deactivationEpoch !== MAX_SOLANA_EPOCH
    );
    const isDelegated = parsedType === "delegated" || delegatedLamports > 0;
    const state = activationEpoch !== undefined && currentEpoch !== undefined && activationEpoch > currentEpoch
      ? "activating"
      : isDeactivating
      ? "deactivating"
      : isDelegated
      ? "active"
      : "inactive";
    const stateLabel = `${state.charAt(0).toUpperCase()}${state.slice(1)}`;

    const validatorLabel = delegation?.voter
      ? `${delegation.voter.slice(0, 8)}...`
      : "Unknown validator";
    const rewardLamports = inflationRewards[account.address]?.amount ?? 0;
    const rewardSol = rewardLamports / LAMPORTS_PER_SOL;
    const apy = state === "active" && rewardSol > 0 && balance > 0
      ? (rewardSol / balance) * EPOCHS_PER_YEAR_ESTIMATE * 100
      : undefined;

    positions.push({
      id: `sol:stake:${account.address}`,
      symbol: "SOL",
      name: delegation?.voter
        ? `Staked SOL - ${validatorLabel} - ${stateLabel}`
        : `Staked SOL - ${stateLabel}`,
      logo: SOL_LOGO,
      contractAddress: account.address,
      decimals: 9,
      rawBalance: String(stakeLamports),
      chainSlug: SOLANA_CHAIN,
      chainName: "Solana",
      chainColor: SOLANA_COLOR,
      chainEmoji: SOLANA_EMOJI,
      balance,
      usdValue: balance * solPrice,
      price: solPrice > 0 ? solPrice : undefined,
      priceChange24h: undefined,
      priceAvailable: solPrice > 0,
      source: "defi",
      positionType: "staked",
      protocolId: "solana-native-stake",
      protocolName: "Native Staking",
      isNative: true,
      isLiability: false,
      isStablecoin: false,
      isSpam: false,
      isVerified: true,
      fungibleId: "solana",
      dataSource: "helius",
      apy,
    });
  }

  return positions;
}

export function normalizeSolanaData(raw: SolanaRawData): NormalizedPosition[] {
  const tokenPositions = normalizeSolanaTokens(raw);
  const solPrice =
    raw.solAsset?.token_info?.price_info?.price_per_token ??
    raw.solAsset?.nativeBalance?.price_per_sol ??
    0;
  const stakePositions = normalizeSolanaStake(raw, solPrice);

  return [...tokenPositions, ...stakePositions];
}
