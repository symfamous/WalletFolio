"use client";

import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatUSD, formatBalance } from "@/lib/utils";
import { TokenLogo } from "@/components/TokenLogo";
import { Card } from "@/components/ui/Card";
import type { AggregatedHolding } from "@/types";

interface Props { aggregated: AggregatedHolding[]; totalValue: number }

function Tip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-overlay px-3 py-2 shadow-xl">
      <p className="text-xs text-text-mid mb-0.5">{label}</p>
      <p className="num text-sm font-medium text-text-hi">{formatUSD(payload[0].value)}</p>
    </div>
  );
}

const COLORS = ["#3B82F6","#8B5CF6","#10B981","#ffb4ab","#EF4444","#06B6D4","#00f3ff","#84CC16"];

export function TopHoldings({ aggregated, totalValue }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const top = useMemo(
    () => aggregated.filter((h) => h.totalUsdValue > 0).slice(0, 8),
    [aggregated]
  );

  if (top.length === 0) return null;

  const chartData = top.map((h) => ({ symbol: h.symbol, value: h.totalUsdValue }));

  return (
    <Card noPadding className="overflow-hidden animate-fade-up">
      {/* Header — click to collapse */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-5 py-4 border-b border-border hover:bg-surface-raised/30 transition-colors text-left"
      >
        <h3 className="text-sm font-medium text-text-hi">Top Holdings</h3>
        {collapsed
          ? <ChevronDown className="h-3.5 w-3.5 text-text-lo" />
          : <ChevronUp className="h-3.5 w-3.5 text-text-lo" />}
      </button>

      {!collapsed && (
        <div className="p-5 space-y-5">
          {top.length > 1 && (
            <div className="h-[100px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -24 }} barCategoryGap="22%">
                  <XAxis dataKey="symbol" tick={{ fill: "#40465A", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#40465A", fontSize: 9 }} axisLine={false} tickLine={false}
                    tickFormatter={(v: number) => formatUSD(v, { compact: true })} />
                  <Tooltip content={<Tip />} cursor={{ fill: "rgb(var(--text-hi)/0.03)" }} />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.75} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="space-y-2.5">
            {top.map((h, i) => {
              const pct = totalValue > 0 ? (h.totalUsdValue / totalValue) * 100 : 0;
              const color = COLORS[i % COLORS.length];
              return (
                <div key={h.aggregateKey} className="flex items-center gap-3">
                  <TokenLogo logo={h.logo} symbol={h.symbol} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-text-hi">{h.symbol}</span>
                      <div className="text-right">
                        <span className="num text-sm text-text-hi">{formatUSD(h.totalUsdValue)}</span>
                        {h.defiBalance > 0 && (
                          <span className="text-[10px] text-accent ml-1">incl. DeFi</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 overflow-hidden rounded-full bg-surface-overlay">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.max(pct, 0.3)}%`, backgroundColor: color, opacity: 0.65 }}
                        />
                      </div>
                      <span className="num text-[11px] text-text-lo w-10 text-right">{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}