"use client";

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
  type LucideIcon,
} from "lucide-react";
import { cn, formatUSD, formatPct } from "@/lib/utils";
import { usePWAData } from "@/components/pwa/PWAContext";
import { useCountUp } from "@/hooks/useCountUp";
import { buildPortfolioBuckets } from "@/lib/portfolioBuckets";
import { buildAdaptiveScenarioResults } from "@/lib/scenarioSimulator";

import type { PortfolioBucketId } from "@/types";

// Quick access feature type
type QuickAccessFeature = "checkup" | "goal" | "buckets" | "risk" | "stress" | "whatif";

interface QuickAccessAction {
  id: QuickAccessFeature;
  label: string;
  icon: LucideIcon;
  description: string;
}

const QUICK_ACCESS_ACTIONS: QuickAccessAction[] = [
  { id: "checkup", label: "Checkup", icon: Sparkles, description: "Beginner-friendly wallet review" },
  { id: "goal", label: "Goal Mode", icon: Target, description: "See how wallet fits your goal" },
  { id: "buckets", label: "Money Sits", icon: Layers, description: "Where your money is allocated" },
  { id: "risk", label: "Risk Truth", icon: Shield, description: "Current portfolio risk state" },
  { id: "stress", label: "Stress View", icon: ShieldAlert, description: "Emergency access funds" },
  { id: "whatif", label: "What If", icon: ArrowRightLeft, description: "Test market scenarios" },
];

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
          <p className="num text-base font-bold text-text-hi">
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

