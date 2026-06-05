"use client";

import { useQuery } from "@tanstack/react-query";

export interface TrendingCoin {
  symbol: string;
  name: string;
  thumb: string;
  rank: number | null;
  price: number | null;
  change24h: number | null;
}

export function useTrending() {
  return useQuery<{ coins: TrendingCoin[] }, Error>({
    queryKey: ["trending"],
    queryFn: async () => {
      const res = await fetch("/api/trending", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{ coins: TrendingCoin[] }>;
    },
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}
