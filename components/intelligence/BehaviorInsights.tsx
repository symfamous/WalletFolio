"use client";

import { Activity, Repeat, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useBehaviorInsights } from "@/hooks/useBehaviorInsights";
import type { WalletResult } from "@/hooks/useMultiPortfolio";
import type { WalletEntry } from "@/hooks/useMultiWallet";
import type { PerpsApiResponse, Portfolio, PortfolioGoal } from "@/types";

function severityVariant(severity: "Low" | "Medium" | "High"): "success" | "warning" | "danger" {
  if (severity === "High") return "danger";
  if (severity === "Medium") return "warning";
  return "success";
}

function scopeLabel(scope: "one_wallet" | "multiple_wallets" | "all_tracked_wallets") {
  if (scope === "all_tracked_wallets") return "Across all wallets";
  if (scope === "multiple_wallets") return "Across some wallets";
  return "Mostly one wallet";
}

interface BehaviorInsightsProps {
  trackedWallets: WalletEntry[];
  walletResults?: WalletResult[];
  activeAddress: string;
  portfolio?: Portfolio;
  perps?: PerpsApiResponse | null;
  selectedGoal: PortfolioGoal;
  compact?: boolean;
}

export function BehaviorInsights({
  trackedWallets,
  walletResults,
  activeAddress,
  portfolio,
  perps,
  selectedGoal,
  compact = false,
}: BehaviorInsightsProps) {
  const { summary, isLoading } = useBehaviorInsights({
    trackedWallets,
    walletResults,
    activeAddress,
    activePortfolio: portfolio,
    activePerps: perps,
    selectedGoal,
  });

  if (!portfolio) return null;

  const insights = summary.insights.slice(0, compact ? 3 : 5);
  const sectionTone = summary.scope === "multi_wallet" ? "Cross-wallet view" : "Single-wallet view";

  return (
    <Card accent={compact}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent/20 bg-accent/10">
          <Repeat className="h-4 w-4 text-accent" strokeWidth={1.7} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-text-hi">Behavior Insights</p>
            <Badge variant="accent">{sectionTone}</Badge>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-text-lo">
            {summary.helperSummary ?? "Patterns detected from your tracked wallets over time."}
          </p>
          {summary.coverageNote ? (
            <p className="mt-1 text-[11px] text-text-lo">{summary.coverageNote}</p>
          ) : null}
        </div>
      </div>

      {isLoading && insights.length === 0 ? (
        <div className="mt-4 rounded-xl border border-border bg-surface-raised/20 px-4 py-3 text-sm text-text-mid">
          Building behavior insights from your recent wallet history…
        </div>
      ) : null}

      {!isLoading && insights.length === 0 ? (
        <div className="mt-4 rounded-xl border border-border bg-surface-raised/20 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-text-lo" />
            <p className="text-sm text-text-mid">We do not have enough repeated history yet to call out a clear behavior pattern.</p>
          </div>
        </div>
      ) : null}

      {insights.length > 0 ? (
        <div className="mt-4 space-y-3">
          {insights.map((insight) => (
            <div key={insight.id} className="rounded-xl border border-border bg-surface-raised/20 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-text-hi">{insight.title}</p>
                    <Badge variant={severityVariant(insight.severity)}>{insight.severity}</Badge>
                    <Badge variant="default">{scopeLabel(insight.appliesTo)}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-text-lo">{insight.frequency}</p>
                  <p className="mt-2 text-sm leading-relaxed text-text-mid">{insight.summary}</p>
                </div>
                <div className="hidden sm:flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-surface">
                  <Activity className="h-4 w-4 text-text-lo" />
                </div>
              </div>

              {insight.recommendation ? (
                <p className="mt-3 text-xs text-text-lo leading-relaxed">
                  What to watch: {insight.recommendation}
                </p>
              ) : null}

              {insight.confidence !== "High" ? (
                <p className="mt-1 text-[11px] text-text-lo">Confidence: {insight.confidence}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
