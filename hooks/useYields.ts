"use client";

import { useQuery } from "@tanstack/react-query";
import { normalizeTrackedAddress } from "@/lib/utils";

export interface YieldPool {
  project: string;
  chain: string;
  apy: number;
  apyBase: number | null;
  tvlUsd: number;
  ilRisk: string;
  symbol: string;
  url: string;
}

interface YieldsResponse {
  bySymbol: Record<string, YieldPool[]>;
}

export function useYields(address: string | undefined, symbols: string[]) {
  const key = symbols.slice().sort().join(",");
  return useQuery<YieldsResponse, Error>({
    queryKey: ["yields", address ? normalizeTrackedAddress(address) : undefined, key],
    queryFn: async () => {
      const res = await fetch(
        `/api/yields/${normalizeTrackedAddress(address!)}?symbols=${encodeURIComponent(key)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<YieldsResponse>;
    },
    enabled: Boolean(address) && symbols.length > 0,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });
}
