"use client";

import { Flame } from "lucide-react";
import { useTrending } from "@/hooks/useTrending";
import { cn } from "@/lib/utils";

/** Trending coins (CoinGecko) — ambient "what's hot" widget, free. */
export function TrendingTokens() {
  const { data } = useTrending();
  const coins = data?.coins ?? [];
  if (coins.length === 0) return null;

  return (
    <div className="rounded-[12px] border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-warning" />
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-lo">Trending</p>
        </div>
        <p className="text-[11px] text-text-lo">CoinGecko · 24h</p>
      </div>
      <div className="mt-3 divide-y divide-border">
        {coins.map((c, i) => (
          <div key={`${c.symbol}-${i}`} className="flex items-center gap-2.5 py-2">
            <span className="num w-4 text-[11px] text-text-lo">{i + 1}</span>
            {c.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.thumb} alt={c.symbol} className="h-5 w-5 rounded-full" />
            ) : (
              <span className="h-5 w-5 rounded-full bg-surface-raised" />
            )}
            <span className="min-w-0 flex-1 truncate text-sm">
              <span className="font-medium text-text-hi">{c.symbol.toUpperCase()}</span>
              <span className="ml-1.5 text-[11px] text-text-lo">{c.name}</span>
            </span>
            {c.change24h != null ? (
              <span className={cn("num text-xs font-medium", c.change24h >= 0 ? "text-success" : "text-danger")}>
                {c.change24h >= 0 ? "+" : ""}{c.change24h.toFixed(1)}%
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
