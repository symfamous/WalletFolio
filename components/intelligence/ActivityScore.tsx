"use client";

import { useMemo } from "react";
import { Gift, Loader2, Sparkles } from "lucide-react";
import { useHistory } from "@/hooks/useHistory";
import { buildActivityScore } from "@/lib/intelligence/activityScore";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import type { PerpsApiResponse, Portfolio } from "@/types";

const TIER_TONE: Record<string, string> = {
  "Whale-grade": "text-success border-success/25 bg-success/8",
  "Power user": "text-success border-success/25 bg-success/8",
  Active: "text-accent border-accent/25 bg-accent/8",
  Casual: "text-warning border-warning/25 bg-warning/8",
  Dormant: "text-text-lo border-border bg-surface-raised/50",
};

/**
 * Airdrop / onchain-activity score — a heuristic readiness indicator built from
 * the wallet's holdings + loaded history. Shared by desktop and PWA.
 */
export function ActivityScore({
  address,
  portfolio,
  perps,
}: {
  address: string;
  portfolio: Portfolio;
  perps?: PerpsApiResponse | null;
}) {
  const history = useHistory(address);
  const result = useMemo(
    () => buildActivityScore(portfolio, history.events, perps),
    [portfolio, history.events, perps]
  );

  return (
    <Card noPadding className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-accent" strokeWidth={1.6} />
          <div>
            <h2 className="text-sm font-semibold text-text-hi">Airdrop readiness</h2>
            <p className="text-[11px] text-text-lo">Onchain activity breadth (indicator, not a guarantee)</p>
          </div>
        </div>
        {history.isLoading ? <Loader2 className="h-4 w-4 animate-spin text-text-lo" /> : null}
      </div>

      {/* Score headline */}
      <div className="mt-3 flex items-center gap-4 px-4">
        <div className="flex items-baseline gap-1">
          <span className="num text-3xl font-bold text-text-hi">{result.score}</span>
          <span className="text-sm text-text-lo">/100</span>
        </div>
        <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", TIER_TONE[result.tier] ?? TIER_TONE.Dormant)}>
          {result.tier}
        </span>
        <div className="relative ml-auto hidden h-2 w-40 overflow-hidden rounded-full bg-surface-raised sm:block">
          <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${result.score}%` }} />
        </div>
      </div>

      {/* Factors */}
      <div className="mt-3 grid gap-2 px-4 sm:grid-cols-2">
        {result.factors.map((f) => (
          <div key={f.label} className="rounded-xl border border-border bg-surface-raised/30 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-text-mid">{f.label}</span>
              <span className="num text-[10px] text-text-lo">{f.points}/{f.max}</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-raised">
              <div className="h-full rounded-full bg-accent/70" style={{ width: `${f.max > 0 ? (f.points / f.max) * 100 : 0}%` }} />
            </div>
            <p className="mt-1 truncate text-[10px] text-text-lo">{f.detail}</p>
          </div>
        ))}
      </div>

      {/* Signals */}
      <div className="mt-3 border-t border-border px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-accent" />
          <p className="text-[10px] uppercase tracking-wide text-text-lo">Signals</p>
        </div>
        <ul className="mt-1.5 space-y-1">
          {result.signals.map((s, i) => (
            <li key={i} className="flex gap-1.5 text-[11px] leading-relaxed text-text-mid">
              <span className="text-accent">·</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
