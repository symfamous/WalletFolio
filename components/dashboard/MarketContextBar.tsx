"use client";

import { Flame, Fuel, Gauge, Globe } from "lucide-react";
import { useMarket } from "@/hooks/useMarket";
import { cn } from "@/lib/utils";

function fngColor(v: number): string {
  if (v <= 25) return "text-danger";
  if (v <= 45) return "text-warning";
  if (v <= 55) return "text-text-mid";
  if (v <= 75) return "text-success";
  return "text-success";
}

function compactUsd(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  return `$${(n / 1e6).toFixed(0)}M`;
}

function Item({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="text-text-lo">{icon}</span>
      <span className="text-[11px] uppercase tracking-wide text-text-lo">{label}</span>
      <span className="num text-xs font-medium text-text-hi">{children}</span>
    </div>
  );
}

/**
 * Ambient market-context strip — Fear & Greed, BTC dominance, global market cap,
 * and ETH gas. All free, no-key data; renders nothing until something loads.
 */
export function MarketContextBar() {
  const { data } = useMarket();
  if (!data) return null;

  const hasAny =
    data.fearGreed || data.btcDominance != null || data.totalMarketCapUsd != null || data.ethGasGwei != null;
  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[12px] border border-border bg-surface px-5 py-3 shadow-card">
      {data.fearGreed ? (
        <Item icon={<Gauge className="h-3.5 w-3.5" />} label="Fear & Greed">
          <span className={cn(fngColor(data.fearGreed.value))}>
            {data.fearGreed.value} · {data.fearGreed.label}
          </span>
        </Item>
      ) : null}
      {data.btcDominance != null ? (
        <Item icon={<Flame className="h-3.5 w-3.5" />} label="BTC.D">
          {data.btcDominance.toFixed(1)}%
        </Item>
      ) : null}
      {data.totalMarketCapUsd != null ? (
        <Item icon={<Globe className="h-3.5 w-3.5" />} label="Mcap">
          <span className="flex items-center gap-1.5">
            {compactUsd(data.totalMarketCapUsd)}
            {data.marketCapChange24h != null ? (
              <span className={data.marketCapChange24h >= 0 ? "text-success" : "text-danger"}>
                {data.marketCapChange24h >= 0 ? "+" : ""}
                {data.marketCapChange24h.toFixed(2)}%
              </span>
            ) : null}
          </span>
        </Item>
      ) : null}
      {data.ethGasGwei != null ? (
        <Item icon={<Fuel className="h-3.5 w-3.5" />} label="ETH Gas">
          {data.ethGasGwei} gwei
        </Item>
      ) : null}
    </div>
  );
}
