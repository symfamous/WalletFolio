"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { buildPortfolioBuckets } from "@/lib/portfolioBuckets";
import { formatUSD } from "@/lib/utils";
import type { Portfolio } from "@/types";
import type { PortfolioBucketId } from "@/types";

// Distinct, on-palette hues per bucket (indigo-anchored, finance-readable).
const BUCKET_COLORS: Record<PortfolioBucketId, string> = {
  safe_cash: "#4cc38a",       // green — liquid/safe
  long_term_holds: "#828fff", // indigo — core holds
  active_trades: "#5e6ad2",   // deep indigo — active
  defi_earn: "#02b8cc",       // teal — yield
  locked_funds: "#e0a84b",    // amber — locked
  forgotten_dust: "#6f6e77",  // muted — dust
};

interface AllocationDonutProps {
  portfolio: Portfolio;
}

/**
 * Allocation donut: portfolio value split across the same buckets used elsewhere,
 * with a compact legend. Replaces the flat row of equal bucket cards on Overview.
 */
export function AllocationDonut({ portfolio }: AllocationDonutProps) {
  const buckets = useMemo(() => buildPortfolioBuckets(portfolio), [portfolio]);
  const data = buckets
    .filter((b) => b.totalUsdValue > 0)
    .map((b) => ({
      id: b.bucketId,
      name: b.label,
      value: b.totalUsdValue,
      percentage: b.percentage,
      color: BUCKET_COLORS[b.bucketId],
    }));

  const total = portfolio.summary.totalUsdValue;

  if (data.length === 0) {
    return (
      <div className="rounded-[12px] border border-border bg-surface p-5 shadow-card">
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-lo">Allocation</p>
        <p className="mt-4 text-sm text-text-lo">No allocatable balances yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-lo">Allocation</p>
        <p className="text-[11px] text-text-lo">Risk · Liquidity · Deployment</p>
      </div>

      <div className="mt-3 flex flex-col items-center gap-5 sm:flex-row">
        {/* Donut */}
        <div className="relative h-[148px] w-[148px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={72}
                paddingAngle={2}
                stroke="none"
                isAnimationActive={false}
              >
                {data.map((d) => (
                  <Cell key={d.id} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as (typeof data)[number];
                  return (
                    <div className="rounded-[8px] border border-border bg-surface-overlay px-3 py-2 shadow-popover">
                      <p className="text-[11px] text-text-mid">{p.name}</p>
                      <p className="num text-sm font-semibold text-text-hi">{formatUSD(p.value)}</p>
                      <p className="num text-[11px] text-text-lo">{p.percentage.toFixed(1)}%</p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] uppercase tracking-wide text-text-lo">Total</span>
            <span className="num text-sm font-semibold text-text-hi">{formatUSD(total, { compact: true })}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="grid w-full grid-cols-1 gap-1.5 sm:grid-cols-2">
          {data.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: d.color }} />
                <span className="truncate text-xs text-text-mid">{d.name}</span>
              </div>
              <span className="num shrink-0 text-xs font-medium text-text-hi">{d.percentage.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
