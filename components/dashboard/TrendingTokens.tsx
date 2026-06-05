"use client";

import { Flame } from "lucide-react";
import { useTrending } from "@/hooks/useTrending";
import { cn } from "@/lib/utils";

/** Format a USD price that may be a normal number or a tiny sub-cent value. */
function formatTrendingPrice(price: number): string {
  if (price <= 0) return "$0";
  if (price >= 1) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  // Sub-cent: show enough significant digits without a long zero run.
  const decimals = Math.min(12, Math.ceil(-Math.log10(price)) + 3);
  return `$${price.toFixed(decimals).replace(/0+$/, "")}`;
}

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
            <span className="flex flex-col items-end leading-tight">
              {c.price != null ? (
                <span className="num text-xs font-medium text-text-hi">{formatTrendingPrice(c.price)}</span>
              ) : null}
              {c.change24h != null ? (
                <span className={cn("num text-[11px] font-medium", c.change24h >= 0 ? "text-success" : "text-danger")}>
                  {c.change24h >= 0 ? "+" : ""}{c.change24h.toFixed(1)}%
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
