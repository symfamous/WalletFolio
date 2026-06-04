"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { loadSnapshots, type PortfolioSnapshot } from "@/lib/snapshots";
import { buildRecurringBehaviorInsights, type BehaviorWalletInput } from "@/lib/behaviorInsights";
import { isSolanaAddress, shortenAddress } from "@/lib/utils";
import type { WalletResult } from "@/hooks/useMultiPortfolio";
import type { WalletEntry } from "@/hooks/useMultiWallet";
import type { HistoryApiResponse, PerpsApiResponse, Portfolio, PortfolioGoal } from "@/types";

function historyEndpoint(address: string): string {
  const normalizedAddress = isSolanaAddress(address) && !address.startsWith("0x")
    ? address
    : address.toLowerCase();
  return `/api/history/${normalizedAddress}?page=1`;
}

async function fetchRecentHistory(address: string): Promise<HistoryApiResponse> {
  const response = await fetch(historyEndpoint(address), { cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<HistoryApiResponse>;
}

interface UseBehaviorInsightsOptions {
  trackedWallets: WalletEntry[];
  walletResults?: WalletResult[];
  activeAddress: string;
  activePortfolio?: Portfolio;
  activePerps?: PerpsApiResponse | null;
  selectedGoal: PortfolioGoal;
}

export function useBehaviorInsights({
  trackedWallets,
  walletResults = [],
  activeAddress,
  activePortfolio,
  activePerps,
  selectedGoal,
}: UseBehaviorInsightsOptions) {
  const trackedAddresses = useMemo(() => {
    const map = new Map<string, WalletEntry>();
    for (const wallet of trackedWallets) {
      map.set(wallet.address, wallet);
    }
    if (activeAddress && !map.has(activeAddress)) {
      map.set(activeAddress, { address: activeAddress, label: shortenAddress(activeAddress) });
    }
    return [...map.values()];
  }, [trackedWallets, activeAddress]);

  const [snapshotMap, setSnapshotMap] = useState<Record<string, PortfolioSnapshot[]>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const next: Record<string, PortfolioSnapshot[]> = {};
    for (const wallet of trackedAddresses) {
      next[wallet.address] = loadSnapshots(wallet.address);
    }
    setSnapshotMap(next);
  }, [trackedAddresses]);

  const historyQueries = useQueries({
    queries: trackedAddresses.map((wallet) => ({
      queryKey: ["behavior-history", wallet.address],
      queryFn: () => fetchRecentHistory(wallet.address),
      enabled: Boolean(wallet.address),
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    })),
  });

  const walletInputs = useMemo(() => {
    return trackedAddresses.map<BehaviorWalletInput>((wallet, index) => {
      const walletResult = walletResults.find((result) => result.address === wallet.address);
      return {
        address: wallet.address,
        label: wallet.label || shortenAddress(wallet.address),
        portfolio: wallet.address === activeAddress ? activePortfolio : walletResult?.data?.portfolio,
        perps: wallet.address === activeAddress ? activePerps : null,
        snapshots: snapshotMap[wallet.address] ?? [],
        historyEvents: historyQueries[index]?.data?.events ?? [],
      };
    });
  }, [trackedAddresses, walletResults, activeAddress, activePortfolio, activePerps, snapshotMap, historyQueries]);

  const summary = useMemo(
    () => buildRecurringBehaviorInsights(walletInputs, selectedGoal),
    [walletInputs, selectedGoal]
  );

  return {
    summary,
    isLoading: historyQueries.some((query) => query.isLoading),
    isFetching: historyQueries.some((query) => query.isFetching),
  };
}
