/**
 * lib/normalize/protocols.ts
 *
 * Groups NormalizedPositions into ProtocolPosition objects.
 * Preserves the underlying provider from the first position in each group.
 */

import type { NormalizedPosition, ProtocolPosition, ProtocolCategory } from "../../types/index.ts";

function deriveProtocolIdentity(pos: NormalizedPosition): { protocolId: string; protocolName: string } {
  const protocolName = pos.protocolName?.trim() || pos.protocolId?.trim() || "Unlabeled DeFi";
  const protocolId = pos.protocolId?.trim() || protocolName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unlabeled-defi";
  return { protocolId, protocolName };
}

function inferCategory(
  deposits: NormalizedPosition[],
  borrows:  NormalizedPosition[],
  rewards:  NormalizedPosition[],
  staked:   NormalizedPosition[],
  locked:   NormalizedPosition[]
): ProtocolCategory {
  if (deposits.length > 0 && borrows.length > 0) return "lending";
  if (borrows.length > 0)  return "borrowing";
  if (staked.length > 0 && !deposits.length) return "staking";
  // LP positions → "liquidity" (check before generic vault)
  const hasLp = deposits.some((p) => p.positionType === "lp");
  if (hasLp) return "liquidity";
  if (deposits.length > 0) return "vault";
  if (locked.length > 0)   return "locked";
  if (rewards.length > 0)  return "reward";
  return "mixed";
}

function sumUsd(positions: NormalizedPosition[]): number {
  return positions.reduce((s, p) => s + (p.usdValue ?? 0), 0);
}

export function buildProtocolPositions(
  defiPositions: NormalizedPosition[]
): ProtocolPosition[] {
  const map = new Map<string, {
    protocolId:   string;
    protocolName: string;
    chainSlug:    string;
    chainName:    string;
    chainColor:   string;
    chainEmoji:   string;
    deposits:     NormalizedPosition[];
    borrows:      NormalizedPosition[];
    rewards:      NormalizedPosition[];
    staked:       NormalizedPosition[];
    locked:       NormalizedPosition[];
  }>();

  for (const pos of defiPositions) {
    const { protocolId, protocolName } = deriveProtocolIdentity(pos);

    const key = `${pos.chainSlug}-${protocolId}`;

    if (!map.has(key)) {
      map.set(key, {
        protocolId,
        protocolName,
        chainSlug:    pos.chainSlug,
        chainName:    pos.chainName,
        chainColor:   pos.chainColor,
        chainEmoji:   pos.chainEmoji,
        deposits: [], borrows: [], rewards: [], staked: [], locked: [],
      });
    }

    const g = map.get(key)!;

    switch (pos.positionType) {
      case "deposit": g.deposits.push(pos); break;
      case "lp":      g.deposits.push(pos); break; // LP treated as deposit
      case "borrow":  g.borrows.push(pos);  break;
      case "reward":  g.rewards.push(pos);  break;
      case "staked":  g.staked.push(pos);   break;
      case "locked":  g.locked.push(pos);   break;
      default:        g.deposits.push(pos); break;
    }
  }

  const protocols: ProtocolPosition[] = [];

  for (const [key, g] of map.entries()) {
    const totalDepositUsd = sumUsd(g.deposits);
    const totalBorrowUsd  = sumUsd(g.borrows);
    const totalRewardUsd  = sumUsd(g.rewards);
    const totalStakedUsd  = sumUsd([...g.staked, ...g.locked]);

    protocols.push({
      id:           key,
      protocolId:   g.protocolId,
      protocolName: g.protocolName,
      dataSource:   [...g.deposits, ...g.borrows, ...g.rewards, ...g.staked, ...g.locked][0]?.dataSource ?? "zerion",
      chainSlug:    g.chainSlug,
      chainName:    g.chainName,
      chainColor:   g.chainColor,
      chainEmoji:   g.chainEmoji,
      category:     inferCategory(g.deposits, g.borrows, g.rewards, g.staked, g.locked),
      deposits:     g.deposits,
      borrows:      g.borrows,
      rewards:      g.rewards,
      staked:       [...g.staked, ...g.locked],
      locked:       g.locked,
      totalDepositUsd,
      totalBorrowUsd,
      totalRewardUsd,
      totalStakedUsd,
      netUsdValue: totalDepositUsd + totalRewardUsd + totalStakedUsd - totalBorrowUsd,
    });
  }

  return protocols.sort((a, b) => b.netUsdValue - a.netUsdValue);
}
