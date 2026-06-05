"use client";

import { useMemo } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { cn, formatUSD } from "@/lib/utils";
import { TokenLogo } from "@/components/portfolio/TokenLogo";
import type { Portfolio } from "@/types";

const DEPEG_WARN = 0.5; // % off $1 to warn
const DEPEG_DANGER = 2; // % off $1 = serious depeg

/**
 * Stablecoin depeg monitor — flags held stablecoins whose price has drifted off
 * $1. Uses prices already in the portfolio (no extra API).
 */
export function StablecoinHealth({ portfolio }: { portfolio: Portfolio }) {
  const stables = useMemo(
    () =>
      portfolio.aggregated
        .filter((h) => h.isStablecoin && h.priceAvailable && h.price !== undefined && h.totalUsdValue >= 5)
        .map((h) => {
          const price = h.price ?? 1;
          const deviation = (price - 1) * 100; // % from peg
          const abs = Math.abs(deviation);
          const status: "ok" | "warn" | "danger" = abs >= DEPEG_DANGER ? "danger" : abs >= DEPEG_WARN ? "warn" : "ok";
          return { key: h.aggregateKey, symbol: h.symbol, logo: h.logo, price, deviation, status, usd: h.totalUsdValue };
        })
        .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation)),
    [portfolio.aggregated]
  );

  if (stables.length === 0) return null;
  const worst = stables[0].status;
  const offPeg = stables.filter((s) => s.status !== "ok");

  return (
    <div className="rounded-[12px] border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-lo">Stablecoin Health</p>
        {worst === "ok" ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-success">
            <ShieldCheck className="h-3.5 w-3.5" /> all near peg
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-warning">
            <AlertTriangle className="h-3.5 w-3.5" /> {offPeg.length} off peg
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1.5">
        {stables.slice(0, 6).map((s) => (
          <div key={s.key} className="flex items-center gap-2.5">
            <TokenLogo logo={s.logo} symbol={s.symbol} size="xs" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-hi">{s.symbol}</span>
            <span className="num text-xs text-text-lo">{formatUSD(s.usd, { compact: true })}</span>
            <span
              className={cn(
                "num w-20 text-right text-xs font-medium",
                s.status === "danger" ? "text-danger" : s.status === "warn" ? "text-warning" : "text-success"
              )}
            >
              ${s.price.toFixed(4)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
