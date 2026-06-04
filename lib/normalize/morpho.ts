/**
 * lib/normalize/morpho.ts
 *
 * Converts Morpho API data into NormalizedPosition + ProtocolPosition objects
 * that match Zerion's shape exactly — so the rest of the pipeline is unchanged.
 *
 * Handles two Morpho position types:
 *   1. MetaMorpho vault deposits (e.g. uETH vault on HyperEVM)
 *   2. Morpho Blue market positions (supply / borrow / collateral)
 *
 * Deduplication with Zerion:
 *   Before calling this, the route checks which chains Zerion already covered.
 *   This normalizer trusts that input — if a chain's Morpho data is passed in,
 *   it means Zerion did NOT return Morpho positions for that chain.
 */

import type {
  NormalizedPosition, ProtocolPosition, ProtocolCategory,
} from "@/types";
import type { MorphoUserData } from "@/lib/providers/morpho";
import { MORPHO_CHAIN_ID_TO_SLUG } from "@/lib/providers/morpho";
import { getChainInfo } from "@/lib/chains/registry";

// ─── Stablecoin symbols (mirror positions.ts) ─────────────────────

const STABLE = new Set([
  "USDC","USDT","DAI","FRAX","PYUSD","crvUSD","GHO","LUSD","USDE",
  "USDbC","USDBC","USDB","XDAI","FDUSD","USDD","GUSD","TUSD","USDP",
]);

function isStable(sym: string): boolean {
  return STABLE.has(sym?.toUpperCase() ?? "");
}

