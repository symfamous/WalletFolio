"use client";

import { useQuery } from "@tanstack/react-query";
import { isSolanaAddress } from "@/lib/utils";
import type { PortfolioApiResponse } from "@/types";

async function fetchPortfolio(address: string): Promise<PortfolioApiResponse> {
  const isSolana = isSolanaAddress(address) && !address.startsWith("0x");
  const endpoint = isSolana
    ? `/api/solana/${address}`
    : `/api/portfolio/${address.toLowerCase()}`;

  const res = await fetch(endpoint, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<PortfolioApiResponse>;
}

export function usePortfolio(address: string | undefined) {
  const normalised = address
    ? (isSolanaAddress(address) && !address.startsWith("0x")
        ? address
        : address.toLowerCase())
    : undefined;

  const q = useQuery<PortfolioApiResponse, Error>({
    queryKey: ["portfolio", normalised],
    queryFn: () => fetchPortfolio(normalised!),
    enabled: Boolean(normalised),
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    retry: 2,
    retryDelay: (a) => Math.min(1_000 * 2 ** a, 8_000),
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });

  return {
    portfolio: q.data?.portfolio,
    intelligence: q.data?.intelligence,
    providerStatus: q.data?.providerStatus,
    timestamp: q.data?.timestamp,
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    isError: q.isError,
    error: q.error,
    refetch: q.refetch,
  };
}