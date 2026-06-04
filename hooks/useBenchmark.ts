"use client";

import { useQuery } from "@tanstack/react-query";
import type { SnapshotRange } from "@/lib/snapshots";

export function useBenchmark(range: SnapshotRange) {
  return useQuery<{ btc: number | null; eth: number | null; range: SnapshotRange }, Error>({
    queryKey: ["benchmark", range],
    queryFn: async () => {
      const res = await fetch(`/api/benchmark?range=${range}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 2 * 60_000,
  });
}
