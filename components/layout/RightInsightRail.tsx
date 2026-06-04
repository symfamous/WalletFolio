"use client";

import {
  AlertTriangle,
  ArrowRight,
  Gauge,
  ShieldAlert,
  Target,
  Wallet,
} from "lucide-react";
import { cn, formatUSD, shortenAddress } from "@/lib/utils";
import type {
  Portfolio,
  PortfolioGoal,
  PortfolioGoalFitSummary,
  PortfolioIntelligence,
  PortfolioStressSummary,
  WalletCheckupSummary,
} from "@/types";

interface RightInsightRailProps {
  address: string;
  portfolio: Portfolio;
  intelligence?: PortfolioIntelligence | null;
  selectedGoal: PortfolioGoal;
  goalFitSummary?: PortfolioGoalFitSummary | null;
  stressSummary?: PortfolioStressSummary | null;
  walletCheckupSummary?: WalletCheckupSummary | null;
  alertsUnreadCount: number;
  alertsActiveCount: number;
  trackedWalletCount: number;
  onOpenStressView: () => void;
  onNavigate?: (id: string) => void;
}

function RailCard({
  title,
  eyebrow,
  children,
  className,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[24px] border border-border bg-text-hi/[0.03] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.18)]", className)}>
      {eyebrow ? <p className="text-[10px] uppercase tracking-[0.12em] text-text-lo">{eyebrow}</p> : null}
      <p className="mt-1 text-sm font-semibold text-text-hi">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function RightInsightRail({
  address,
  portfolio,
  intelligence,
  selectedGoal,
  goalFitSummary,
  stressSummary,
  walletCheckupSummary,
  alertsUnreadCount,
  alertsActiveCount,
  trackedWalletCount,
  onOpenStressView,
  onNavigate,
}: RightInsightRailProps) {
  const riskTone = intelligence?.risk.overallState ?? "Safe";
  const riskToneClass =
    riskTone === "Critical"
      ? "border-danger/20 bg-danger/10 text-danger"
      : riskTone === "Watch" || riskTone === "Risky"
      ? "border-warning/20 bg-warning/10 text-warning"
      : "border-success/20 bg-success/10 text-success";

  return (
    <div>
      <RailCard title="Wallet Snapshot" eyebrow="Quick View" className="bg-[linear-gradient(180deg,rgba(12,18,19,0.96),rgba(9,13,14,0.96))]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-text-mid">{shortenAddress(address)}</p>
            <p className="mt-2 num text-2xl font-semibold text-text-hi">{formatUSD(portfolio.summary.totalUsdValue)}</p>
            <p className="mt-2 text-xs text-text-mid">
              {trackedWalletCount} wallet{trackedWalletCount !== 1 ? "s" : ""} tracked · {portfolio.summary.activeChainCount} chains
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-text-hi/[0.05]">
            <Wallet className="h-4.5 w-4.5 text-accent" />
          </div>
        </div>

        <div className={cn("mt-4 rounded-2xl border px-3.5 py-3", riskToneClass)}>
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">{riskTone}</p>
              <p className="mt-1 text-xs leading-relaxed text-text-mid">
                {intelligence?.risk.topReason ?? "Risk truth updates as holdings, DeFi, and perps change."}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onNavigate?.("intelligence")}
            className="rounded-xl bg-text-hi/[0.04] px-3 py-2 text-left transition-colors hover:bg-text-hi/[0.06]"
          >
            <p className="text-[11px] text-text-lo">Workspace</p>
            <p className="mt-1 text-sm text-text-hi">Open intelligence</p>
          </button>
          <button
            type="button"
            onClick={onOpenStressView}
            className="rounded-xl bg-text-hi/[0.04] px-3 py-2 text-left transition-colors hover:bg-text-hi/[0.06]"
          >
            <p className="text-[11px] text-text-lo">Stress</p>
            <p className="mt-1 text-sm text-text-hi">View liquidity</p>
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.("wallet-history")}
            className="rounded-xl bg-text-hi/[0.04] px-3 py-2 text-left transition-colors hover:bg-text-hi/[0.06]"
          >
            <p className="text-[11px] text-text-lo">Alerts</p>
            <p className="mt-1 text-sm text-text-hi">{alertsUnreadCount > 0 ? `${alertsUnreadCount} new` : "Quiet"}</p>
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.("scenarios")}
            className="rounded-xl bg-text-hi/[0.04] px-3 py-2 text-left transition-colors hover:bg-text-hi/[0.06]"
          >
            <p className="text-[11px] text-text-lo">Goal</p>
            <p className="mt-1 text-sm text-text-hi">{goalFitSummary?.overallFitState ?? selectedGoal}</p>
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-text-hi/[0.03] px-3.5 py-3">
          <div>
            <p className="text-[11px] text-text-lo">Monitoring mode</p>
            <p className="mt-1 text-sm text-text-hi">{alertsActiveCount > 0 ? `${alertsActiveCount} watch item${alertsActiveCount > 1 ? "s" : ""}` : "No active watch items"}</p>
          </div>
          <Gauge className="h-4.5 w-4.5 text-accent" />
        </div>
      </RailCard>
    </div>
  );
}
