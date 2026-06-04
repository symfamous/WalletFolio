"use client";

import { useQuery } from "@tanstack/react-query";

export interface MarketContext {
  fearGreed: { value: number; label: string } | null;
  btcDominance: number | null;
  ethDominance: number | null;
  totalMarketCapUsd: number | null;
  marketCapChange24h: number | null;
  ethGasGwei: number | null;
  timestamp: string;
}

export function useMarket() {
  return useQuery<MarketContext, Error>({
    queryKey: ["market-context"],
    queryFn: async () => {
      const res = await fetch("/api/market", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<MarketContext>;
    },
    staleTime: 60_000,
    refetchInterval: 90_000,
  });
}
