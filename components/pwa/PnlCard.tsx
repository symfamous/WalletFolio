"use client";

import { useMemo } from "react";
import { Download, TrendingUp } from "lucide-react";
import type { Portfolio } from "@/types";
import { useHistory } from "@/hooks/useHistory";
import { buildPortfolioPnlLedger } from "@/lib/pnlLedger";
import { exportActivityCsv } from "@/lib/exportCsv";
import { cn, formatUSD } from "@/lib/utils";
import { Card } from "@/components/ui/Card";

/**
 * Mobile/PWA Profit & Loss card. Same FIFO ledger as the desktop PnlView, but laid out
 * in stacked tiles + rows instead of a wide table so nothing gets cut off on a phone.
 */
export function PnlCard({ address, portfolio }: { address: string; portfolio: Portfolio }) {
  const history = useHistory(address);
  const ledger = useMemo(
    () => buildPortfolioPnlLedger(portfolio.aggregated, history.events),
    [portfolio.aggregated, history.events]
  );

  const signed = (v: number) => `${v >= 0 ? "+" : "-"}${formatUSD(Math.abs(v))}`;
  const toneClass = (v: number | undefined) =>
    v === undefined ? "text-text-lo" : v >= 0 ? "text-success" : "text-danger";

  // Only list real holdings worth at least $10 (hides dust/spam), cap the list on mobile.
  const visibleAssets = ledger.assets.filter((a) => a.currentValueUsd >= 10).slice(0, 8);

  const kpis: Array<{ label: string; value: string; tone?: number | undefined; sub?: string }> = [
    { label: "Net P&L (tracked)", value: signed(ledger.netTrackedPnlUsd), tone: ledger.netTrackedPnlUsd },
    { label: "Unrealized", value: signed(ledger.unrealizedPnlUsd), tone: ledger.unrealizedPnlUsd },
    { label: "Realized", value: signed(ledger.realizedPnlUsd), tone: ledger.realizedPnlUsd },
    { label: "Cost basis", value: formatUSD(ledger.trackedCostBasisUsd), sub: `${ledger.tradeCount} trades` },
  ];

  return (
    <Card noPadding className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="flex items-center gap-2 min-w-0">
          <TrendingUp className="h-4 w-4 text-accent flex-shrink-0" strokeWidth={1.5} />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text-hi">Profit &amp; Loss</h2>
            <p className="text-[11px] text-text-lo truncate">Cost basis &amp; P&amp;L from loaded activity (FIFO)</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => exportActivityCsv(address, history.events)}
          disabled={history.events.length === 0}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-[10px] border border-border bg-surface-raised px-2.5 py-1.5 text-xs text-text-hi transition-colors hover:border-border-strong disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>

      {/* KPI tiles — 2x2 grid, no horizontal overflow */}
      <div className="mt-3 grid grid-cols-2 gap-2 px-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-surface-raised/30 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-text-lo">{k.label}</p>
            <p className={cn("num mt-1 text-sm font-semibold truncate", k.tone !== undefined ? toneClass(k.tone) : "text-text-hi")}>
              {k.value}
            </p>
            {k.sub ? <p className="text-[10px] text-text-lo">{k.sub}</p> : null}
          </div>
        ))}
      </div>

      {/* Coverage note */}
      <div className="mt-3 flex items-center gap-2 px-4">
        <span className="rounded-full border border-border bg-surface-raised px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-lo">
          {history.isLoading ? "loading…" : ledger.coverage}
        </span>
        <p className="text-[10px] leading-relaxed text-text-lo">{ledger.note}</p>
      </div>

      {/* Per-asset — stacked rows, no wide table */}
      <div className="mt-3 divide-y divide-border border-t border-border">
        {visibleAssets.length === 0 ? (
          <p className="px-4 py-5 text-center text-xs text-text-lo">
            No holdings above $10 to show yet — open Activity to load more history.
          </p>
        ) : (
          visibleAssets.map((a) => (
            <div key={a.symbol} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-text-hi">{a.symbol}</span>
                <span className="num text-sm text-text-hi">{formatUSD(a.currentValueUsd)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                <span className="text-text-lo">
                  Cost {a.trackedCostBasisUsd !== undefined ? formatUSD(a.trackedCostBasisUsd) : "—"}
                </span>
                <span className="flex items-center gap-3">
                  <span className={cn("num", toneClass(a.unrealizedPnlUsd))}>
                    U: {a.unrealizedPnlUsd !== undefined ? signed(a.unrealizedPnlUsd) : "—"}
                  </span>
                  <span className={cn("num", a.realizedPnlUsd >= 0 ? "text-success" : "text-danger")}>
                    R: {a.realizedPnlUsd !== 0 ? signed(a.realizedPnlUsd) : "—"}
                  </span>
                </span>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="h-3" />
    </Card>
  );
}
