"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { normalizeTrackedAddress } from "@/lib/utils";
import type { NftApiResponse } from "@/types";

async function fetchNfts(address: string, collectionCursor: number): Promise<NftApiResponse> {
  const query = collectionCursor ? `?collectionCursor=${collectionCursor}` : "";
  const response = await fetch(`/api/nfts/${normalizeTrackedAddress(address)}${query}`, { cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<NftApiResponse>;
}

export function useNfts(address: string | undefined) {
  const query = useInfiniteQuery<NftApiResponse, Error>({
    queryKey: ["nfts", address ? normalizeTrackedAddress(address) : undefined],
    queryFn: ({ pageParam }) => fetchNfts(address!, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCollectionCursor,
    enabled: Boolean(address),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
  });
  const pages = query.data?.pages ?? [];
  const firstPage = pages[0];
  const lastPage = pages[pages.length - 1];
  const mergedNfts = [...new Map(
    pages.flatMap((page) => page.nfts).map((nft) => [nft.id, nft])
  ).values()].sort((left, right) => right.estimatedValueUsd - left.estimatedValueUsd);
  const data = firstPage && lastPage ? {
    ...firstPage,
    nfts: mergedNfts,
    collectionsScanned: pages.reduce((total, page) => total + page.collectionsScanned, 0),
    filteredCount: pages.reduce((total, page) => total + page.filteredCount, 0),
    nextCollectionCursor: lastPage.nextCollectionCursor,
    incompleteCoverage: lastPage.incompleteCoverage,
    note: lastPage.note,
  } : undefined;

  return {
    data,
    nfts: mergedNfts,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    hasMore: Boolean(query.hasNextPage),
    loadMore: query.fetchNextPage,
  };
}
