"use client";

import { useQuery } from "@tanstack/react-query";
import { isSolanaAddress } from "@/lib/utils";
import type { PerpsApiResponse } from "@/types";

async function fetchPerps(address: string): Promise<PerpsApiResponse> {
  const normAddr = (isSolanaAddress(address) && !address.startsWith("0x"))
    ? address
    : address.toLowerCase();
  const res = await fetch(`/api/perps/${normAddr}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export function usePerps(address: string | undefined) {
  const q = useQuery<PerpsApiResponse, Error>({
    queryKey: ["perps", address],
    queryFn: () => fetchPerps(address!),
    enabled: Boolean(address),
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    retry: 1,
    placeholderData: (previousData) => previousData,
  });

  return {
    data: q.data ?? null,
    platforms: q.data?.platforms ?? [],
    allPositions: q.data?.allPositions ?? [],
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    isError: q.isError,
    error: q.error,
    hasPositions: (q.data?.openPositionCount ?? 0) > 0,
    totalUnrealizedPnl: q.data?.totalUnrealizedPnl ?? 0,
    netLifetimePnl: q.data?.netLifetimePnl ?? 0,
  };
}