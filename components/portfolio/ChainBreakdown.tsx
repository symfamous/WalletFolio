"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatUSD } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import type { ChainAllocation } from "@/types";

interface Props { allocations: ChainAllocation[]; totalValue: number }

function Tip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-overlay px-3 py-2 shadow-xl">
      <p className="text-xs text-text-mid mb-0.5">{payload[0].name}</p>
      <p className="num text-sm font-medium text-text-hi">{formatUSD(payload[0].value)}</p>
    </div>
  );
}

export function ChainBreakdown({ allocations, totalValue }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const withValue = allocations.filter((a) => a.totalUsdValue > 0);
  if (withValue.length === 0) return null;

  const pieData = withValue.slice(0, 9).map((a) => ({
    name: a.chainName, value: a.totalUsdValue, color: a.chainColor,
  }));

  return (
    <Card noPadding className="overflow-hidden animate-fade-up">
      {/* Header — click to collapse */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-5 py-4 border-b border-border hover:bg-surface-raised/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-text-hi">Chain Allocation</h3>
          <span className="num text-xs text-text-lo">{withValue.length} chains</span>
        </div>
        {collapsed
          ? <ChevronDown className="h-3.5 w-3.5 text-text-lo" />
          : <ChevronUp className="h-3.5 w-3.5 text-text-lo" />}
      </button>

      {!collapsed && (
        <div className="p-5 space-y-5">
          {withValue.length > 1 && (
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={44} outerRadius={64}
                    paddingAngle={2.5} dataKey="value" stroke="none"
                    animationBegin={0} animationDuration={600}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} opacity={0.80} />)}
                  </Pie>
                  <Tooltip content={<Tip />} cursor={false} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="space-y-3">
            {withValue.map((a) => {
              const pct = totalValue > 0 ? (a.totalUsdValue / totalValue) * 100 : 0;
              return (
                <div key={a.chainSlug}>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div
                      className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-lg border text-sm"
                      style={{ backgroundColor: `${a.chainColor}12`, borderColor: `${a.chainColor}30` }}
                    >
                      {a.chainEmoji}
                    </div>
                    <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-hi truncate">{a.chainName}</p>
                        <p className="text-[11px] text-text-lo">{a.tokenCount} token{a.tokenCount !== 1 ? "s" : ""}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="num text-sm font-medium text-text-hi">{formatUSD(a.totalUsdValue, { compact: true })}</p>
                        <p className="num text-[11px] text-text-lo">{pct.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                  <div className="ml-[2.625rem] h-1 overflow-hidden rounded-full bg-surface-overlay">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.max(pct, 0.3)}%`, backgroundColor: a.chainColor, opacity: 0.65 }}
                    />
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