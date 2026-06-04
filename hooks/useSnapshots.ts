"use client";

import { useState, useEffect, useCallback } from "react";
import {
  loadSnapshots, saveSnapshot, buildSnapshot, filterByRange,
  computeAttribution,
  type PortfolioSnapshot, type SnapshotRange, type ChangeAttribution,
} from "@/lib/snapshots";
import type { Portfolio, PerpsApiResponse } from "@/types";

export function useSnapshots(
  address: string | undefined,
  portfolio?: Portfolio,
  perps?: PerpsApiResponse | null,
) {
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [range, setRange] = useState<SnapshotRange>("24H");

  useEffect(() => {
    if (!address) {
      setSnapshots([]);
      return;
    }
    setSnapshots(loadSnapshots(address));
  }, [address]);

  useEffect(() => {
    if (!address || !portfolio) return;
    const snap = buildSnapshot(address, portfolio, perps);
    saveSnapshot(snap);
    setSnapshots(loadSnapshots(address));
  }, [address, portfolio, perps]);

  const filtered = filterByRange(snapshots, range);

  const attribution: ChangeAttribution | null = (() => {
    if (filtered.length < 2) return null;
    const current = filtered[filtered.length - 1];
    const previous = filtered[filtered.length - 2];
    return computeAttribution(current, previous, portfolio);
  })();

  const chartData = filtered.map((s) => ({
    timestamp: s.timestamp,
    total: s.totalUsdValue,
    wallet: s.walletUsdValue,
    defi: s.defiNetUsdValue,
    perp: s.perpUnrealizedPnl,
    label: formatChartDate(s.timestamp, range),
  }));

  const clearAll = useCallback(() => {
    if (!address) return;
    import("@/lib/snapshots").then(({ clearSnapshots }) => {
      clearSnapshots(address);
      setSnapshots([]);
    });
  }, [address]);

  return {
    snapshots,
    filtered,
    chartData,
    range,
    setRange,
    attribution,
    hasHistory: snapshots.length > 1,
    earliest: snapshots[0],
    clearAll,
  };
}

function formatChartDate(iso: string, range: SnapshotRange): string {
  const d = new Date(iso);
  if (range === "1H" || range === "4H" || range === "24H") {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (range === "7D") {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}