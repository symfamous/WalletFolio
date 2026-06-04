"use client";

import { useQueries } from "@tanstack/react-query";
import { isSolanaAddress } from "@/lib/utils";
import type { PortfolioApiResponse } from "@/types";
import type { WalletEntry } from "@/hooks/useMultiWallet";

function endpointFor(address: string): string {
  const isSolana = isSolanaAddress(address) && !address.startsWith("0x");
  return isSolana
    ? `/api/solana/${address}`
    : `/api/portfolio/${address.toLowerCase()}`;
}

async function fetchPortfolio(address: string): Promise<PortfolioApiResponse> {
  const res = await fetch(endpointFor(address), { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<PortfolioApiResponse>;
}

export interface WalletResult {
  address: string;
  label?: string;
  chain: "evm" | "solana";
  data?: PortfolioApiResponse;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error?: Error | null;
  refetch: () => void;
}

interface UseMultiPortfolioOptions {
  activeAddress?: string;
  fetchStrategy?: "all" | "active-only";
}

export function useMultiPortfolio(wallets: WalletEntry[], options: UseMultiPortfolioOptions = {}) {
  const { activeAddress, fetchStrategy = "all" } = options;
  const eagerAddress = activeAddress || wallets[0]?.address;

  const results = useQueries({
    queries: wallets.map((w) => ({
      queryKey: ["portfolio", w.address],
      queryFn: () => fetchPortfolio(w.address),
      enabled: fetchStrategy === "all"
        ? Boolean(w.address)
        : Boolean(w.address && eagerAddress && w.address === eagerAddress),
      staleTime: 10_000,
      gcTime: 5 * 60_000,
      refetchInterval: 30_000,
      retry: 2,
      retryDelay: (a: number) => Math.min(1_000 * 2 ** a, 8_000),
      refetchOnWindowFocus: false,
      placeholderData: (previousData: PortfolioApiResponse | undefined) => previousData,
    })),
  });

  const walletResults: WalletResult[] = wallets.map((w, i) => ({
    address: w.address,
    label: w.label,
    chain: (isSolanaAddress(w.address) && !w.address.startsWith("0x")) ? "solana" : "evm",
    data: results[i]?.data,
    isLoading: results[i]?.isLoading ?? false,
    isFetching: results[i]?.isFetching ?? false,
    isError: results[i]?.isError ?? false,
    error: results[i]?.error ?? null,
    refetch: () => { void results[i]?.refetch(); },
  }));

  const combined = walletResults.reduce(
    (acc, w) => {
      const s = w.data?.portfolio?.summary;
      if (!s) return acc;
      return {
        totalUsdValue: acc.totalUsdValue + (s.totalUsdValue ?? 0),
        walletUsdValue: acc.walletUsdValue + (s.walletUsdValue ?? 0),
        defiUsdValue: acc.defiUsdValue + (s.defiNetUsdValue ?? 0),
      };
    },
    { totalUsdValue: 0, walletUsdValue: 0, defiUsdValue: 0 },
  );

  const isAnyLoading = walletResults.some((w) => w.isLoading);
  const isAnyFetching = walletResults.some((w) => w.isFetching);
  const refetchAll = () => {
    walletResults.forEach((w) => {
      if (fetchStrategy === "all" || w.address === eagerAddress) {
        w.refetch();
      }
    });
  };

  return { walletResults, combined, isAnyLoading, isAnyFetching, refetchAll };
}