/**
 * lib/normalize/covalent.ts
 *
 * Converts Covalent DeFi protocol data → NormalizedPosition + ProtocolPosition.
 */

import type {
  NormalizedPosition,
  ProtocolPosition,
  ProtocolCategory,
} from "@/types";
import type { CovalentDefiResult } from "@/lib/providers/covalent";
import { COVALENT_CHAIN_ID_TO_SLUG } from "@/lib/providers/covalent";
import { getChainInfo } from "@/lib/chains/registry";

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

function chainSlugFromId(chainId: number): string {
  return COVALENT_CHAIN_ID_TO_SLUG[chainId] ?? `chain-${chainId}`;
}

export interface CovalentNormalizeResult {
  positions: NormalizedPosition[];
  protocols: ProtocolPosition[];
}

export function normalizeCovalentData(
  data: CovalentDefiResult
): CovalentNormalizeResult {
  const allPositions: NormalizedPosition[] = [];

  for (const protocolData of data.positions) {
    const chainSlug = chainSlugFromId(protocolData.chain_id);
    const chain = getChainInfo(chainSlug);

    for (const pos of protocolData.positions) {
      const latest = pos.holdings[pos.holdings.length - 1];
      if (!latest) continue;

      const token = pos.token;
      const decimals = token?.contract_decimals ?? 18;
      const rawBalance = latest.close.balance;
      const balance = parseFloat(rawBalance) / Math.pow(10, decimals);
      const usdValue = latest.close.quote;

      if (balance <= 0) continue;

      const symbol = token?.contract_ticker_symbol ?? "???";
      const name = token?.contract_name ?? symbol;

      // Determine position type
      const typeStr = (protocolData.protocol_name ?? "").toLowerCase();
      let positionType: NormalizedPosition["positionType"] = "deposit";
      let isLiability = false;

      if (typeStr.includes("borrow") || typeStr.includes("lending")) {
        positionType = "borrow";
        isLiability = true;
      } else if (typeStr.includes("staking") || typeStr.includes("staked")) {
        positionType = "staked";
      } else if (typeStr.includes("lp") || typeStr.includes("liquidity")) {
        positionType = "lp";
      }

      const posId = [
        "covalent",
        chainSlug,
        protocolData.protocol_id ?? protocolData.protocol_name,
        pos.contract_address,
      ].join("-");

      allPositions.push({
        id: posId,
        symbol,
        name,
        logo: token?.logo_url,
        contractAddress: pos.contract_address,
        decimals,
        rawBalance,
        chainSlug,
        chainName: chain.name,
        chainColor: chain.color,
        chainEmoji: chain.emoji,
        balance,
        price: usdValue && balance > 0 ? usdValue / balance : undefined,
        priceChange24h: undefined,
        usdValue: usdValue || undefined,
        priceAvailable: usdValue > 0,
        source: "defi",
        positionType,
        isLiability,
        isNative: false,
        isStablecoin: isStable(symbol),
        isSpam: false,
        isVerified: true,
        dataSource: "covalent",
        protocolId: protocolData.protocol_id ?? protocolData.protocol_name.toLowerCase().replace(/\s+/g, "-"),
        protocolName: protocolData.protocol_name,
      });

      // Handle airdropped tokens
      if (pos.airdropped_token) {
        const airdrop = pos.airdropped_token;
        const airdropId = [posId, "airdrop", airdrop.contract_address].join("-");
        allPositions.push({
          id: airdropId,
          symbol: airdrop.contract_ticker_symbol ?? "AIRDROP",
          name: airdrop.contract_ticker_symbol ?? "Airdrop",
          logo: airdrop.logo_url,
          contractAddress: airdrop.contract_address,
          decimals: 18,
          rawBalance: "0",
          chainSlug,
          chainName: chain.name,
          chainColor: chain.color,
          chainEmoji: chain.emoji,
          balance: 0,
          price: undefined,
          priceChange24h: undefined,
          usdValue: undefined,
          priceAvailable: false,
          source: "defi",
          positionType: "reward",
          isLiability: false,
          isNative: false,
          isStablecoin: false,
          isSpam: false,
          isVerified: false,
          dataSource: "covalent",
          protocolId: protocolData.protocol_id ?? protocolData.protocol_name.toLowerCase().replace(/\s+/g, "-"),
          protocolName: `${protocolData.protocol_name} (Airdrop)`,
        });
      }
    }
  }

  // Build protocol groupings
  const byKey = new Map<string, NormalizedPosition[]>();
  for (const pos of allPositions) {
    if (!pos.protocolId) continue;
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

    const hasAirdrop = protoPositions.some((p) => p.protocolName?.includes("Airdrop"));

    const category: ProtocolCategory =
      borrows.length > 0 && deposits.length > 0 ? "lending"
      : borrows.length > 0 ? "borrowing"
      : protoPositions[0]?.positionType === "lp" ? "liquidity"
      : protoPositions[0]?.positionType === "staked" ? "staking"
      : hasAirdrop ? "reward"
      : "vault";

    protocols.push({
      id: `covalent-${key}`,
      protocolId,
      protocolName: protoPositions[0]?.protocolName ?? protocolId,
      protocolLogo: protoPositions[0]?.logo,
      dataSource: "covalent",
      chainSlug,
      chainName: protoPositions[0]?.chainName ?? chainSlug,
      chainColor: protoPositions[0]?.chainColor ?? "#5a78a0",
      chainEmoji: protoPositions[0]?.chainEmoji ?? "",
      category,
      deposits,
      borrows,
      rewards: protoPositions.filter((p) => p.positionType === "reward" && !p.protocolName?.includes("Airdrop")),
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
