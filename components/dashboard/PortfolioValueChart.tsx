"use client";

import { useMemo } from "react";
import { AreaChart, Area, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn, formatUSD } from "@/lib/utils";
import type { SnapshotRange } from "@/lib/snapshots";

interface ChartPoint {
  timestamp: string;
  total: number;
  label: string;
}

interface PortfolioValueChartProps {
  /** Big headline value */
  totalUsd: number;
  /** 24h change percent (for the headline delta) */
  change24h?: number;
  /** Optional formatted local-currency line under the value */
  localValue?: string;
  chartData: ChartPoint[];
  range: SnapshotRange;
  onRangeChange: (r: SnapshotRange) => void;
  hasHistory: boolean;
  /** Benchmark returns for the selected range (vs BTC / ETH). */
  benchmark?: { you: number | null; btc: number | null; eth: number | null };
}

function ReturnPill({ label, pct }: { label: string; pct: number | null }) {
  if (pct == null) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px]">
      <span className="text-text-lo">{label}</span>
      <span className={cn("num font-medium", pct >= 0 ? "text-success" : "text-danger")}>
        {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
      </span>
    </span>
  );
}

const RANGES: SnapshotRange[] = ["24H", "7D", "30D", "ALL"];

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: ChartPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-[8px] border border-border bg-surface-overlay px-3 py-2 shadow-popover">
      <p className="text-[11px] text-text-lo">{p.payload.label}</p>
      <p className="num text-sm font-semibold text-text-hi">{formatUSD(p.value)}</p>
    </div>
  );
}

/**
 * Hero portfolio card: large value + 24h delta + a 30-day area chart.
 * Degrades gracefully when there isn't enough local snapshot history yet.
 */
export function PortfolioValueChart({
  totalUsd,
  change24h,
  localValue,
  chartData,
  range,
  onRangeChange,
  hasHistory,
  benchmark,
}: PortfolioValueChartProps) {
  const up = (change24h ?? 0) >= 0;

  // Flatten to the value series; if history is too sparse, synthesize a flat
  // baseline so the card still reads as a chart rather than empty space.
  const series = useMemo(() => {
    if (chartData.length >= 2) return chartData;
    const now = totalUsd;
    return [
      { timestamp: "", total: now, label: "" },
      { timestamp: "", total: now, label: "now" },
    ];
  }, [chartData, totalUsd]);

  const min = Math.min(...series.map((d) => d.total));
  const max = Math.max(...series.map((d) => d.total));
  const pad = (max - min) * 0.15 || max * 0.02 || 1;

  return (
    <div className="flex flex-col rounded-[12px] border border-border bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-lo">Portfolio value</p>
          <p className="num mt-1.5 text-4xl font-semibold leading-none tracking-tight text-text-hi">
            {formatUSD(totalUsd)}
          </p>
          <div className="mt-2 flex items-center gap-2">
            {change24h !== undefined ? (
              <span className={cn("num inline-flex items-center gap-1 text-sm font-medium", up ? "text-success" : "text-danger")}>
                {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {up ? "+" : ""}{change24h.toFixed(2)}%
                <span className="text-text-lo">· 24h</span>
              </span>
            ) : (
              <span className="text-sm text-text-lo">Wallet + DeFi</span>
            )}
            {localValue ? <span className="num text-sm text-text-lo">· {localValue}</span> : null}
          </div>
        </div>

        {/* Range selector */}
        <div className="flex shrink-0 rounded-full border border-border bg-surface-raised p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRangeChange(r)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                range === r ? "bg-accent/15 text-accent" : "text-text-lo hover:text-text-hi"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-4 h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="pvc-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity={0.28} />
                <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={[min - pad, max + pad]} hide />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgb(var(--border-strong))", strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="total"
              stroke="rgb(var(--accent))"
              strokeWidth={2}
              fill="url(#pvc-fill)"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
        {!hasHistory ? (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4">
            <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[10px] text-text-lo">
              Building history — revisit to grow the chart
            </span>
          </div>
        ) : null}
      </div>

      {benchmark && (benchmark.you != null || benchmark.btc != null || benchmark.eth != null) ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3">
          <span className="text-[10px] uppercase tracking-wide text-text-lo">Return ({range})</span>
          <ReturnPill label="You" pct={benchmark.you} />
          <ReturnPill label="BTC" pct={benchmark.btc} />
          <ReturnPill label="ETH" pct={benchmark.eth} />
        </div>
      ) : null}
    </div>
  );
}
