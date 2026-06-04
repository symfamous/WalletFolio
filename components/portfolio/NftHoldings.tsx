"use client";

import { useEffect, useRef } from "react";
import { ExternalLink, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useNfts } from "@/hooks/useNfts";
import { formatUSD } from "@/lib/utils";

// Cap auto-screening so the rate-limited free OpenSea key isn't hammered forever.
const MAX_AUTO_PAGES = 30;

export function NftHoldings({ address, compact = false }: { address: string; compact?: boolean }) {
  const nfts = useNfts(address);
  const data = nfts.data;
  const minValueUsd = data?.minValueUsd ?? 10;

  // Auto-scan every collection page (one at a time) instead of stopping after
  // the first batch — so all collections get screened without manual clicks.
  const autoPages = useRef(0);
  useEffect(() => {
    autoPages.current = 0;
  }, [address]);
  useEffect(() => {
    if (nfts.hasMore && !nfts.isFetchingNextPage && !nfts.isError && autoPages.current < MAX_AUTO_PAGES) {
      autoPages.current += 1;
      nfts.loadMore();
    }
  }, [nfts.hasMore, nfts.isFetchingNextPage, nfts.isError, nfts.loadMore]);

  const scanMoreButton = nfts.hasMore ? (
    <button
      type="button"
      onClick={() => nfts.loadMore()}
      disabled={nfts.isFetchingNextPage}
      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-accent/25 bg-accent/5 px-3 py-2 text-xs text-accent transition-colors hover:bg-accent/10 disabled:cursor-wait disabled:opacity-60"
    >
      {nfts.isFetchingNextPage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
      {nfts.isFetchingNextPage ? "Screening collections…" : "Continue NFT screening"}
    </button>
  ) : null;

  if (nfts.isLoading) {
    return (
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: compact ? 3 : 6 }).map((_, index) => (
          <div key={index} className="h-56 animate-pulse rounded-xl border border-border bg-surface-raised" />
        ))}
      </div>
    );
  }

  if (nfts.isError) {
    return (
      <div className="rounded-xl border border-warning/20 bg-warning/5 p-6 text-center">
        <p className="text-sm text-warning">OpenSea NFT data could not be loaded.</p>
        <button type="button" onClick={() => nfts.refetch()} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-text-mid">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (nfts.nfts.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-raised p-6 text-center">
        <ShieldCheck className="mx-auto h-7 w-7 text-accent" />
        <p className="mt-2 text-sm text-text-hi">No displayable NFTs found</p>
        <p className="mt-1 text-xs leading-relaxed text-text-lo">
          Showing NFTs from collections with a real floor price. Spam, NSFW, and zero-value items are hidden.
        </p>
        {(data?.collectionsScanned ?? 0) > 0 ? (
          <p className="mt-2 text-[10px] text-text-lo">{data?.filteredCount} item(s) in screened collections were excluded.</p>
        ) : null}
        {scanMoreButton}
        {data?.note ? <p className="mt-3 text-[10px] text-text-lo">{data.note}</p> : null}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-text-lo">
          {nfts.nfts.length} NFT{nfts.nfts.length === 1 ? "" : "s"} with a floor price
          <span className="ml-1 inline-flex items-center gap-1 text-success">
            <ShieldCheck className="h-3 w-3" /> = verified collection
          </span>
        </p>
        {nfts.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> : null}
      </div>
      <div className={`grid gap-3 ${compact ? "grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
        {nfts.nfts.map((nft) => (
          <a
            key={nft.id}
            href={nft.openseaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group overflow-hidden rounded-xl border border-accent/12 bg-surface transition-colors hover:border-accent/30"
          >
            <div className="aspect-square overflow-hidden bg-surface-raised">
              <img
                src={nft.imageUrl}
                alt={nft.name}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </div>
            <div className="space-y-1.5 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[10px] uppercase tracking-[0.12em] text-accent">{nft.collectionName}</p>
                {nft.safelistStatus === "verified" ? (
                  <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 text-success" />
                ) : null}
              </div>
              <p className="truncate text-sm font-medium text-text-hi">{nft.name}</p>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-[10px] text-text-lo">Floor estimate</p>
                  <p className="num text-sm font-semibold text-text-hi">{formatUSD(nft.estimatedValueUsd)}</p>
                  <p className="num text-[10px] text-text-lo">{nft.floorPrice} {nft.floorPriceSymbol}</p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-text-lo transition-colors group-hover:text-accent" />
              </div>
            </div>
          </a>
        ))}
      </div>
      {scanMoreButton}
      {data?.note ? <p className="mt-3 text-[10px] text-text-lo">{data.note}</p> : null}
    </div>
  );
}