/** Convert raw bigint-as-string + decimals → human float */
function rawToFloat(raw: string | null | undefined, decimals: number): number {
  if (!raw || raw === "0") return 0;
  try {
    // Safe string-math approach: avoids BigInt literals for ES2017 compat
    const d = Math.min(decimals, 18);
    // Pad or trim to have exactly d decimal digits
    const padded  = raw.padStart(d + 1, "0");
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

// ─── Main normalizer ──────────────────────────────────────────────

export interface MorphoNormalizeResult {
  positions: NormalizedPosition[];
  protocols: ProtocolPosition[];
}

export function normalizeMorphoData(
  morphoDataList: MorphoUserData[]
): MorphoNormalizeResult {
  const allPositions: NormalizedPosition[] = [];
  const allProtocols: ProtocolPosition[]   = [];

  for (const data of morphoDataList) {
    const chainSlug = MORPHO_CHAIN_ID_TO_SLUG[data.chainId];
    if (!chainSlug) {
      console.warn(`[morpho] Unknown chainId ${data.chainId}, skipping`);
      continue;
    }

    const chain = getChainInfo(chainSlug);

    // ── Vault positions (MetaMorpho) ──────────────────────────────
    for (const vp of data.vaultPositions) {
      const asset     = vp.vault?.asset;
      if (!asset) continue;

      const decimals  = asset.decimals ?? 18;
      const balance   = rawToFloat(vp.assets, decimals);
      if (balance <= 0) continue;

      const price     = asset.priceUsd ?? undefined;
      const usdValue  = vp.assetsUsd ?? (price ? balance * price : undefined);
      if ((usdValue ?? 0) <= 0 && !price) continue;

      const posId = `morpho-vault-${chainSlug}-${vp.vault.address.toLowerCase()}-${asset.address.toLowerCase()}`;

      const pos: NormalizedPosition = {
        id:              posId,
        symbol:          asset.symbol,
        name:            `${asset.name} (${vp.vault.name})`,
        logo:            undefined,          // Morpho API has no logo field
        contractAddress: asset.address.toLowerCase(),
        decimals,
        fungibleId:      undefined,          // no Zerion fungible ID — keyed by contract

        chainSlug,
        chainName:       chain.name,
        chainNumericId:  chain.numericId ?? data.chainId,
        chainColor:      chain.color,
        chainEmoji:      chain.emoji,

        balance,
        rawBalance:      vp.assets ?? "0",

        price,
        priceChange24h:  undefined,
        usdValue,
        priceAvailable:  (price ?? 0) > 0,

        source:       "defi",
        positionType: "deposit",   // vault deposit
        isLiability:  false,
        isNative:     false,
        isStablecoin: isStable(asset.symbol),
        isSpam:       false,
        isVerified:   true,
        dataSource:   "zerion",    // treated as zerion-compatible for UI consistency

        protocolId:   "morpho",
        protocolName: "Morpho",
      };

      allPositions.push(pos);

      // Build a ProtocolPosition for this vault
      const protoId  = `${chainSlug}-morpho-vault-${vp.vault.address.toLowerCase()}`;
      const existing = allProtocols.find((p) => p.id === protoId);
      if (existing) {
        existing.deposits.push(pos);
        existing.totalDepositUsd = sumUsd(existing.deposits);
        existing.netUsdValue     = existing.totalDepositUsd - existing.totalBorrowUsd;
      } else {
        allProtocols.push({
          id:           protoId,
          protocolId:   "morpho",
          protocolName: `Morpho — ${vp.vault.name}`,
          protocolLogo: undefined,
          dataSource:   "zerion",
          chainSlug,
          chainName:    chain.name,
          chainColor:   chain.color,
          chainEmoji:   chain.emoji,
          category:     "vault",
          deposits:     [pos],
          borrows:      [],
          rewards:      [],
          staked:       [],
          locked:       [],
          totalDepositUsd: usdValue ?? 0,
          totalBorrowUsd:  0,
          totalRewardUsd:  0,
          totalStakedUsd:  0,
          netUsdValue:     usdValue ?? 0,
        });
      }
    }

    // ── Market positions (Morpho Blue) ────────────────────────────
    for (const mp of data.marketPositions) {
      const market = mp.market;
      const state  = mp.state;
      if (!market || !state) continue;

      const marketProtoId = `${chainSlug}-morpho-market-${market.uniqueKey.slice(0, 16)}`;
      const marketPositions: NormalizedPosition[] = [];

      // Supply (lending)
      const supplyBal = rawToFloat(state.supplyAssets, market.loanAsset?.decimals ?? 18);
      if (supplyBal > 0 && market.loanAsset) {
        const la      = market.loanAsset;
        const price   = la.priceUsd ?? undefined;
        const usdVal  = state.supplyAssetsUsd ?? (price ? supplyBal * price : undefined);

        const pos: NormalizedPosition = {
          id:              `morpho-supply-${chainSlug}-${market.uniqueKey.slice(0, 16)}`,
          symbol:          la.symbol,
          name:            la.name,
          contractAddress: la.address.toLowerCase(),
          decimals:        la.decimals ?? 18,
          chainSlug, chainName: chain.name, chainNumericId: chain.numericId ?? data.chainId,
          chainColor: chain.color, chainEmoji: chain.emoji,
          balance: supplyBal, rawBalance: state.supplyAssets ?? "0",
          price, usdValue: usdVal, priceAvailable: (price ?? 0) > 0,
          source: "defi", positionType: "deposit", isLiability: false,
          isNative: false, isStablecoin: isStable(la.symbol),
          isSpam: false, isVerified: true, dataSource: "zerion",
          protocolId: "morpho", protocolName: "Morpho",
        };
        allPositions.push(pos);
        marketPositions.push(pos);
      }

      // Borrow (liability)
      const borrowBal = rawToFloat(state.borrowAssets, market.loanAsset?.decimals ?? 18);
      if (borrowBal > 0 && market.loanAsset) {
        const la     = market.loanAsset;
        const price  = la.priceUsd ?? undefined;
        const usdVal = state.borrowAssetsUsd ?? (price ? borrowBal * price : undefined);

        const pos: NormalizedPosition = {
          id:              `morpho-borrow-${chainSlug}-${market.uniqueKey.slice(0, 16)}`,
          symbol:          la.symbol,
          name:            la.name,
          contractAddress: la.address.toLowerCase(),
          decimals:        la.decimals ?? 18,
          chainSlug, chainName: chain.name, chainNumericId: chain.numericId ?? data.chainId,
          chainColor: chain.color, chainEmoji: chain.emoji,
          balance: borrowBal, rawBalance: state.borrowAssets ?? "0",
          price, usdValue: usdVal, priceAvailable: (price ?? 0) > 0,
          source: "defi", positionType: "borrow", isLiability: true,
          isNative: false, isStablecoin: isStable(la.symbol),
          isSpam: false, isVerified: true, dataSource: "zerion",
          protocolId: "morpho", protocolName: "Morpho",
        };
        allPositions.push(pos);
        marketPositions.push(pos);
      }

      // Collateral
      const collBal = rawToFloat(state.collateral, market.collateralAsset?.decimals ?? 18);
      if (collBal > 0 && market.collateralAsset) {
        const ca     = market.collateralAsset;
        const price  = ca.priceUsd ?? undefined;
        const usdVal = state.collateralUsd ?? (price ? collBal * price : undefined);

        const pos: NormalizedPosition = {
          id:              `morpho-collateral-${chainSlug}-${market.uniqueKey.slice(0, 16)}`,
          symbol:          ca.symbol,
          name:            ca.name,
          contractAddress: ca.address.toLowerCase(),
          decimals:        ca.decimals ?? 18,
          chainSlug, chainName: chain.name, chainNumericId: chain.numericId ?? data.chainId,
          chainColor: chain.color, chainEmoji: chain.emoji,
          balance: collBal, rawBalance: state.collateral ?? "0",
          price, usdValue: usdVal, priceAvailable: (price ?? 0) > 0,
          source: "defi", positionType: "deposit", isLiability: false,
          isNative: false, isStablecoin: isStable(ca.symbol),
          isSpam: false, isVerified: true, dataSource: "zerion",
          protocolId: "morpho", protocolName: "Morpho",
        };
        allPositions.push(pos);
        marketPositions.push(pos);
      }

      if (marketPositions.length === 0) continue;

      const deposits = marketPositions.filter((p) => !p.isLiability);
      const borrows  = marketPositions.filter((p) => p.isLiability);

      const cat: ProtocolCategory =
        deposits.length > 0 && borrows.length > 0 ? "lending"
        : borrows.length > 0 ? "borrowing"
        : "vault";

      const existing = allProtocols.find((p) => p.id === marketProtoId);
      if (existing) {
        existing.deposits.push(...deposits);
        existing.borrows.push(...borrows);
        existing.totalDepositUsd = sumUsd(existing.deposits);
        existing.totalBorrowUsd  = sumUsd(existing.borrows);
        existing.netUsdValue     = existing.totalDepositUsd - existing.totalBorrowUsd;
      } else {
        allProtocols.push({
          id:           marketProtoId,
          protocolId:   "morpho",
          protocolName: "Morpho Blue",
          dataSource:   "zerion",
          chainSlug, chainName: chain.name, chainColor: chain.color, chainEmoji: chain.emoji,
          category:     cat,
          deposits, borrows, rewards: [], staked: [], locked: [],
          totalDepositUsd: sumUsd(deposits),
          totalBorrowUsd:  sumUsd(borrows),
          totalRewardUsd:  0, totalStakedUsd: 0,
          netUsdValue: sumUsd(deposits) - sumUsd(borrows),
        });
      }
    }
  }

  return { positions: allPositions, protocols: allProtocols };
}