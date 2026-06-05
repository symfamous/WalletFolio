"use client";

import { Rocket, Loader2 } from "lucide-react";
import { useTrends } from "@/hooks/useTrends";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  if (price > 0) return `$${price.toFixed(Math.min(12, Math.ceil(-Math.log10(price)) + 3)).replace(/0+$/, "")}`;
  return "$0";
}

function pct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

/**
 * Early trend finder — coins heating up by short-term momentum (volume turnover
 * + accelerating price), from the cached /api/trends scanner. Shared desktop/PWA.
 */
export function EarlyTrends() {
  const { data, isLoading } = useTrends();
  const trends = data?.trends ?? [];

  return (
    <Card noPadding className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-accent" strokeWidth={1.6} />
          <div>
            <h2 className="text-sm font-semibold text-text-hi">Early trends</h2>
            <p className="text-[11px] text-text-lo">Heating up by volume + momentum</p>
          </div>
        </div>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-text-lo" /> : (
          <span className="text-[10px] text-text-lo">CoinGecko · 5m</span>
        )}
      </div>

      {trends.length === 0 ? (
        <p className="px-4 pb-5 text-center text-xs text-text-lo">
          {isLoading ? "Scanning the market…" : "No strong momentum right now."}
        </p>
      ) : (
        <div className="divide-y divide-border border-t border-border">
          {trends.map((t, i) => {
            const up24 = t.change24h >= 0;
            const up1h = t.change1h >= 0;
            return (
              <div key={t.id} className="flex items-center gap-2.5 px-4 py-2">
                <span className="num w-4 shrink-0 text-[11px] text-text-lo">{i + 1}</span>
                {t.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.image} alt={t.symbol} className="h-5 w-5 rounded-full" />
                ) : (
                  <span className="h-5 w-5 rounded-full bg-surface-raised" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <span className="font-medium text-text-hi">{t.symbol}</span>
                    {t.rank ? <span className="ml-1.5 text-[10px] text-text-lo">#{t.rank}</span> : null}
                  </p>
                  <p className="num text-[10px] text-text-lo">{formatPrice(t.price)} · {t.volMcap.toFixed(1)}× vol/mcap</p>
                </div>
                <div className="flex flex-col items-end leading-tight">
                  <span className={cn("num text-xs font-medium", up24 ? "text-success" : "text-danger")}>{pct(t.change24h)}</span>
                  <span className={cn("num text-[10px]", up1h ? "text-success/80" : "text-danger/80")}>1h {pct(t.change1h)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
