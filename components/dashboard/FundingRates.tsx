"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useHyperliquidFunding } from "@/hooks/useHyperliquidFunding";
import { cn, formatUSD } from "@/lib/utils";

function compactUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return formatUSD(n, { compact: true });
}

/**
 * Hyperliquid funding & open interest. Pins the coins the user holds positions
 * in, then lists the highest-OI markets. Free public data.
 */
export function FundingRates({ highlightCoins = [] }: { highlightCoins?: string[] }) {
  const { data } = useHyperliquidFunding();
  const [open, setOpen] = useState(true);
  const highlight = useMemo(() => new Set(highlightCoins.map((c) => c.toUpperCase())), [highlightCoins]);

  const rows = useMemo(() => {
    const all = data?.markets ?? [];
    const pinned = all.filter((m) => highlight.has(m.coin.toUpperCase()));
    const rest = all.filter((m) => !highlight.has(m.coin.toUpperCase())).slice(0, 8);
    return [...pinned, ...rest];
  }, [data, highlight]);

  if (rows.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-surface shadow-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-raised",
          open && "border-b border-border"
        )}
        aria-expanded={open}
      >
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-lo">Funding &amp; Open Interest</p>
        <span className="flex items-center gap-2">
          <span className="text-[11px] text-text-lo">Hyperliquid · {rows.length} markets</span>
          <ChevronDown className={cn("h-4 w-4 text-text-lo transition-transform", !open && "-rotate-90")} />
        </span>
      </button>
      {open ? (
      <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-text-lo">Market</th>
            <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-text-lo">Mark</th>
            <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-text-lo">Funding APR</th>
            <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-text-lo whitespace-nowrap">Open Interest</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const pinned = highlight.has(m.coin.toUpperCase());
            return (
              <tr key={m.coin} className={cn("border-b border-border last:border-0", pinned && "bg-accent/[0.05]")}>
                <td className="px-3 py-2.5 text-sm whitespace-nowrap">
                  <span className="font-medium text-text-hi">{m.coin}</span>
                  {pinned ? <span className="ml-2 text-[10px] uppercase tracking-wide text-accent">held</span> : null}
                </td>
                <td className="num px-3 py-2.5 text-right text-sm text-text-mid whitespace-nowrap">
                  ${m.markPx >= 1 ? m.markPx.toLocaleString("en-US", { maximumFractionDigits: 2 }) : m.markPx.toPrecision(4)}
                </td>
                <td className={cn("num px-3 py-2.5 text-right text-sm font-medium whitespace-nowrap", m.fundingApr >= 0 ? "text-success" : "text-danger")}>
                  {m.fundingApr >= 0 ? "+" : ""}{m.fundingApr.toFixed(2)}%
                </td>
                <td className="num px-3 py-2.5 text-right text-sm text-text-mid whitespace-nowrap">{compactUsd(m.openInterestUsd)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      ) : null}
    </div>
  );
}
