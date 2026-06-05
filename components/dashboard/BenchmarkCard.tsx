"use client";

import { useMemo, useState } from "react";
import { Trophy, TrendingDown, TrendingUp } from "lucide-react";
import { usePortfolioChart } from "@/hooks/usePortfolioChart";
import { useBenchmark } from "@/hooks/useBenchmark";
import type { SnapshotRange } from "@/lib/snapshots";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";

const RANGES: SnapshotRange[] = ["24H", "7D", "30D", "ALL"];

function pctLabel(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function Bar({ label, value, accent, reference }: { label: string; value: number | null; accent?: boolean; reference: number }) {
  const up = (value ?? 0) >= 0;
  const mag = value === null ? 0 : Math.min(Math.abs(value) / Math.max(reference, 1), 1);
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className={cn("w-20 shrink-0 text-xs font-medium", accent ? "text-text-hi" : "text-text-mid")}>{label}</span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full", up ? "bg-success" : "bg-danger", accent && "opacity-100")}
          style={{ width: `${Math.max(mag * 100, value === null ? 0 : 5)}%`, opacity: accent ? 1 : 0.55 }}
        />
      </div>
      <span className={cn("num w-16 shrink-0 text-right text-xs font-medium", value === null ? "text-text-lo" : up ? "text-success" : "text-danger")}>
        {pctLabel(value)}
      </span>
    </div>
  );
}

/**
 * "Are you beating the market?" — compares the wallet's % return over a range
 * against BTC and ETH. Shared by desktop and PWA. Free data (Binance klines +
 * the wallet's own snapshot history).
 */
export function BenchmarkCard({ address }: { address: string }) {
  const [range, setRange] = useState<SnapshotRange>("30D");
  const chart = usePortfolioChart(address, range);
  const benchmark = useBenchmark(range);

  const youReturn = useMemo(() => {
    const pts = chart.chartData;
    if (pts.length < 2 || !pts[0].total) return null;
    return ((pts[pts.length - 1].total - pts[0].total) / pts[0].total) * 100;
  }, [chart.chartData]);

  const btc = benchmark.data?.btc ?? null;
  const eth = benchmark.data?.eth ?? null;
  const reference = Math.max(
    Math.abs(youReturn ?? 0),
    Math.abs(btc ?? 0),
    Math.abs(eth ?? 0),
    1
  );

  const beatsBtc = youReturn !== null && btc !== null && youReturn >= btc;
  const beatsEth = youReturn !== null && eth !== null && youReturn >= eth;
  const haveVerdict = youReturn !== null && (btc !== null || eth !== null);
  const beatsBoth = beatsBtc && beatsEth;

  return (
    <Card noPadding className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-accent" strokeWidth={1.6} />
          <div>
            <h2 className="text-sm font-semibold text-text-hi">Vs the market</h2>
            <p className="text-[11px] text-text-lo">Your return vs BTC &amp; ETH</p>
          </div>
        </div>
        <div className="flex rounded-lg border border-border bg-surface-raised p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "rounded-md px-2 py-1 text-[10px] transition-colors",
                range === r ? "bg-accent/12 text-accent" : "text-text-lo hover:text-text-mid"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {!chart.hasHistory ? (
        <p className="px-4 py-6 text-center text-xs text-text-lo">
          {chart.isLoading ? "Loading history…" : "Not enough snapshot history yet — your return will appear as the wallet is tracked over time."}
        </p>
      ) : (
        <>
          {haveVerdict ? (
            <div className={cn(
              "mx-4 mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium",
              beatsBoth ? "border-success/25 bg-success/8 text-success" : "border-border bg-surface-raised/40 text-text-mid"
            )}>
              {beatsBoth ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {beatsBoth
                ? "Beating both BTC and ETH this period."
                : beatsBtc
                  ? "Beating BTC, trailing ETH."
                  : beatsEth
                    ? "Beating ETH, trailing BTC."
                    : "Trailing both BTC and ETH this period."}
            </div>
          ) : null}

          <div className="space-y-0.5 px-4 py-3">
            <Bar label="You" value={youReturn} accent reference={reference} />
            <Bar label="BTC" value={btc} reference={reference} />
            <Bar label="ETH" value={eth} reference={reference} />
          </div>
        </>
      )}
    </Card>
  );
}