// Content cards for each feature
function CheckupContent({ summary }: { summary?: any }) {
  if (!summary) {
    return (
      <div className="rounded-xl border border-border bg-surface-raised p-4 text-center">
        <p className="text-sm text-text-mid">Loading checkup data...</p>
      </div>
    );
  }

  const priorityColors: Record<string, string> = {
    "First": "bg-danger/20 text-danger",
    "Next": "bg-warning/20 text-warning",
    "Keep in Mind": "bg-accent/20 text-accent",
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <p className="text-sm font-semibold text-text-hi">{summary.walletStyle.label}</p>
        </div>
        <p className="text-xs text-text-mid">{summary.walletStyle.explanation}</p>
      </div>

      {/* Complexity / Risk badges */}
      <div className="flex gap-2">
        <div className="flex-1 rounded-lg border border-border bg-surface-raised px-3 py-2 text-center">
          <p className="text-[9px] text-text-lo uppercase tracking-wider">Complexity</p>
          <p className={cn(
            "text-xs font-semibold mt-0.5",
            summary.complexity.level === "Low" ? "text-success" :
            summary.complexity.level === "High" ? "text-danger" : "text-warning"
          )}>{summary.complexity.level}</p>
        </div>
        <div className="flex-1 rounded-lg border border-border bg-surface-raised px-3 py-2 text-center">
          <p className="text-[9px] text-text-lo uppercase tracking-wider">Biggest Risk</p>
          <p className="text-xs font-semibold text-danger mt-0.5">{summary.biggestRisk.label}</p>
        </div>
        <div className="flex-1 rounded-lg border border-border bg-surface-raised px-3 py-2 text-center">
          <p className="text-[9px] text-text-lo uppercase tracking-wider">Dominant</p>
          <p className="text-xs font-semibold text-accent mt-0.5">{summary.dominantArea.label}</p>
        </div>
      </div>

      {/* Goal Fit */}
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

      {summary.firstThingsToUnderstand?.slice(0, 4).map((item: any, i: number) => (
        <div key={item.id} className="rounded-lg border border-border bg-surface-raised p-3">
          <div className="flex items-start gap-2">
            <span className={cn(
              "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
              priorityColors[item.priority] ?? "bg-accent/20 text-accent"
            )}>
              {i + 1}
            </span>
            <div>
              <p className="text-xs font-semibold text-text-hi">{item.text}</p>
            </div>
          </div>
        </div>
      ))}

      {summary.helperNotes && summary.helperNotes.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-bg/50 p-3">
          <p className="text-[10px] text-text-lo uppercase tracking-widest mb-2">Helper Notes</p>
          <ul className="space-y-1">
            {summary.helperNotes.map((note: string, i: number) => (
              <li key={i} className="text-xs text-text-mid">· {note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function GoalContent({ summary, selectedGoal }: { summary?: any; selectedGoal: string }) {
  if (!summary) {
    return (
      <div className="rounded-xl border border-border bg-surface-raised p-4 text-center">
        <p className="text-sm text-text-mid">Loading goal analysis...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Target className="h-4 w-4 text-accent" />
          <p className="text-sm font-semibold text-text-hi">Goal: {selectedGoal}</p>
        </div>
        <p className="text-xs text-text-mid">{summary.headline}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-success/20 bg-success/5 p-3">
          <p className="text-[10px] text-success uppercase tracking-wider">Aligned</p>
          <p className="text-sm font-semibold text-text-hi mt-1">{summary.topAlignedArea?.label}</p>
          <p className="text-[10px] text-text-mid">{summary.topAlignedArea?.explanation}</p>
        </div>
        <div className="rounded-lg border border-warning/20 bg-warning/5 p-3">
          <p className="text-[10px] text-warning uppercase tracking-wider">Needs Work</p>
          <p className="text-sm font-semibold text-text-hi mt-1">{summary.topMismatch?.label}</p>
          <p className="text-[10px] text-text-mid">{summary.topMismatch?.explanation}</p>
        </div>
      </div>
    </div>
  );
}

function BucketsContent({ portfolio }: { portfolio: any }) {
  const buckets = useMemo(() => buildPortfolioBuckets(portfolio), [portfolio]);

  const BUCKET_COLORS: Record<PortfolioBucketId, string> = {
    safe_cash: "#10B981",
    long_term_holds: "#6366F1",
    active_trades: "#ffb4ab",
    defi_earn: "#8B5CF6",
    locked_funds: "#EF4444",
    forgotten_dust: "#5a78a0",
  };

  const BUCKET_ICONS: Record<PortfolioBucketId, LucideIcon> = {
    safe_cash: PiggyBank,
    long_term_holds: Coins,
    active_trades: Activity,
    defi_earn: Building2,
    locked_funds: Lock,
    forgotten_dust: Sparkles,
  };

  const [selectedBucket, setSelectedBucket] = useState<PortfolioBucketId | null>(null);

  const totalUsd = buckets.reduce((sum, b) => sum + b.totalUsdValue, 0);

  const selected = selectedBucket ? buckets.find(b => b.bucketId === selectedBucket) : null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-surface-raised p-4">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-accent" />
          <p className="text-sm font-semibold text-text-hi">Money Sits in 6 Buckets</p>
        </div>

        {/* Bar visualization */}
        <div className="flex h-3 rounded-full overflow-hidden mb-3">
          {buckets.map((b) => {
            const pct = totalUsd > 0 ? (b.totalUsdValue / totalUsd) * 100 : 0;
            return (
              <div
                key={b.bucketId}
                style={{ width: `${Math.max(pct, 1)}%`, background: BUCKET_COLORS[b.bucketId] }}
                title={`${b.bucketId}: ${pct.toFixed(1)}%`}
                className="cursor-pointer"
                onClick={() => setSelectedBucket(selectedBucket === b.bucketId ? null : b.bucketId)}
              />
            );
          })}
        </div>

        {/* Bucket list */}
        <div className="space-y-1.5">
          {buckets.map((b) => {
            const pct = totalUsd > 0 ? (b.totalUsdValue / totalUsd) * 100 : 0;
            const Icon = BUCKET_ICONS[b.bucketId];
            const isActive = selectedBucket === b.bucketId;
            return (
              <button
                key={b.bucketId}
                type="button"
                onClick={() => setSelectedBucket(isActive ? null : b.bucketId)}
                className={cn(
                  "w-full flex items-center justify-between rounded-lg border px-2.5 py-2 text-left transition-all",
                  isActive ? "border-accent/40 bg-accent/5" : "border-border/50 bg-bg/50 hover:border-border"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: BUCKET_COLORS[b.bucketId] }} />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3 w-3 text-text-lo" />
                      <span className="text-[11px] font-medium text-text-hi capitalize">{b.bucketId.replace(/_/g, " ")}</span>
                    </div>
                    <p className="text-[9px] text-text-lo mt-0.5 line-clamp-1">{b.description}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-[11px] font-semibold text-text-hi num">{formatUSD(b.totalUsdValue, { compact: true })}</p>
                  <p className="text-[9px] text-text-lo">{pct.toFixed(1)}%</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected bucket drilldown */}
      {selected && selected.items.length > 0 && (
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-3">
          <p className="text-[10px] text-accent uppercase tracking-widest mb-2">Top Items in {selected.bucketId.replace(/_/g, " ")}</p>
          <div className="space-y-1.5">
            {selected.items.slice(0, 6).map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm">{item.chainEmoji}</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-text-hi truncate">{item.name}</p>
                    <p className="text-[9px] text-text-lo">{item.reason}</p>
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-text-hi num flex-shrink-0 ml-2">{formatUSD(item.usdValue, { compact: true })}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RiskContent({ intelligence }: { intelligence?: any }) {
  if (!intelligence) {
    return (
      <div className="rounded-xl border border-border bg-surface-raised p-4 text-center">
        <p className="text-sm text-text-mid">Loading risk data...</p>
      </div>
    );
  }

  const { risk } = intelligence;

  const severityColor = (s: string) => ({
    Safe: "text-success",
    Watch: "text-warning",
    Risky: "text-warning",
    Critical: "text-danger",
  }[s] ?? "text-text-mid");

  const severityBg = (s: string) => ({
    Safe: "border-success/20 bg-success/5",
    Watch: "border-warning/20 bg-warning/5",
    Risky: "border-warning/20 bg-warning/5",
    Critical: "border-danger/20 bg-danger/5",
  }[s] ?? "border-border bg-surface-raised");

  const factorIcon = (id: string) => {
    switch (id) {
      case "chain_concentration": return Layers;
      case "protocol_concentration": return Building2;
      case "top_holding": return Coins;
      case "stablecoin_ratio": return Coins;
      case "borrow_exposure": return ArrowDownLeft;
      case "perp_leverage": return Activity;
      default: return ShieldAlert;
    }
  };

  const displayedFactors = risk.rankedFactors?.length > 0
    ? risk.rankedFactors
    : [...(risk.triggeredFactors ?? []), ...(risk.safeFactors ?? [])];

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
          <Shield className={cn("h-4 w-4", severityColor(risk.overallState))} />
          <p className={cn("text-sm font-semibold", severityColor(risk.overallState))}>
            {risk.overallState}
          </p>
        </div>
        <p className="text-xs text-text-mid">{risk.topReason}</p>
        {risk.secondaryReasons?.length > 0 && (
          <p className="text-xs text-text-lo mt-1">{risk.secondaryReasons.slice(0, 2).join(" · ")}</p>
        )}
      </div>

      {/* Risk factors */}
      {displayedFactors.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-text-lo uppercase tracking-widest">Risk Factors</p>
          {displayedFactors.slice(0, 5).map((factor: any) => {
            const FIcon = factorIcon(factor.id);
            return (
              <div key={factor.id} className={cn("rounded-lg border p-2.5", severityBg(factor.state))}>
                <div className="flex items-start gap-2">
                  <FIcon className={cn("h-3.5 w-3.5 flex-shrink-0 mt-0.5", severityColor(factor.state))} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold text-text-hi">{factor.label}</p>
                      {factor.displayValue && (
                        <span className="text-[10px] font-medium text-text-lo">{factor.displayValue}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-text-mid mt-0.5">{factor.explanation}</p>
                    {factor.recommendation && (
                      <p className="text-[9px] text-accent mt-1">→ {factor.recommendation}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StressContent({ summary }: { summary?: any }) {
  if (!summary) {
    return (
      <div className="rounded-xl border border-border bg-surface-raised p-4 text-center">
        <p className="text-sm text-text-mid">Loading stress view...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="h-4 w-4 text-accent" />
          <p className="text-sm font-semibold text-text-hi">Stress View: {summary.overallState}</p>
        </div>
        <p className="text-xs text-text-mid">{summary.biggestDanger?.explanation}</p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <div className="rounded-lg border border-success/15 bg-success/5 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-success">Defensive Cash</p>
            <p className="text-sm font-semibold text-success num">
              {formatUSD(summary.defensiveCash?.totalUsd ?? 0, { compact: true })}
            </p>
          </div>
          <p className="text-[10px] text-text-mid mt-1">Stable balances ready immediately</p>
        </div>

        <div className="rounded-lg border border-accent/15 bg-accent/5 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-accent">Quick To Sell</p>
            <p className="text-sm font-semibold text-accent num">
              {formatUSD(summary.quickToSell?.totalUsd ?? 0, { compact: true })}
            </p>
          </div>
          <p className="text-[10px] text-text-mid mt-1">Easy to sell, may move in price</p>
        </div>

        <div className="rounded-lg border border-warning/15 bg-warning/5 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-warning">Slower Access</p>
            <p className="text-sm font-semibold text-warning num">
              {formatUSD(summary.limitedAccess?.totalLimitedUsd ?? 0, { compact: true })}
            </p>
          </div>
          <p className="text-[10px] text-text-mid mt-1">Needs withdrawal or extra steps</p>
        </div>
      </div>
    </div>
  );
}

function WhatIfContent({ portfolio, selectedGoal, perpsData }: { portfolio: any; selectedGoal: any; perpsData?: any }) {
  const scenarios = useMemo(
    () => (portfolio ? buildAdaptiveScenarioResults(portfolio, selectedGoal, perpsData) : null),
    [portfolio, selectedGoal, perpsData]
  );

  if (!scenarios || scenarios.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-raised p-4 text-center">
        <p className="text-sm text-text-mid">Loading scenario data...</p>
      </div>
    );
  }

  const [expandedScenario, setExpandedScenario] = useState<string | null>(scenarios[0]?.scenarioId ?? null);

  const toggleScenario = (id: string) => setExpandedScenario(expandedScenario === id ? null : id);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-surface-raised p-4">
        <div className="flex items-center gap-2 mb-3">
          <ArrowRightLeft className="h-4 w-4 text-accent" />
          <p className="text-sm font-semibold text-text-hi">What If Scenarios</p>
        </div>
        <p className="text-xs text-text-mid mb-3">Auto-generated from your wallet composition</p>

        <div className="space-y-2">
          {scenarios.slice(0, 5).map((scenario) => {
            const isPositive = (scenario.estimatedValueDeltaUsd ?? 0) >= 0;
            const isExpanded = expandedScenario === scenario.scenarioId;
            return (
              <div key={scenario.scenarioId} className="rounded-lg border border-border bg-bg/50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleScenario(scenario.scenarioId)}
                  className="w-full flex items-start justify-between p-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-text-hi truncate">{scenario.title}</p>
                    <p className="text-[9px] text-text-lo mt-0.5 line-clamp-1">{scenario.reasonGenerated}</p>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0 ml-2">
                    <span className={cn(
                      "text-xs font-semibold num",
                      isPositive ? "text-success" : "text-danger"
                    )}>
                      {isPositive ? "+" : ""}{formatUSD(scenario.estimatedValueDeltaUsd ?? 0, { compact: true })}
                    </span>
                    <span className="text-[9px] text-text-lo">
                      {scenario.riskDelta.before} → {scenario.riskDelta.after}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-border/50 pt-2">
                    <p className="text-xs text-text-mid mb-2">{scenario.description}</p>

                    {scenario.bucketDeltas.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {scenario.bucketDeltas.slice(0, 3).map((delta) => (
                          <span key={delta.bucket} className="text-[9px] px-1.5 py-0.5 rounded bg-border/50 text-text-mid">
                            {delta.bucket.replace(/_/g, " ")}: {(delta.deltaPctPoints ?? 0) >= 0 ? "+" : ""}{(delta.deltaPctPoints ?? 0).toFixed(1)} pts
                          </span>
                        ))}
                      </div>
                    )}

                    {scenario.assumptions.length > 0 && (
                      <div className="rounded bg-bg/50 p-2">
                        <p className="text-[9px] text-text-lo uppercase tracking-widest mb-1">Assumptions</p>
                        <ul className="space-y-0.5">
                          {scenario.assumptions.slice(0, 2).map((a: string, i: number) => (
                            <li key={i} className="text-[10px] text-text-mid">· {a}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function WalletSummaryChatbox() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState<QuickAccessFeature | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const {
    portfolio,
    intelligence,
    selectedGoal,
    stressSummary,
    goalFitSummary,
    walletCheckupSummary,
    perpsData,
  } = usePWAData();

  // Auto-scroll to content when feature changes
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
        className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full border border-accent/30 bg-bg/90 px-3 py-2.5 text-left shadow-2xl backdrop-blur-xl transition-all hover:bg-bg active:scale-[0.98]"
        style={{
          boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgb(var(--accent) / 0.1)",
        }}
        aria-label="Open wallet summary"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 border border-accent/30">
          <Wallet className="h-3.5 w-3.5 text-accent" />
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold text-text-hi">Summary</span>
          <span className="text-[9px] text-text-lo num">{formatUSD(s.totalUsdValue, { compact: true })}</span>
        </div>
        <div
          className={cn(
            "ml-1 flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium num",
            (s.change24h ?? 0) >= 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
          )}
        >
          {(s.change24h ?? 0) >= 0 ? (
            <TrendingUp className="h-2 w-2" />
          ) : (
            <TrendingDown className="h-2 w-2" />
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
        className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full border border-accent/30 bg-bg/90 px-3 py-2 text-left shadow-2xl backdrop-blur-xl transition-all hover:bg-bg active:scale-[0.98]"
        style={{
          boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgb(var(--accent) / 0.1)",
        }}
        aria-label="Open wallet summary"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 border border-accent/30">
          <Wallet className="h-3 w-3 text-accent" />
        </div>
        <ChevronUp className="h-3.5 w-3.5 text-text-lo" />
      </button>
    );
  }

  // Full chatbox view
  return (
    <div
      className="fixed bottom-20 right-4 z-40 flex flex-col rounded-2xl border border-border bg-bg shadow-2xl overflow-hidden"
      style={{
        width: "420px",
        maxHeight: "580px",
        boxShadow: "0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgb(var(--accent) / 0.1)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b border-border px-3 py-2"
        style={{ background: "rgb(var(--accent) / 0.06)" }}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 border border-accent/30">
            <Wallet className="h-3.5 w-3.5 text-accent" />
          </div>
          <div>
            <p className="text-xs font-semibold text-text-hi">Wallet Summary</p>
            <p className="text-[10px] text-text-lo">Quick access to your tools</p>
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
        className="border-b border-border px-4 py-2.5"
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
        <div className="grid grid-cols-3 gap-1.5">
          {QUICK_ACCESS_ACTIONS.map((action) => {
            const Icon = action.icon;
            const isActive = activeFeature === action.id;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => handleFeatureClick(action.id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-all",
                  isActive
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-border bg-bg/60 text-text-mid hover:border-border-strong hover:text-text-hi"
                )}
              >
                <Icon className="h-4 w-4" />
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
            <Bot className="h-7 w-7 text-text-lo mb-2" />
            <p className="text-xs text-text-mid">Select a tool above to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeFeature === "checkup" && (
              <CheckupContent summary={walletCheckupSummary} />
            )}
            {activeFeature === "goal" && (
              <GoalContent summary={goalFitSummary} selectedGoal={selectedGoal} />
            )}
            {activeFeature === "buckets" && (
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
          </div>
        )}
      </div>
    </div>
  );
}
