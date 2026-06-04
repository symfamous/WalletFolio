"use client";

import { useMemo } from "react";
import { ArrowUpRight, Sprout } from "lucide-react";
import { useYields, type YieldPool } from "@/hooks/useYields";
import { formatUSD } from "@/lib/utils";
import { TokenLogo } from "@/components/portfolio/TokenLogo";
import type { Portfolio } from "@/types";

interface Row {
  symbol: string;
  logo?: string;
  heldUsd: number;
  best: YieldPool;
}

/**
 * "Earn more" — matches the wallet's significant holdings to the best low-risk,
 * single-asset DeFi pools (DefiLlama, free). Shows potential annual yield.
 */
export function YieldOpportunities({ portfolio, address }: { portfolio: Portfolio; address: string }) {
  // Significant, priced holdings worth chasing yield on.
  const held = useMemo(
    () =>
      portfolio.aggregated
        .filter((h) => h.priceAvailable && h.totalUsdValue >= 50)
        .sort((a, b) => b.totalUsdValue - a.totalUsdValue)
        .slice(0, 8),
    [portfolio.aggregated]
  );
  const symbols = useMemo(() => [...new Set(held.map((h) => h.symbol.toUpperCase()))], [held]);
  const { data, isLoading } = useYields(address, symbols);

  const rows: Row[] = useMemo(() => {
    if (!data) return [];
    const out: Row[] = [];
    for (const h of held) {
      const pools = data.bySymbol[h.symbol.toUpperCase()];
      if (pools && pools.length > 0) {
        out.push({ symbol: h.symbol, logo: h.logo, heldUsd: h.totalUsdValue, best: pools[0] });
      }
    }
    return out.sort((a, b) => b.best.apy - a.best.apy);
  }, [data, held]);

  return (
    <section className="rounded-[12px] border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sprout className="h-4 w-4 text-success" />
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-lo">Earn on your holdings</p>
        </div>
        <p className="text-[11px] text-text-lo">Best low-risk pools · DefiLlama</p>
      </div>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-text-lo">Scanning yield pools…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-lo">No matching low-risk pools for your holdings right now.</p>
      ) : (
        <div className="mt-3 divide-y divide-border">
          {rows.map((r) => {
            const annual = r.heldUsd * (r.best.apy / 100);
            return (
              <a
                key={r.symbol}
                href={r.best.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 py-2.5 transition-colors hover:bg-surface-raised"
              >
                <TokenLogo logo={r.logo} symbol={r.symbol} size="xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-hi">{r.symbol}</p>
                  <p className="num text-[11px] text-text-lo">{formatUSD(r.heldUsd, { compact: true })} held</p>
                </div>
                <div className="hidden min-w-0 sm:block">
                  <p className="truncate text-xs capitalize text-text-mid">{r.best.project}</p>
                  <p className="text-[11px] capitalize text-text-lo">{r.best.chain} · {r.best.ilRisk === "no" ? "no IL" : "IL risk"}</p>
                </div>
                <div className="text-right">
                  <p className="num text-sm font-semibold text-success">{r.best.apy.toFixed(2)}% APY</p>
                  <p className="num text-[11px] text-text-lo">~{formatUSD(annual, { compact: true })}/yr</p>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-text-lo transition-colors group-hover:text-accent" />
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}
