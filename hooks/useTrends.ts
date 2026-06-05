"use client";

import { useQuery } from "@tanstack/react-query";

export interface TrendCoin {
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  price: number;
  rank: number | null;
  change1h: number;
  change24h: number;
  change7d: number;
  volMcap: number;
  score: number;
}

export function useTrends() {
  return useQuery<{ trends: TrendCoin[] }, Error>({
    queryKey: ["early-trends"],
    queryFn: async () => {
      const res = await fetch("/api/trends", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{ trends: TrendCoin[] }>;
    },
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}
