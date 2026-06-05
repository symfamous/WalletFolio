"use client";

import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Trash2, Info } from "lucide-react";
import { cn, formatUSD } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import type { SnapshotRange } from "@/lib/snapshots";

interface ChartPoint {
  timestamp: string;
  total: number;
  wallet: number;
  defi: number;
  perp: number;
  label: string;
}

interface PortfolioTimelineProps {
  chartData: ChartPoint[];
  range: SnapshotRange;
  onRangeChange: (r: SnapshotRange) => void;
  hasHistory: boolean;
  earliestDate?: string;
  onClearHistory?: () => void;
  format: (usd: number) => string;
}

const RANGES: SnapshotRange[] = ["1H", "4H", "24H", "7D", "30D", "ALL"];

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface-overlay px-4 py-3 shadow-2xl">
      <p className="text-xs text-text-lo mb-2">{label}</p>
      {payload.filter((p) => p.value > 0).map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-xs text-text-mid capitalize">{p.name}</span>
          </div>
          <span className="num text-xs font-semibold text-text-hi">{formatUSD(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function PortfolioTimeline({
  chartData,
  range,
  onRangeChange,
  hasHistory,
  earliestDate,
  onClearHistory,
  format,
}: PortfolioTimelineProps) {
  const firstValue = chartData[0]?.total ?? 0;
  const lastValue = chartData[chartData.length - 1]?.total ?? 0;
  const change = lastValue - firstValue;
  const changePct = firstValue > 0 ? (change / firstValue) * 100 : 0;
  const isUp = change >= 0;

  const hasDefi = chartData.some((d) => d.defi > 1);

  const domain = useMemo((): [number | string, number | string] => {
    if (!chartData.length) return ["auto", "auto"];
    const vals = chartData.map((d) => d.total).filter((v) => v > 0);
    if (!vals.length) return ["auto", "auto"];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.12 || max * 0.05;
    return [Math.max(0, min - pad), max + pad];
  }, [chartData]);

  return (
    <Card noPadding className="overflow-hidden">
      {!hasHistory || chartData.length < 2 ? (
        <div className="flex flex-col items-center justify-center py-14 px-8 text-center">
          <div className="h-12 w-12 rounded-2xl border border-accent/20 bg-accent/10 flex items-center justify-center mb-4">
            <Info className="h-6 w-6 text-accent" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-semibold text-text-hi mb-1">Building your timeline</p>
          <p className="text-xs text-text-mid max-w-xs leading-relaxed">
            History starts from today. Every time you refresh, a new snapshot is saved.
            Come back later to see your portfolio evolve over time.
          </p>
          {earliestDate && (
            <p className="text-[10px] text-text-lo mt-3">
              First snapshot: {new Date(earliestDate).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
            </p>
          )}
          <p className="text-[10px] text-text-lo mt-1">
            Snapshots are saved locally in your browser
          </p>
        </div>
      ) : (
        <div>
          <div className="flex flex-col gap-3 px-5 py-3.5 border-b border-border md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface-raised p-1 text-xs">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => onRangeChange(r)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 transition-colors font-medium",
                    range === r
                      ? "bg-accent/20 text-accent"
                      : "text-text-lo hover:text-text-mid",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 md:justify-end">
              <div className="flex items-center gap-2">
                <span className={cn("num text-sm font-semibold", isUp ? "text-success" : "text-danger")}>
                  {isUp ? "+" : ""}{formatUSD(change)}
                </span>
                <span className={cn(
                  "num text-xs px-1.5 py-0.5 rounded-md font-medium",
                  isUp ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
                )}>
                  {isUp ? "+" : ""}{changePct.toFixed(2)}%
                </span>
                {isUp
                  ? <TrendingUp className="h-3.5 w-3.5 text-success" />
                  : <TrendingDown className="h-3.5 w-3.5 text-danger" />}
              </div>

              {onClearHistory && (
                <button
                  onClick={onClearHistory}
                  className="p-1.5 rounded-lg border border-border text-text-lo hover:text-danger hover:border-danger/30 transition-colors"
                  title="Clear snapshot history"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          <div className="h-48 px-2 pt-4 pb-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradDefi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--text-hi)/0.04)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#40465A", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "#40465A", fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => formatUSD(v, { compact: true })}
                  domain={domain}
                  width={58}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={firstValue} stroke="rgb(var(--text-hi)/0.07)" strokeDasharray="4 4" />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="total"
                  stroke="#6366F1"
                  strokeWidth={2}
                  fill="url(#gradTotal)"
                  dot={false}
                  activeDot={{ r: 4, fill: "rgb(var(--accent))", stroke: "rgb(var(--bg))", strokeWidth: 2 }}
                />
                {hasDefi && (
                  <Area
                    type="monotone"
                    dataKey="defi"
                    name="defi"
                    stroke="#8B5CF6"
                    strokeWidth={1.5}
                    fill="url(#gradDefi)"
                    dot={false}
                    activeDot={{ r: 3, fill: "#8B5CF6" }}
                    strokeDasharray="4 2"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between px-5 py-3 border-t border-border/40">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-4 rounded-full bg-accent opacity-80" />
                <span className="text-[10px] text-text-lo">Total</span>
              </div>
              {hasDefi && (
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-4 rounded-full bg-success opacity-80" style={{ backgroundImage: "repeating-linear-gradient(90deg,transparent,transparent 3px,rgb(var(--success)) 3px,rgb(var(--success)) 5px)" }} />
                  <span className="text-[10px] text-text-lo">DeFi net</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="num text-xs font-semibold text-text-hi">{formatUSD(lastValue)}</p>
              <p className="text-[10px] text-text-lo">{chartData.length} snapshots</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}