"use client";
import { type LucideIcon } from "lucide-react";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  X,
  ChevronUp,
  Sparkles,
  Target,
  Layers,
  Shield,
  ShieldAlert,
  ArrowRightLeft,
  Bot,
  Coins,
  Activity,
  Building2,
  Lock,
  PiggyBank,
  ArrowDownLeft,
  ChevronRight,
  Repeat,
  ShieldCheck,
} from "lucide-react";
import { cn, formatUSD, formatPct } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import { useBehaviorInsights } from "@/hooks/useBehaviorInsights";
import type { ElementType } from "react";
import type {
  Portfolio,
  PortfolioGoal,
  PortfolioGoalFitSummary,
  PortfolioIntelligence,
  PortfolioStressSummary,
  WalletCheckupSummary,
  PortfolioBucketId,
  UnifiedRiskFactor,
  BehaviorInsight,
} from "@/types";
import type { WalletEntry } from "@/hooks/useMultiWallet";
import type { WalletResult } from "@/hooks/useMultiPortfolio";
import type { PerpsApiResponse } from "@/types";
import { buildPortfolioBuckets } from "@/lib/portfolioBuckets";
import { buildAdaptiveScenarioResults } from "@/lib/scenarioSimulator";
import { getRiskStatePresentation } from "@/lib/riskMonitor";

// Quick access feature type
type QuickAccessFeature = "buckets" | "risk" | "stress" | "whatif" | "behavior";

interface QuickAccessAction {
  id: QuickAccessFeature;
  label: string;
  icon: LucideIcon;
  description: string;
}

const QUICK_ACCESS_ACTIONS: QuickAccessAction[] = [
  { id: "buckets", label: "Money Sits", icon: Layers, description: "Where your money is allocated" },
  { id: "risk", label: "Risk Truth", icon: Shield, description: "Current portfolio risk state" },
  { id: "stress", label: "Stress View", icon: ShieldAlert, description: "Emergency access funds" },
  { id: "whatif", label: "What If", icon: ArrowRightLeft, description: "Test market scenarios" },
  { id: "behavior", label: "Patterns", icon: Repeat, description: "Recurring behavior patterns across wallets" },
];

const BUCKET_ICONS: Record<PortfolioBucketId, LucideIcon> = {
  safe_cash: PiggyBank,
  long_term_holds: Coins,
  active_trades: Activity,
  defi_earn: Building2,
  locked_funds: Lock,
  forgotten_dust: Sparkles,
};

