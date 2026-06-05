/**
 * lib/snapshots/index.ts
 *
 * Portfolio snapshot system.
 * Stores snapshots in localStorage keyed by address.
 * Each snapshot captures the full portfolio state at a point in time.
 * Max 90 snapshots per address (pruned oldest first).
 */

import { normalizeTrackedAddress } from "@/lib/utils";
import type { Portfolio, PerpsApiResponse } from "@/types";

export interface PortfolioSnapshot {
  id: string;
  address: string;
  timestamp: string;
  totalUsdValue: number;
  walletUsdValue: number;
  defiNetUsdValue: number;
  totalBorrowUsdValue: number;
  perpUnrealizedPnl: number;
  perpAccountValue: number;
  activeChainCount: number;
  activeProtocolCount: number;
  assetCount: number;
  topHoldings: Array<{ symbol: string; usdValue: number; price: number }>;
  chainAllocations: Array<{ chainSlug: string; chainName: string; usdValue: number }>;
  protocolAllocations: Array<{ protocolId: string; protocolName: string; usdValue: number }>;
  change24h?: number;
  change24hAbsolute?: number;
}

const MAX_SNAPSHOTS = 90;
const STORAGE_KEY = (address: string) => `folio_snapshots_${normalizeTrackedAddress(address)}`;

export function loadSnapshots(address: string): PortfolioSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY(address));
    if (!raw) return [];
    return JSON.parse(raw) as PortfolioSnapshot[];
  } catch {
    return [];
  }
}

export function saveSnapshot(snapshot: PortfolioSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    const existing = loadSnapshots(snapshot.address);
    const lastSnap = existing[existing.length - 1];
    if (lastSnap) {
      const diffMs = new Date(snapshot.timestamp).getTime() - new Date(lastSnap.timestamp).getTime();
      if (diffMs < 5 * 60 * 1000) return;
    }

    if (lastSnap && lastSnap.totalUsdValue > 0) {
      const pctChange = Math.abs((snapshot.totalUsdValue - lastSnap.totalUsdValue) / lastSnap.totalUsdValue);
      if (pctChange < 0.001) return;
    }

    const updated = [...existing, snapshot];
    const pruned = updated.slice(-MAX_SNAPSHOTS);
    localStorage.setItem(STORAGE_KEY(snapshot.address), JSON.stringify(pruned));
  } catch {
    return;
  }
}

export function clearSnapshots(address: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY(address));
}

export function buildSnapshot(
  address: string,
  portfolio: Portfolio,
  perps?: PerpsApiResponse | null,
): PortfolioSnapshot {
  const s = portfolio.summary;
  const normalizedAddress = normalizeTrackedAddress(address);

  return {
    id: `${normalizedAddress}-${Date.now()}`,
    address: normalizedAddress,
    timestamp: new Date().toISOString(),
    totalUsdValue: s.totalUsdValue,
    walletUsdValue: s.walletUsdValue,
    defiNetUsdValue: s.defiNetUsdValue,
    totalBorrowUsdValue: s.totalBorrowUsdValue,
    perpUnrealizedPnl: perps?.totalUnrealizedPnl ?? 0,
    perpAccountValue: perps?.totalAccountValue ?? 0,
    activeChainCount: s.activeChainCount,
    activeProtocolCount: s.activeProtocolCount,
    assetCount: s.totalAssetCount,
    topHoldings: portfolio.aggregated
      .filter((h) => h.totalUsdValue > 5)
      .slice(0, 10)
      .map((h) => ({ symbol: h.symbol, usdValue: h.totalUsdValue, price: h.price ?? 0 })),
    chainAllocations: portfolio.chainAllocations
      .filter((c) => c.totalUsdValue > 0)
      .map((c) => ({ chainSlug: c.chainSlug, chainName: c.chainName, usdValue: c.totalUsdValue })),
    protocolAllocations: portfolio.protocolAllocations
      .filter((p) => p.netUsdValue > 0)
      .map((p) => ({ protocolId: p.protocolId, protocolName: p.protocolName, usdValue: p.netUsdValue })),
    change24h: s.change24h,
    change24hAbsolute: s.change24hAbsolute,
  };
}

export type SnapshotRange = "1H" | "4H" | "24H" | "7D" | "30D" | "ALL";

export function filterByRange(
  snapshots: PortfolioSnapshot[],
  range: SnapshotRange,
): PortfolioSnapshot[] {
  if (range === "ALL") return snapshots;

  const now = Date.now();
  const msMap: Record<SnapshotRange, number> = {
    "1H": 60 * 60 * 1000,
    "4H": 4 * 60 * 60 * 1000,
    "24H": 24 * 60 * 60 * 1000,
    "7D": 7 * 24 * 60 * 60 * 1000,
    "30D": 30 * 24 * 60 * 60 * 1000,
    "ALL": Infinity,
  };
  const cutoff = now - msMap[range];
  return snapshots.filter((s) => new Date(s.timestamp).getTime() >= cutoff);
}

export interface ChangeAttribution {
  totalChangeDollars: number;
  totalChangePct: number;
  priceMovement: number;
  defiYield: number;
  rewards: number;
  perpChange: number;
  netTransfers: number;
  fees: number;
  isEstimated: boolean;
  period: string;
}

export function computeAttribution(
  current: PortfolioSnapshot,
  previous: PortfolioSnapshot,
  currentPortfolio?: Portfolio,
): ChangeAttribution {
  const totalChangeDollars = current.totalUsdValue - previous.totalUsdValue;
  const totalChangePct = previous.totalUsdValue > 0
    ? (totalChangeDollars / previous.totalUsdValue) * 100
    : 0;

  let priceMovement = 0;
  for (const curr of current.topHoldings) {
    const prev = previous.topHoldings.find((h) => h.symbol === curr.symbol);
    if (prev && prev.price > 0 && curr.price > 0) {
      const priceChangePct = (curr.price - prev.price) / prev.price;
      priceMovement += prev.usdValue * priceChangePct;
    }
  }

  const perpChange = current.perpUnrealizedPnl - previous.perpUnrealizedPnl;
  const defiDelta = current.defiNetUsdValue - previous.defiNetUsdValue;
  const defiYield = Math.max(0, defiDelta * 0.3);

  const rewards = currentPortfolio
    ? currentPortfolio.protocols.reduce((sum, protocol) => sum + protocol.totalRewardUsd, 0)
    : 0;

  const explained = priceMovement + defiYield + rewards + perpChange;
  const netTransfers = totalChangeDollars - explained;

  const diffMs = new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime();
  const diffH = diffMs / (1000 * 60 * 60);
  const period = diffH < 1
    ? `${Math.round(diffH * 60)}m ago`
    : diffH < 48
    ? `${Math.round(diffH)}h`
    : `${Math.round(diffH / 24)}d`;

  return {
    totalChangeDollars,
    totalChangePct,
    priceMovement,
    defiYield,
    rewards,
    perpChange,
    netTransfers,
    fees: 0,
    isEstimated: true,
    period,
  };
}