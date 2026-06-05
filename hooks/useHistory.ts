"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { isSolanaAddress } from "@/lib/utils";
import type { HistoryApiResponse, HistoryEvent } from "@/types";
import { HISTORY_CHAINS } from "@/lib/providers/history/etherscan";

// All known chain options for filter UI
const ALL_CHAIN_OPTIONS = [
  { slug: "all", name: "All chains" },
  ...HISTORY_CHAINS.map((c) => ({ slug: c.slug, name: c.name })),
];

async function fetchHistory(
  address:    string,
  chainSlug?: string,
  page        = 1,
  cursor?:    string,
): Promise<HistoryApiResponse> {
  // Preserve case for Solana; lowercase for EVM
  const normAddr = (isSolanaAddress(address) && !address.startsWith("0x"))
    ? address
    : address.toLowerCase();
  const url = new URL(`/api/history/${normAddr}`, window.location.origin);
  if (chainSlug && chainSlug !== "all") url.searchParams.set("chain", chainSlug);
  url.searchParams.set("page", String(page));
  if (cursor) url.searchParams.set("cursor", cursor);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export function useHistory(address: string | undefined) {
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [page,        setPage]        = useState(1);
  const [cursor,      setCursor]      = useState<string | undefined>();
  const [accumulated, setAccumulated] = useState<HistoryEvent[][]>([]);

  // Reset on address change
  useEffect(() => {
    setPage(1); setCursor(undefined); setAccumulated([]); setChainFilter("all");
  }, [address]);

  // Reset on chain filter change
  useEffect(() => {
    setPage(1); setCursor(undefined); setAccumulated([]);
  }, [chainFilter]);

  const q = useQuery<HistoryApiResponse, Error>({
    queryKey:  ["history", address, chainFilter, page, cursor],
    queryFn:   () => fetchHistory(
      address!,
      chainFilter === "all" ? undefined : chainFilter,
      page,
      cursor,
    ),
    enabled:   Boolean(address),
    staleTime: 60_000,
    gcTime:    10 * 60_000,
    retry:     1,
  });

  function loadMore() {
    const d = q.data;
    if (!d?.hasMore) return;
    setAccumulated((prev: HistoryEvent[][]) => [...prev, d.events]);
    if (d.cursor)        setCursor(d.cursor);
    else if (d.nextPage) setPage(d.nextPage);
  }

  const allEvents: HistoryEvent[] = [
    ...accumulated.flat(),
    ...(q.data?.events ?? []),
  ];

  // Build chain filter options from actual returned chains
  const returnedSlugs = new Set(allEvents.map((e) => e.chainSlug));
  const chainOptions = [
    { slug: "all", name: "All chains" },
    ...ALL_CHAIN_OPTIONS.filter((c) => c.slug !== "all" && returnedSlugs.has(c.slug)),
    // Any extra chains returned (e.g. Zerion-only chains not in our list)
    ...[...returnedSlugs]
      .filter((s) => !ALL_CHAIN_OPTIONS.some((c) => c.slug === s))
      .map((s) => ({ slug: s, name: s })),
  ];

  return {
    events:      allEvents,
    chainFilter, setChainFilter,
    chainOptions,
    hasMore:     q.data?.hasMore          ?? false,
    isLoading:   q.isLoading,
    isFetching:  q.isFetching,
    isError:     q.isError,
    error:       q.error,
    loadMore,
    // Provider metadata
    provider:          q.data?.provider,
    providerLabel:     q.data?.providerLabel,
    chainsWithData:    q.data?.chainsWithData,
    chainsAvailable:   q.data?.chainsAvailable ?? HISTORY_CHAINS.length,
    chainsQueried:     q.data?.chainsQueried,
    freeTierNote:      q.data?.freeTierNote,
    zerionEventCount:  q.data?.zerionEventCount,
    escanEventCount:   q.data?.escanEventCount,
    totalMerged:       q.data?.totalMerged,
  };
}