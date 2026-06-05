"use client";

import { useMemo } from "react";
import { Flame, Loader2 } from "lucide-react";
import { useHistory } from "@/hooks/useHistory";
import { buildGasSummary } from "@/lib/aggregate/gas";
import { cn, formatUSD } from "@/lib/utils";
import { Card } from "@/components/ui/Card";

/**
 * Gas / network-fee analytics from loaded history. Shared by desktop and PWA.
 * Shows total spent, 30-day spend, avg/largest, and a per-chain breakdown.
 */
export function GasAnalytics({ address }: { address: string }) {
  const history = useHistory(address);
  const gas = useMemo(() => buildGasSummary(history.events), [history.events]);

  const kpis = [
    { label: "Total gas", value: formatUSD(gas.totalFeeUsd) },
    { label: "Last 30 days", value: formatUSD(gas.last30dFeeUsd) },
    { label: "Avg / tx", value: formatUSD(gas.avgFeeUsd) },
    { label: "Largest", value: formatUSD(gas.maxFeeUsd) },
  ];
  const maxChainFee = gas.byChain[0]?.feeUsd ?? 0;

  return (
    <Card noPadding className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-warning" strokeWidth={1.6} />
          <div>
            <h2 className="text-sm font-semibold text-text-hi">Gas spent</h2>
            <p className="text-[11px] text-text-lo">Network fees across loaded activity</p>
          </div>
        </div>
        {history.isLoading ? <Loader2 className="h-4 w-4 animate-spin text-text-lo" /> : (
          <span className="num text-[11px] text-text-lo">{gas.feeTxCount} txns</span>
        )}
      </div>

      {gas.empty ? (
        <p className="px-4 py-6 text-center text-xs text-text-lo">
          {history.isLoading ? "Loading fee data…" : "No gas fees found in loaded history yet."}
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 px-4 lg:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-xl border border-border bg-surface-raised/30 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wide text-text-lo">{k.label}</p>
                <p className="num mt-1 text-sm font-semibold text-text-hi truncate">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-1.5 border-t border-border px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-text-lo">By network</p>
            {gas.byChain.slice(0, 8).map((c) => (
              <div key={c.chainSlug} className="flex items-center gap-3 py-1">
                <span className="w-24 shrink-0 truncate text-xs text-text-mid">
                  {c.chainEmoji} {c.chainName}
                </span>
                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${maxChainFee > 0 ? Math.max((c.feeUsd / maxChainFee) * 100, 4) : 0}%`,
                      background: c.chainColor,
                    }}
                  />
                </div>
                <span className="num w-9 shrink-0 text-right text-[10px] text-text-lo">{c.txCount}</span>
                <span className={cn("num w-16 shrink-0 text-right text-xs font-medium text-text-hi")}>
                  {formatUSD(c.feeUsd, { compact: true })}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
