"use client";

import { useQuery } from "@tanstack/react-query";
import { normalizeTrackedAddress } from "@/lib/utils";
import type { SnapshotRange } from "@/lib/snapshots";

interface ChartPoint {
  timestamp: string;
  total: number;
  label: string;
}

interface ChartResponse {
  points: { timestamp: string; total: number }[];
  range: SnapshotRange;
}

function formatLabel(iso: string, range: SnapshotRange): string {
  const d = new Date(iso);
  if (range === "1H" || range === "4H" || range === "24H") {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (range === "7D") return d.toLocaleDateString([], { weekday: "short", hour: "2-digit" });
  if (range === "ALL") return d.toLocaleDateString([], { month: "short", year: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "2-digit" });
}

/**
 * Real historical portfolio value from Zerion (via /api/portfolio-chart),
 * replacing the local-snapshot chart so history is available immediately.
 */
export function usePortfolioChart(address: string | undefined, range: SnapshotRange) {
  const q = useQuery<ChartResponse, Error>({
    queryKey: ["portfolio-chart", address ? normalizeTrackedAddress(address) : undefined, range],
    queryFn: async () => {
      const res = await fetch(
        `/api/portfolio-chart/${normalizeTrackedAddress(address!)}?range=${range}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<ChartResponse>;
    },
    enabled: Boolean(address),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const chartData: ChartPoint[] = (q.data?.points ?? []).map((p) => ({
    timestamp: p.timestamp,
    total: p.total,
    label: formatLabel(p.timestamp, range),
  }));

  return {
    chartData,
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    hasHistory: chartData.length > 1,
  };
}
