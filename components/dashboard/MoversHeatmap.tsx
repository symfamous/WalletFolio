"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn, formatUSD } from "@/lib/utils";
import type { Portfolio } from "@/types";

interface Mover {
  key: string;
  symbol: string;
  usd: number;
  change: number;
}

function MoverRow({ m }: { m: Mover }) {
  const up = m.change >= 0;
  const mag = Math.min(Math.abs(m.change) / 20, 1); // bar fill, 20%+ = full
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-16 shrink-0 truncate text-xs font-medium text-text-hi">{m.symbol}</span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full", up ? "bg-success" : "bg-danger")}
          style={{ width: `${Math.max(mag * 100, 6)}%` }}
        />
      </div>
      <span className="num w-14 shrink-0 text-right text-xs text-text-lo">{formatUSD(m.usd, { compact: true })}</span>
      <span className={cn("num w-16 shrink-0 text-right text-xs font-medium", up ? "text-success" : "text-danger")}>
        {up ? "+" : ""}{m.change.toFixed(2)}%
      </span>
    </div>
  );
}

/**
 * Gainers & Losers — a clean two-column list (top gainers / top losers) of
 * non-stable holdings by 24h move. Clearer than a treemap for small portfolios.
 */
export function MoversHeatmap({ portfolio }: { portfolio: Portfolio }) {
  const { gainers, losers } = useMemo(() => {
    const priced = portfolio.aggregated.filter(
      (h) => h.priceAvailable && h.totalUsdValue > 0 && h.priceChange24h !== undefined && !h.isStablecoin
    );
    const mapped: Mover[] = priced.map((h) => ({
      key: h.aggregateKey,
      symbol: h.symbol,
      usd: h.totalUsdValue,
      change: h.priceChange24h ?? 0,
    }));
    return {
      gainers: mapped.filter((m) => m.change > 0).sort((a, b) => b.change - a.change).slice(0, 5),
      losers: mapped.filter((m) => m.change < 0).sort((a, b) => a.change - b.change).slice(0, 5),
    };
  }, [portfolio.aggregated]);

  const empty = gainers.length === 0 && losers.length === 0;

  return (
    <div className="flex flex-col rounded-[12px] border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-lo">Gainers &amp; Losers</p>
        <p className="text-[11px] text-text-lo">24h · excludes stablecoins</p>
      </div>

      {empty ? (
        <div className="flex h-[160px] items-center justify-center text-sm text-text-lo">
          No non-stable holdings with 24h data.
        </div>
      ) : (
        <div className="mt-4 grid gap-x-8 gap-y-1 lg:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-success">
              <TrendingUp className="h-3.5 w-3.5" /> Top gainers
            </div>
            {gainers.length ? gainers.map((m) => <MoverRow key={m.key} m={m} />) : (
              <p className="py-2 text-xs text-text-lo">None up in 24h.</p>
            )}
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-danger">
              <TrendingDown className="h-3.5 w-3.5" /> Top losers
            </div>
            {losers.length ? losers.map((m) => <MoverRow key={m.key} m={m} />) : (
              <p className="py-2 text-xs text-text-lo">None down in 24h.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