function WalletSummaryBar({
  totalValue,
  change24h,
  walletValue,
  defiValue,
}: {
  totalValue: number;
  change24h: number;
  walletValue: number;
  defiValue: number;
}) {
  const animatedValue = useCountUp(totalValue);
  const changeUp = change24h >= 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-text-lo uppercase tracking-widest">Portfolio</p>
          <p className="num text-lg font-bold text-text-hi">
            ${animatedValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div
          className={cn(
            "flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium num",
            changeUp ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
          )}
        >
          {changeUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {formatPct(change24h)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border bg-bg/50 px-2.5 py-1.5">
          <p className="text-[9px] text-text-lo uppercase tracking-wider">Wallet</p>
          <p className="num text-xs font-semibold text-text-hi">{formatUSD(walletValue, { compact: true })}</p>
        </div>
        <div className="rounded-lg border border-border bg-bg/50 px-2.5 py-1.5">
          <p className="text-[9px] text-text-lo uppercase tracking-wider">DeFi</p>
          <p className="num text-xs font-semibold text-text-hi">{formatUSD(defiValue, { compact: true })}</p>
        </div>
      </div>
    </div>
  );
}

// ===== CHECKUP CONTENT =====
function CheckupContent({ summary }: { summary?: WalletCheckupSummary | null }) {
  if (!summary) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised p-4 text-center">
        <Sparkles className="h-6 w-6 text-text-lo mx-auto mb-2" />
        <p className="text-xs text-text-mid">Analyzing your wallet...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-accent/20 bg-accent/5 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <p className="text-sm font-semibold text-text-hi">Wallet Style: {summary.walletStyle.label}</p>
        </div>
        <p className="text-xs text-text-mid">{summary.walletStyle.explanation}</p>
      </div>

      <div className="rounded-lg border border-border bg-surface-raised p-3">
        <p className="text-[10px] text-text-lo uppercase tracking-widest mb-2">Complexity: {summary.complexity.level}</p>
        <p className="text-xs text-text-mid">{summary.complexity.explanation}</p>
      </div>

      <div className="rounded-lg border border-danger/15 bg-danger/5 p-3">
        <p className="text-[10px] text-danger uppercase tracking-widest mb-1">Biggest Risk</p>
        <p className="text-sm font-semibold text-text-hi">{summary.biggestRisk.label}</p>
        <p className="text-xs text-text-mid mt-1">{summary.biggestRisk.explanation}</p>
      </div>

      <div className="rounded-lg border border-border bg-surface-raised p-3">
        <p className="text-[10px] text-text-lo uppercase tracking-widest mb-2">Dominant Area: {summary.dominantArea.label}</p>
        <p className="text-xs text-text-mid">{summary.dominantArea.explanation}</p>
      </div>

      <div className="rounded-lg border border-border bg-surface-raised p-3">
        <p className="text-[10px] text-text-lo uppercase tracking-widest mb-2">Priority Things To Understand</p>
        <div className="space-y-2">
          {summary.firstThingsToUnderstand.slice(0, 4).map((item, i) => (
            <div key={item.id} className="flex items-start gap-2">
              <span className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0 mt-0.5",
                item.priority === "First" ? "bg-danger/20 text-danger" :
                item.priority === "Next" ? "bg-warning/20 text-warning" :
                "bg-accent/20 text-accent"
              )}>
                {i + 1}
              </span>
              <div>
                <p className="text-xs font-medium text-text-hi">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface-raised p-3">
        <p className="text-[10px] text-text-lo uppercase tracking-widest mb-2">Goal Fit: {summary.goalFit.goal}</p>
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded",
            summary.goalFit.fitState === "Strong Fit" ? "bg-success/10 text-success" :
            summary.goalFit.fitState === "Poor Fit" ? "bg-danger/10 text-danger" :
            "bg-warning/10 text-warning"
          )}>
            {summary.goalFit.fitState}
          </span>
          <p className="text-xs text-text-mid flex-1">{summary.goalFit.explanation}</p>
        </div>
      </div>

      {summary.helperNotes && summary.helperNotes.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-bg/50 p-3">
          <p className="text-[10px] text-text-lo uppercase tracking-widest mb-2">Helper Notes</p>
          <ul className="space-y-1">
            {summary.helperNotes.map((note, i) => (
              <li key={i} className="text-xs text-text-mid">· {note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ===== GOAL CONTENT =====
function GoalContent({
  summary,
  selectedGoal,
  onSelectGoal,
}: {
  summary?: PortfolioGoalFitSummary | null;
  selectedGoal: PortfolioGoal;
  onSelectGoal?: (goal: PortfolioGoal) => void;
}) {
  const goals: PortfolioGoal[] = ["Mostly Safe", "Long-Term Growth", "Active Trader", "Learn Slowly", "Balanced"];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-surface-raised p-3">
        <p className="text-xs text-text-mid mb-2">Select your goal:</p>
        <div className="grid grid-cols-2 gap-1.5">
          {goals.map((goal) => (
            <button
              key={goal}
              type="button"
              onClick={() => onSelectGoal?.(goal)}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs text-left transition-colors",
                selectedGoal === goal
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border bg-bg/60 text-text-mid hover:border-border-strong"
              )}
            >
              {goal}
            </button>
          ))}
        </div>
      </div>

      {summary && (
        <>
          <div className="rounded-lg border border-accent/20 bg-accent/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-accent" />
              <p className="text-sm font-semibold text-text-hi">Goal: {selectedGoal}</p>
            </div>
            <p className="text-xs text-text-mid">{summary.headline}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-success/20 bg-success/5 p-3">
              <p className="text-[10px] text-success uppercase tracking-wider">Aligned</p>
              <p className="text-sm font-semibold text-text-hi mt-1">{summary.topAlignedArea.label}</p>
              <p className="text-xs text-text-mid mt-0.5">{summary.topAlignedArea.explanation}</p>
            </div>
            <div className="rounded-lg border border-warning/20 bg-warning/5 p-3">
              <p className="text-[10px] text-warning uppercase tracking-wider">Needs Work</p>
              <p className="text-sm font-semibold text-text-hi mt-1">{summary.topMismatch.label}</p>
              <p className="text-xs text-text-mid mt-0.5">{summary.topMismatch.explanation}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ===== BUCKETS CONTENT =====
function BucketsContent({ portfolio }: { portfolio: Portfolio }) {
  const buckets = useMemo(() => buildPortfolioBuckets(portfolio), [portfolio]);
  const [selectedBucket, setSelectedBucket] = useState<PortfolioBucketId>("safe_cash");
  const activeBucket = buckets.find(b => b.bucketId === selectedBucket) ?? buckets[0];

  const totalVal = portfolio.summary.totalUsdValue || 1;

  return (
    <div className="space-y-3">
      {/* Bucket selector pills */}
      <div className="flex flex-wrap gap-1">
        {buckets.map((bucket) => {
          const Icon = BUCKET_ICONS[bucket.bucketId];
          const isActive = bucket.bucketId === selectedBucket;
          return (
            <button
              key={bucket.bucketId}
              type="button"
              onClick={() => setSelectedBucket(bucket.bucketId)}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors",
                isActive
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border bg-bg/60 text-text-mid hover:border-border-strong"
              )}
            >
              <Icon className="h-3 w-3" />
              {bucket.label} ({((bucket.totalUsdValue / totalVal) * 100).toFixed(0)}%)
            </button>
          );
        })}
      </div>

      {/* Selected bucket detail */}
      {activeBucket && (
        <div className="rounded-lg border border-border bg-surface-raised p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {(() => {
                const Icon = BUCKET_ICONS[activeBucket.bucketId];
                return <Icon className="h-4 w-4 text-accent" />;
              })()}
              <p className="text-sm font-semibold text-text-hi">{activeBucket.label}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-text-hi num">{formatUSD(activeBucket.totalUsdValue)}</p>
              <p className="text-[10px] text-accent num">{((activeBucket.totalUsdValue / totalVal) * 100).toFixed(1)}%</p>
            </div>
          </div>
          <p className="text-xs text-text-mid mb-3">{activeBucket.description}</p>

          {/* Top items in bucket */}
          {activeBucket.items.length > 0 ? (
            <div className="space-y-1.5 border-t border-border/50 pt-2">
              <p className="text-[10px] text-text-lo uppercase tracking-widest mb-1">Top Assets</p>
              {activeBucket.items.slice(0, 4).map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text-hi">{item.symbol || item.name}</span>
                    <span className="text-[10px] text-text-lo">{item.chainEmoji}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-text-hi num">{formatUSD(item.usdValue)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-lo italic">No assets in this bucket</p>
          )}
        </div>
      )}
    </div>
  );
}

// ===== RISK CONTENT =====
function severityColor(s: UnifiedRiskFactor["state"]): string {
  return {
    Safe: "text-success",
    Watch: "text-warning",
    Risky: "text-warning",
    Critical: "text-danger",
  }[s];
}

function severityBg(s: UnifiedRiskFactor["state"]): string {
  return {
    Safe: "border-success/20 bg-success/5",
    Watch: "border-warning/20 bg-warning/5",
    Risky: "border-warning/20 bg-warning/5",
    Critical: "border-danger/20 bg-danger/5",
  }[s];
}

function factorIcon(id: string): LucideIcon {
  switch (id) {
    case "chain_concentration": return Layers;
    case "protocol_concentration": return Building2;
    case "top_holding": return Coins;
    case "stablecoin_ratio": return Coins;
    case "borrow_exposure": return ArrowDownLeft;
    case "perp_leverage": return Activity;
    default: return ShieldAlert;
  }
}

function RiskContent({ intelligence }: { intelligence?: PortfolioIntelligence | null }) {
  if (!intelligence) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised p-4 text-center">
        <Shield className="h-6 w-6 text-text-lo mx-auto mb-2" />
        <p className="text-xs text-text-mid">Loading risk data...</p>
      </div>
    );
  }

  const { risk } = intelligence;
  const overall = getRiskStatePresentation(risk.overallState);

  const displayedFactors = risk.rankedFactors.length > 0
    ? risk.rankedFactors
    : [...risk.triggeredFactors, ...risk.safeFactors];

  return (
    <div className="space-y-3">
      {/* Overall banner */}
      <div className={cn(
        "rounded-lg border p-3",
        risk.overallState === "Safe" ? "border-success/20 bg-success/5" :
        risk.overallState === "Critical" ? "border-danger/20 bg-danger/5" :
        "border-warning/20 bg-warning/5"
      )}>
        <div className="flex items-center gap-2 mb-1">
          <Shield className={cn("h-5 w-5", overall.textClassName)} />
          <p className={cn("text-sm font-semibold", overall.textClassName)}>{overall.label}</p>
        </div>
        <p className="text-xs text-text-mid">{risk.topReason}</p>
        {risk.secondaryReasons.length > 0 && (
          <p className="text-xs text-text-lo mt-1">{risk.secondaryReasons.slice(0, 2).join(" · ")}</p>
        )}
      </div>

      {/* Risk factors */}
      <div className="space-y-2">
        <p className="text-[10px] text-text-lo uppercase tracking-widest">Risk Factors</p>
        {displayedFactors.slice(0, 5).map((factor) => {
          const FIcon = factorIcon(factor.id);
          return (
            <div key={factor.id} className={cn("rounded-lg border p-2.5", severityBg(factor.state))}>
              <div className="flex items-start gap-2">
                <FIcon className={cn("h-3.5 w-3.5 flex-shrink-0 mt-0.5", severityColor(factor.state))} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-xs font-medium text-text-hi">{factor.label}</p>
                    <span className={cn("num text-[10px] font-semibold flex-shrink-0", severityColor(factor.state))}>
                      {factor.displayValue ?? factor.state}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-mid">{factor.explanation}</p>
                  {factor.recommendation && (
                    <p className="text-[10px] text-text-lo mt-0.5">→ {factor.recommendation}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== STRESS CONTENT =====
function StressContent({ summary }: { summary?: PortfolioStressSummary | null }) {
  if (!summary) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised p-4 text-center">
        <ShieldAlert className="h-6 w-6 text-text-lo mx-auto mb-2" />
        <p className="text-xs text-text-mid">Loading stress view...</p>
      </div>
    );
  }

  const headlineReason = summary.headline.replace(`${summary.overallState} — `, "");

  return (
    <div className="space-y-3">
      {/* Overall status */}
      <div className="rounded-lg border border-accent/20 bg-accent/5 p-3">
        <p className="text-xs text-text-mid mb-1">Overall: {summary.overallState}</p>
        <p className="text-sm font-semibold text-text-hi">{headlineReason}</p>
      </div>

      {/* Biggest danger */}
      <div className="rounded-lg border border-danger/15 bg-danger/5 p-3">
        <p className="text-[10px] text-danger uppercase tracking-widest mb-1">Biggest Danger</p>
        <p className="text-sm font-semibold text-text-hi">{summary.biggestDanger.label}</p>
        <p className="text-xs text-text-mid mt-0.5">{summary.biggestDanger.explanation}</p>
      </div>

      {/* Access tiers */}
      <div className="space-y-2">
        <div className="rounded-lg border border-success/20 bg-success/5 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-success">Defensive Cash</p>
            <p className="text-sm font-semibold text-success num">{formatUSD(summary.defensiveCash.totalUsd ?? 0)}</p>
          </div>
          <p className="text-[10px] text-text-lo mb-2">Stable balances ready immediately</p>
          {summary.defensiveCash.topItems.slice(0, 2).map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-text-mid">{item.label}</span>
              <span className="text-text-hi num">{formatUSD(item.valueUsd ?? 0)}</span>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-accent/20 bg-accent/5 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-accent">Quick To Sell</p>
            <p className="text-sm font-semibold text-accent num">{formatUSD(summary.quickToSell.totalUsd ?? 0)}</p>
          </div>
          <p className="text-[10px] text-text-lo mb-2">Easy to sell, exposed to price swings</p>
          {summary.quickToSell.topItems.slice(0, 2).map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-text-mid">{item.label}</span>
              <span className="text-text-hi num">{formatUSD(item.valueUsd ?? 0)}</span>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-warning/20 bg-warning/5 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-warning">Slower Access</p>
            <p className="text-sm font-semibold text-warning num">{formatUSD(summary.limitedAccess.totalLimitedUsd ?? 0)}</p>
          </div>
          <p className="text-[10px] text-text-lo mb-2">Needs withdrawal, unlock, or extra steps</p>
          {summary.limitedAccess.topItems.slice(0, 2).map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-text-mid">{item.label}</span>
              <span className="text-text-hi num">{formatUSD(item.valueUsd ?? 0)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Urgent actions */}
      {summary.urgentActions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-text-lo uppercase tracking-widest">Urgent Actions</p>
          {summary.urgentActions.slice(0, 3).map((action) => (
            <div key={action.id} className="flex items-start gap-2 rounded-lg border border-border bg-surface-raised p-2">
              <span className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold",
                action.priority === "High" ? "bg-danger/20 text-danger" :
                action.priority === "Medium" ? "bg-warning/20 text-warning" :
                "bg-accent/20 text-accent"
              )}>
                {action.priority === "High" ? "!" : action.priority === "Medium" ? "~" : "-"}
              </span>
              <p className="text-xs text-text-mid flex-1">{action.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== WHAT IF CONTENT =====
function WhatIfContent({
  portfolio,
  selectedGoal,
  perpsData,
}: {
  portfolio?: Portfolio;
  selectedGoal?: PortfolioGoal;
  perpsData?: PerpsApiResponse | null;
}) {
  const scenarios = useMemo(() => {
    if (!portfolio) return [];
    return buildAdaptiveScenarioResults(portfolio, selectedGoal, perpsData);
  }, [portfolio, selectedGoal, perpsData]);

  const [activeScenarioId, setActiveScenarioId] = useState<string>(scenarios[0]?.scenarioId ?? "");

  useEffect(() => {
    if (!scenarios.length) {
      setActiveScenarioId("");
      return;
    }
    if (!scenarios.some((scenario) => scenario.scenarioId === activeScenarioId)) {
      setActiveScenarioId(scenarios[0].scenarioId);
    }
  }, [scenarios, activeScenarioId]);

  const simulation = scenarios.find(s => s.scenarioId === activeScenarioId) ?? scenarios[0];

  if (!portfolio || scenarios.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised p-4 text-center">
        <ArrowRightLeft className="h-6 w-6 text-text-lo mx-auto mb-2" />
        <p className="text-xs text-text-mid">Loading scenarios...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Scenario selector */}
      <div className="flex flex-wrap gap-1">
        {scenarios.map((scenario) => (
          <button
            key={scenario.scenarioId}
            type="button"
            onClick={() => setActiveScenarioId(scenario.scenarioId)}
            className={cn(
              "rounded-lg border px-2 py-1.5 text-xs text-left transition-colors",
              scenario.scenarioId === activeScenarioId
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border bg-bg/60 text-text-mid hover:border-border-strong"
            )}
          >
            <p className="font-medium">{scenario.title}</p>
          </button>
        ))}
      </div>

      {simulation && (
        <>
          {/* Main simulation info */}
          <div className="rounded-lg border border-border bg-surface-raised p-3">
            <div className="flex items-center gap-2 mb-2">
              <ArrowRightLeft className="h-4 w-4 text-accent" />
              <p className="text-sm font-semibold text-text-hi">{simulation.title}</p>
            </div>
            <p className="text-xs text-text-mid mb-2">{simulation.description}</p>
            <p className="text-[11px] text-accent italic">{simulation.reasonGenerated}</p>
          </div>

          {/* Takeaway */}
          <div className="rounded-lg border border-accent/15 bg-accent/5 p-3">
            <p className="text-[10px] text-accent uppercase tracking-widest mb-1">Main Takeaway</p>
            <p className="text-sm text-text-hi">{simulation.takeaway}</p>
          </div>

          {/* Value impact */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border bg-bg/40 p-2.5">
              <p className="text-[10px] text-text-lo uppercase tracking-widest">Value Impact</p>
              <p className={cn(
                "text-sm font-semibold num mt-1",
                (simulation.estimatedValueDeltaUsd ?? 0) >= 0 ? "text-success" : "text-danger"
              )}>
                {(simulation.estimatedValueDeltaUsd ?? 0) >= 0 ? "+" : ""}{formatUSD(simulation.estimatedValueDeltaUsd ?? 0)}
              </p>
              <p className="text-[10px] text-text-lo num">
                {(simulation.estimatedValueDeltaPct ?? 0) >= 0 ? "+" : ""}{(simulation.estimatedValueDeltaPct ?? 0).toFixed(1)}%
              </p>
            </div>

            <div className="rounded-lg border border-border bg-bg/40 p-2.5">
              <p className="text-[10px] text-text-lo uppercase tracking-widest">Risk Change</p>
              <p className="text-sm font-semibold text-text-hi mt-1">
                {simulation.riskDelta.before} → {simulation.riskDelta.after}
              </p>
            </div>
          </div>

          {/* Bucket changes */}
          {simulation.bucketDeltas.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-text-lo uppercase tracking-widest">Bucket Changes</p>
              {simulation.bucketDeltas.slice(0, 3).map((bucket) => (
                <div key={bucket.bucket} className="flex items-center justify-between rounded-lg border border-border bg-bg/30 px-3 py-2">
                  <div>
                    <p className="text-xs font-medium text-text-hi">{bucket.bucket}</p>
                    <p className="text-[10px] text-text-lo num">
                      {(bucket.deltaPctPoints ?? 0) >= 0 ? "+" : ""}{(bucket.deltaPctPoints ?? 0).toFixed(1)} pts
                    </p>
                  </div>
                  <span className={cn(
                    "text-xs font-semibold num",
                    (bucket.deltaUsd ?? 0) >= 0 ? "text-success" : "text-danger"
                  )}>
                    {(bucket.deltaUsd ?? 0) >= 0 ? "+" : ""}{formatUSD(bucket.deltaUsd ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Assumptions */}
          {simulation.assumptions.length > 0 && (
            <div className="rounded-lg border border-border/50 bg-bg/50 p-2.5">
              <p className="text-[10px] text-text-lo uppercase tracking-widest mb-1">Assumptions</p>
              <ul className="space-y-0.5">
                {simulation.assumptions.slice(0, 2).map((assumption, i) => (
                  <li key={i} className="text-[10px] text-text-mid flex items-start gap-1">
                    <span className="text-accent">·</span>
                    {assumption}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ===== BEHAVIOR INSIGHTS CONTENT =====
function BehaviorAccessContent({
  trackedWallets,
  walletResults,
  activeAddress,
  portfolio,
  perpsData,
  selectedGoal,
}: {
  trackedWallets: WalletEntry[];
  walletResults: WalletResult[];
  activeAddress: string;
  portfolio?: Portfolio;
  perpsData?: PerpsApiResponse | null;
  selectedGoal: PortfolioGoal;
}) {
  const { summary, isLoading } = useBehaviorInsights({
    trackedWallets,
    walletResults,
    activeAddress,
    activePortfolio: portfolio,
    activePerps: perpsData,
    selectedGoal,
  });

  const insights = summary.insights.slice(0, 4);

  if (isLoading && insights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 gap-2">
        <Repeat className="h-6 w-6 text-text-lo animate-pulse" />
        <p className="text-xs text-text-lo">Analyzing patterns across your wallets...</p>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 gap-2 px-2">
        <ShieldCheck className="h-6 w-6 text-success" />
        <p className="text-xs text-text-mid text-center">
          No clear behavior patterns yet. Keep using the app to build up history.
        </p>
        {summary.coverageNote && (
          <p className="text-[10px] text-text-lo text-center">{summary.coverageNote}</p>
        )}
      </div>
    );
  }

  const scopeLabel = (scope: string) => {
    if (scope === "all_tracked_wallets") return "All wallets";
    if (scope === "multiple_wallets") return "Some wallets";
    return "One wallet";
  };

  const severityColor = (s: string) => {
    if (s === "High") return "text-danger";
    if (s === "Medium") return "text-warning";
    return "text-text-mid";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1 px-1">
        <Repeat className="h-4 w-4 text-accent" />
        <p className="text-xs font-semibold text-text-hi">Patterns Over Time</p>
        <span className="text-[10px] text-text-lo">· {summary.scope === "multi_wallet" ? "Cross-wallet" : "Single wallet"}</span>
      </div>

      {summary.coverageNote && (
        <p className="text-[10px] text-text-lo px-2">{summary.coverageNote}</p>
      )}

      <div className="space-y-2">
        {insights.map((insight: BehaviorInsight) => (
          <div key={insight.id} className="rounded-lg border border-border bg-surface-raised p-3">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-xs font-bold text-text-hi">{insight.title}</p>
                <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded", severityColor(insight.severity))}>
                  {insight.severity}
                </span>
              </div>
              <span className="text-[9px] text-text-lo whitespace-nowrap">{scopeLabel(insight.appliesTo)}</span>
            </div>
            <p className="text-[11px] text-text-mid leading-relaxed">{insight.summary}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] text-text-lo">{insight.frequency}</span>
              {insight.confidence !== "High" && (
                <span className="text-[9px] text-text-lo">· {insight.confidence} confidence</span>
              )}
            </div>
            {insight.recommendation && (
              <p className="text-[10px] text-accent mt-1 leading-relaxed">
                Watch: {insight.recommendation}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== MAIN COMPONENT =====
export function DesktopWalletSummaryChatbox({
  portfolio,
  intelligence,
  selectedGoal,
  stressSummary,
  goalFitSummary,
  walletCheckupSummary,
  onSelectGoal,
  trackedWallets = [],
  walletResults = [],
  perpsData,
}: {
  portfolio?: Portfolio;
  intelligence?: PortfolioIntelligence | null;
  selectedGoal: PortfolioGoal;
  stressSummary?: PortfolioStressSummary | null;
  goalFitSummary?: PortfolioGoalFitSummary | null;
  walletCheckupSummary?: WalletCheckupSummary | null;
  onSelectGoal?: (goal: PortfolioGoal) => void;
  trackedWallets?: WalletEntry[];
  walletResults?: WalletResult[];
  perpsData?: PerpsApiResponse | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState<QuickAccessFeature | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeFeature && contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [activeFeature]);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
    if (isMinimized) setIsMinimized(false);
  }, [isMinimized]);

  const toggleMinimize = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMinimized((prev) => !prev);
  }, []);

  const handleFeatureClick = useCallback((feature: QuickAccessFeature) => {
    setActiveFeature((prev) => (prev === feature ? null : feature));
  }, []);

  if (!portfolio) return null;

  const s = portfolio.summary;

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={toggleOpen}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full border border-accent/30 bg-bg/90 px-4 py-3 text-left shadow-2xl backdrop-blur-xl transition-all hover:bg-bg active:scale-[0.98]"
        style={{
          boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgb(var(--accent) / 0.1)",
        }}
        aria-label="Open wallet summary"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 border border-accent/30">
          <Wallet className="h-4 w-4 text-accent" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-text-hi">Wallet Summary</span>
          <span className="text-[10px] text-text-lo num">{formatUSD(s.totalUsdValue, { compact: true })}</span>
        </div>
        <div
          className={cn(
            "ml-1 flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium num",
            (s.change24h ?? 0) >= 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
          )}
        >
          {(s.change24h ?? 0) >= 0 ? (
            <TrendingUp className="h-2.5 w-2.5" />
          ) : (
            <TrendingDown className="h-2.5 w-2.5" />
          )}
          {formatPct(s.change24h ?? 0)}
        </div>
      </button>
    );
  }

  // Minimized view
  if (isMinimized) {
    return (
      <button
        type="button"
        onClick={toggleOpen}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-accent/30 bg-bg/90 px-3 py-2.5 text-left shadow-2xl backdrop-blur-xl transition-all hover:bg-bg active:scale-[0.98]"
        style={{
          boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgb(var(--accent) / 0.1)",
        }}
        aria-label="Open wallet summary"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 border border-accent/30">
          <Wallet className="h-3.5 w-3.5 text-accent" />
        </div>
        <ChevronUp className="h-4 w-4 text-text-lo" />
      </button>
    );
  }

  // Full chatbox view
  return (
    <div
      className="fixed bottom-6 right-6 z-40 flex flex-col rounded-2xl border border-border bg-bg shadow-2xl overflow-hidden"
      style={{
        width: "480px",
        maxHeight: "680px",
        boxShadow: "0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgb(var(--accent) / 0.1)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b border-border px-3 py-2"
        style={{ background: "rgb(var(--accent) / 0.06)" }}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 border border-accent/30">
            <Wallet className="h-3.5 w-3.5 text-accent" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-hi">Wallet Summary</p>
            <p className="text-[9px] text-text-lo">Quick access to your tools</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleMinimize}
            className="rounded-lg border border-border bg-surface-raised p-1.5 text-text-lo transition-colors hover:text-text-hi"
            aria-label="Minimize"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={toggleOpen}
            className="rounded-lg border border-border bg-surface-raised p-1.5 text-text-lo transition-colors hover:text-text-hi"
            aria-label="Close"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Summary Stats Bar */}
      <div
        className="border-b border-border px-3 py-2"
        style={{ background: "rgb(var(--text-hi)/0.02)" }}
      >
        <WalletSummaryBar
          totalValue={s.totalUsdValue}
          change24h={s.change24h ?? 0}
          walletValue={s.walletUsdValue}
          defiValue={s.defiNetUsdValue}
        />
      </div>

      {/* Quick Access Grid */}
      <div className="border-b border-border px-3 py-2" style={{ background: "rgb(var(--text-hi)/0.02)" }}>
        <div className="grid grid-cols-6 gap-1">
          {QUICK_ACCESS_ACTIONS.map((action) => {
            const Icon = action.icon;
            const isActive = activeFeature === action.id;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => handleFeatureClick(action.id)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg border p-1.5 text-center transition-all",
                  isActive
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-border bg-bg/60 text-text-mid hover:border-border-strong hover:text-text-hi"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[10px] font-medium leading-tight">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div ref={contentRef} className="flex-1 overflow-y-auto px-3 py-3">
        {activeFeature === null ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Bot className="h-8 w-8 text-text-lo mb-2" />
            <p className="text-xs text-text-mid">Select a tool above to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeFeature === "buckets" && portfolio && (
              <BucketsContent portfolio={portfolio} />
            )}
            {activeFeature === "risk" && (
              <RiskContent intelligence={intelligence} />
            )}
            {activeFeature === "stress" && (
              <StressContent summary={stressSummary} />
            )}
            {activeFeature === "whatif" && (
              <WhatIfContent portfolio={portfolio} selectedGoal={selectedGoal} perpsData={perpsData} />
            )}
            {activeFeature === "behavior" && (
              <BehaviorAccessContent
                trackedWallets={trackedWallets}
                walletResults={walletResults}
                activeAddress={trackedWallets[0]?.address ?? ""}
                portfolio={portfolio}
                perpsData={perpsData}
                selectedGoal={selectedGoal}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
