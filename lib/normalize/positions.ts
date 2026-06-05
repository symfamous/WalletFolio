/**
 * lib/normalize/positions.ts
 *
 * Strict ownership validation — only real, meaningful, held positions pass through.
 *
 * Filtering rules (applied in order):
 * 1. Zerion spam flag → drop
 * 2. Zerion trash flag → drop
 * 3. Zero or negative balance → drop (can't own what you have 0 of)
 * 4. USD value < $5 → drop (dust positions clutter the UI)
 * 5. Not displayable AND value < $0.01 AND not verified → drop
 * 6. Non-displayable positions with real value (vaults, locked etc.) → keep
 *
 * No chain whitelist — any chain Zerion returns is valid.
 */

import type {
  ZerionPosition, ZerionFungibleInfo, NormalizedPosition,
} from "@/types";
import { getChainInfo } from "@/lib/chains/registry";

// Minimum USD value to include a position — reduces noise from dust balances
const MIN_POSITION_USD = 5;

const STABLECOIN_FUNGIBLE_IDS = new Set([
  "usd-coin", "tether", "dai", "frax", "true-usd", "pax-dollar",
  "gemini-dollar", "liquity-usd", "usdd", "ethena-usde", "paypal-usd",
  "crvusd", "gho", "bridged-usdc", "stasis-eurs", "first-digital-usd",
]);

const STABLECOIN_SYMBOLS = new Set([
  "USDC","USDT","DAI","FRAX","TUSD","USDP","GUSD","LUSD",
  "USDD","USDE","PYUSD","crvUSD","GHO","USDBC","USDbC",
  "USDB","XDAI","CUSD","FDUSD",
]);

function isStablecoin(fungibleId?: string, symbol?: string): boolean {
  if (fungibleId && STABLECOIN_FUNGIBLE_IDS.has(fungibleId)) return true;
  if (symbol && STABLECOIN_SYMBOLS.has(symbol.toUpperCase())) return true;
  return false;
}

function extractContract(
  fungibleInfo: ZerionFungibleInfo,
  chainSlug: string
): { address: string; isNative: boolean } {
  const impl = fungibleInfo.implementations.find((i) => i.chain_id === chainSlug);
  if (!impl || impl.address === null) {
    return { address: "native", isNative: true };
  }
  return { address: impl.address.toLowerCase(), isNative: false };
}

export function normalizeZerionPositions(
  rawPositions: ZerionPosition[]
): NormalizedPosition[] {
  const normalized: NormalizedPosition[] = [];

  for (const pos of rawPositions) {
    if (!pos?.attributes || !pos?.relationships) continue;

    const attrs      = pos.attributes;
    const chainSlug  = pos.relationships.chain?.data?.id;
    const fungibleId = pos.relationships.fungible?.data?.id;

    if (!chainSlug) continue;

    // Normalize protocol — API returns string or { id, name }
    const rawProtocol = attrs.protocol;
    const protocolId   = typeof rawProtocol === "string"
      ? rawProtocol.toLowerCase().replace(/\s+/g, "-")
      : rawProtocol?.id ?? null;
    const protocolName = typeof rawProtocol === "string"
      ? rawProtocol
      : rawProtocol?.name ?? null;

    // ── Rule 1-2: Zerion spam/trash flags ────────────────────────
    if (attrs.flags?.is_spam) continue;
    if (attrs.fungible_info?.flags?.is_trash) continue;

    // ── Rule 3: Must have real balance ───────────────────────────
    const balance = Math.abs(attrs.quantity?.float ?? 0);
    if (balance <= 0) continue;

    // ── Rule 4: USD value must be at least $5 ─────────────────────
    const usdValue = attrs.value !== null && attrs.value !== undefined
      ? Math.abs(attrs.value)
      : undefined;
    if (usdValue !== undefined && usdValue < MIN_POSITION_USD) continue;

    // ── Rule 5: Non-displayable, no value, unverified = drop ─────
    const isVerified = attrs.fungible_info?.flags?.verified ?? false;

    if (!attrs.flags?.displayable) {
      // Only keep non-displayable if: has real value OR is verified
      if ((usdValue ?? 0) < 0.01 && !isVerified) continue;
    }

    const chain = getChainInfo(chainSlug);
    const { address: contractAddress, isNative } = extractContract(
      attrs.fungible_info,
      chainSlug
    );

    const zerionType  = attrs.position_type ?? "wallet";
    const isLiability = zerionType === "loan";

    let positionType: NormalizedPosition["positionType"];
    switch (zerionType) {
      case "wallet":     positionType = "wallet";  break;
      case "deposit":    positionType = "deposit"; break;
      case "loan":       positionType = "borrow";  break;
      case "reward":     positionType = "reward";  break;
      case "staked":     positionType = "staked";  break;
      case "locked":     positionType = "locked";  break;
      case "investment": positionType = "lp";      break;
      default:           positionType = "wallet";  break;
    }

    const price          = attrs.price ?? undefined;
    const priceAvailable = (price ?? 0) > 0;

    const posId = [
      chainSlug,
      contractAddress,
      zerionType,
      protocolId ?? "wallet",
      pos.id?.slice(-8) ?? Math.random().toString(36).slice(-8),
    ].join("-");

    const fungibleSymbol = attrs.fungible_info?.symbol ?? "???";
    const rawName = (attrs.name || attrs.fungible_info?.name || "").trim();
    // Zerion often returns a generic "Asset"/"Unknown" name — fall back to the
    // ticker symbol so holdings read clearly instead of a wall of "Asset".
    const displayName =
      !rawName || rawName.toLowerCase() === "asset" || rawName.toLowerCase() === "unknown"
        ? fungibleSymbol
        : rawName;

    normalized.push({
      id:              posId,
      symbol:          fungibleSymbol,
      name:            displayName,
      logo:            attrs.fungible_info?.icon?.url,
      contractAddress,
      decimals:        attrs.quantity?.decimals ?? 18,
      fungibleId,

      chainSlug,
      chainName:       chain.name,
      chainNumericId:  chain.numericId,
      chainColor:      chain.color,
      chainEmoji:      chain.emoji,

      balance,
      rawBalance:      attrs.quantity?.numeric ?? "0",

      price,
      priceChange24h:  attrs.changes?.percent_1d ?? undefined,
      usdValue,
      priceAvailable,

      source:       protocolId ? "defi" : "wallet",
      positionType,
      isLiability,
      isNative,
      isStablecoin: isStablecoin(fungibleId, attrs.fungible_info?.symbol),
      isSpam:       false,
      isVerified,
      dataSource:   "zerion",

      protocolId:   protocolId ?? undefined,
      protocolName: protocolName ?? undefined,
    });
  }

  return normalized;
}