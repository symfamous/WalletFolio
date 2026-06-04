"use client";

import { useQuery } from "@tanstack/react-query";

export interface FundingMarket {
  coin: string;
  fundingApr: number;
  fundingHourly: number;
  openInterestUsd: number;
  markPx: number;
  premium: number | null;
}

export function useHyperliquidFunding() {
  return useQuery<{ markets: FundingMarket[] }, Error>({
    queryKey: ["hl-funding"],
    queryFn: async () => {
      const res = await fetch("/api/hl-funding", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{ markets: FundingMarket[] }>;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
