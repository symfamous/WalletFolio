"use client";

import { TrendingUp, TrendingDown, Zap, Gift, Activity, ArrowLeftRight, Fuel, Info } from "lucide-react";
import { cn, formatUSD } from "@/lib/utils";
import type { ChangeAttribution } from "@/lib/snapshots";
import type { LucideIcon } from "lucide-react";

interface ChangeAttributionPanelProps {
  attribution: ChangeAttribution | null;
  hasHistory: boolean;
}

interface AttributionItem {
  label: string;
  value: number;
  icon: LucideIcon;
  hint: string;
  estimated?: boolean;
}

function AttrCard({ item }: { item: AttributionItem }) {
  const pos   = item.value >= 0;
  const Icon  = item.icon;
  const nonZero = Math.abs(item.value) > 0.01;

  return (
    <div className="rounded-xl border border-border bg-surface-raised p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3.5 w-3.5 text-text-lo" />
        <p className="text-[11px] text-text-lo font-medium">{item.label}</p>
        {item.estimated && (
          <span className="text-[9px] text-text-lo ml-auto">~est</span>
        )}
      </div>
      <p className={cn(
        "num text-sm font-semibold",
        !nonZero ? "text-text-lo" :
        pos ? "text-success" : "text-danger"
      )}>
        {!nonZero ? "—" : (pos ? "+" : "") + formatUSD(item.value)}
      </p>
      <p className="text-[10px] text-text-lo mt-0.5">{item.hint}</p>
    </div>
  );
}

export function ChangeAttributionPanel({ attribution, hasHistory }: ChangeAttributionPanelProps) {
  if (!hasHistory || !attribution) {
    return (
      <div className="rounded-xl border border-border bg-surface-raised p-4">
        <div className="flex items-center gap-2 mb-2">
          <ArrowLeftRight className="h-3.5 w-3.5 text-text-lo" />
          <p className="text-xs font-medium text-text-mid">Change Attribution</p>
          <span className="text-[10px] text-text-lo ml-auto">needs 2+ snapshots</span>
        </div>
        <p className="text-xs text-text-lo">
          Track your portfolio over time to see why your value changed.
          Attribution builds automatically after a few refreshes.
        </p>
      </div>
    );
  }

  const isUp = attribution.totalChangeDollars >= 0;
  const items: AttributionItem[] = [
    {
      label: "Price movement",
      value: attribution.priceMovement,
      icon: TrendingUp,
      hint: "Market price changes",
      estimated: true,
    },
    {
      label: "DeFi yield",
      value: attribution.defiYield,
      icon: Zap,
      hint: "Interest & APY",
      estimated: true,
    },
    {
      label: "Rewards",
      value: attribution.rewards,
      icon: Gift,
      hint: "Claimable protocol rewards",
    },
    {
      label: "Perp PnL",
      value: attribution.perpChange,
      icon: Activity,
      hint: "Unrealized perp position change",
    },
    {
      label: "Net transfers",
      value: attribution.netTransfers,
      icon: ArrowLeftRight,
      hint: "Deposits minus withdrawals",
      estimated: true,
    },
  ].filter((i) => Math.abs(i.value) > 0.5);

  return (
    <div className="space-y-3">
      {/* Total */}
      <div className={cn(
        "rounded-xl border p-4 flex items-center justify-between",
        isUp ? "border-success/20 bg-success/5" : "border-danger/20 bg-danger/5"
      )}>
        <div>
          <p className="text-xs text-text-lo mb-1">
            Portfolio change ({attribution.period})
          </p>
          <div className="flex items-center gap-2">
            <p className={cn("num text-xl font-semibold", isUp ? "text-success" : "text-danger")}>
              {isUp ? "+" : ""}{formatUSD(attribution.totalChangeDollars)}
            </p>
            <span className={cn(
              "num text-xs px-2 py-0.5 rounded-full",
              isUp ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
            )}>
              {isUp ? "+" : ""}{attribution.totalChangePct.toFixed(2)}%
            </span>
          </div>
        </div>
        {isUp
          ? <TrendingUp className="h-6 w-6 text-success" />
          : <TrendingDown className="h-6 w-6 text-danger" />}
      </div>

      {/* Attribution cards */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {items.map((item) => (
            <AttrCard key={item.label} item={item} />
          ))}
        </div>
      )}

      {attribution.isEstimated && (
        <div className="flex items-center gap-1.5 px-1">
          <Info className="h-3 w-3 text-text-lo flex-shrink-0" />
          <p className="text-[10px] text-text-lo">
            Attribution is estimated — price movement and transfers may overlap
          </p>
        </div>
      )}
    </div>
  );
}