"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Sparkles,
  Target,
  Layers,
  Shield, type LucideIcon,
  ShieldAlert,
  ArrowRightLeft,
  Coins,
  Activity,
  Building2,
  Lock,
  PiggyBank,
  ArrowDownLeft,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Repeat,
  ShieldCheck,
  Gift,
  Bot,
} from "lucide-react";
import { cn, formatUSD, formatPct } from "@/lib/utils";
import { usePWAData } from "@/components/pwa/PWAContext";
import { ActivityScore } from "@/components/intelligence/ActivityScore";
import { AIAssistant } from "@/components/intelligence/AIAssistant";
import { useBehaviorInsights } from "@/hooks/useBehaviorInsights";
import { buildPortfolioBuckets } from "@/lib/portfolioBuckets";
import { buildAdaptiveScenarioResults } from "@/lib/scenarioSimulator";
import type { BehaviorInsight, PortfolioBucketId } from "@/types";

type InsightFeature = "buckets" | "risk" | "stress" | "whatif" | "changed" | "pnl" | "behavior" | "airdrop" | "assistant";

const QUICK_ACTIONS: Array<{ id: InsightFeature; label: string; icon: LucideIcon }> = [
  { id: "assistant", label: "AI Chat", icon: Bot },
  { id: "buckets", label: "Money", icon: Layers },
  { id: "risk",    label: "Risk", icon: Shield },
  { id: "stress",  label: "Stress", icon: ShieldAlert },
  { id: "whatif",  label: "What If", icon: ArrowRightLeft },
  { id: "changed", label: "Changed", icon: TrendingUp },
  { id: "pnl",     label: "Earn/Lose", icon: TrendingDown },
  { id: "behavior", label: "Patterns", icon: Repeat },
  { id: "airdrop", label: "Airdrop", icon: Gift },
];

// ===== CHECKUP =====
function CheckupContent({ summary }: { summary?: any }) {
  if (!summary) return <p className="text-sm text-text-mid p-4">Loading checkup...</p>;

  const priorityColors: Record<string, string> = {
    "First": "bg-danger/20 text-danger",
    "Next": "bg-warning/20 text-warning",
    "Keep in Mind": "bg-accent/20 text-accent",
  };

  return (
    <div className="space-y-3 p-3">
      <div className="rounded-xl border border-accent/20 bg-accent/5 p-3">
        <p className="text-sm font-bold text-text-hi">{summary.walletStyle?.label}</p>
        <p className="text-xs text-text-mid mt-1 leading-relaxed">{summary.walletStyle?.explanation}</p>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: "Complexity", value: summary.complexity?.level, sub: summary.complexity?.explanation, color: summary.complexity?.level === "Low" ? "text-success" : summary.complexity?.level === "High" ? "text-danger" : "text-warning" },
          { label: "Biggest Risk", value: summary.biggestRisk?.label, sub: summary.biggestRisk?.explanation, color: "text-danger" },
          { label: "Dominant", value: summary.dominantArea?.label, sub: summary.dominantArea?.explanation, color: "text-accent" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-surface-raised px-2 py-2">
            <p className="text-[10px] text-text-lo uppercase tracking-wider">{item.label}</p>
            <p className={cn("text-xs font-bold mt-0.5", item.color)}>{item.value}</p>
            <p className="text-[10px] text-text-lo mt-0.5 leading-tight line-clamp-2">{item.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface-raised p-2.5">
        <p className="text-[9px] text-text-lo uppercase tracking-widest mb-1.5">Goal: {summary.goalFit?.goal}</p>
        <span className={cn(
          "text-xs font-bold px-2 py-0.5 rounded-lg",
          summary.goalFit?.fitState === "Strong Fit" ? "bg-success/10 text-success" :
          summary.goalFit?.fitState === "Poor Fit" ? "bg-danger/10 text-danger" :
          "bg-warning/10 text-warning"
        )}>
          {summary.goalFit?.fitState}
        </span>
        <p className="text-xs text-text-mid mt-1.5 leading-relaxed">{summary.goalFit?.explanation}</p>
      </div>

      {summary.firstThingsToUnderstand?.length > 0 && (
        <div>
          <p className="text-[9px] text-text-lo uppercase tracking-widest mb-1.5">What to know</p>
          <div className="space-y-1.5">
            {summary.firstThingsToUnderstand.slice(0, 4).map((item: any, i: number) => (
              <div key={item.id} className="flex items-start gap-2 rounded-xl border border-border bg-surface-raised p-2.5">
                <span className={cn(
                  "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  priorityColors[item.priority] ?? "bg-accent/20 text-accent"
                )}>
                  {i + 1}
                </span>
                <p className="text-xs text-text-hi leading-relaxed flex-1">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.helperNotes?.length > 0 && (
        <div className="rounded-xl border border-accent/15 bg-accent/5 p-2.5">
          <p className="text-[9px] text-accent uppercase tracking-widest mb-1.5">Tips</p>
          <ul className="space-y-0.5">
            {summary.helperNotes.map((note: string, i: number) => (
              <li key={i} className="text-xs text-text-mid flex items-start gap-1.5">
                <span className="text-accent mt-0.5">·</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ===== GOAL =====
function GoalContent({ summary, selectedGoal }: { summary?: any; selectedGoal: string }) {
  if (!summary) return <p className="text-sm text-text-mid p-4">Loading goal analysis...</p>;

  return (
    <div className="space-y-3 p-3">
      <div className="rounded-xl border border-accent/20 bg-accent/5 p-3">
        <p className="text-xs font-bold text-text-hi">Your Goal: {selectedGoal}</p>
        <p className="text-xs text-text-mid mt-1 leading-relaxed">{summary.headline}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-success/20 bg-success/5 p-3">
          <p className="text-[9px] text-success uppercase tracking-widest mb-1.5">Aligned</p>
          <p className="text-sm font-bold text-text-hi">{summary.topAlignedArea?.label}</p>
          <p className="text-xs text-text-mid mt-1 leading-relaxed">{summary.topAlignedArea?.explanation}</p>
        </div>
        <div className="rounded-xl border border-warning/20 bg-warning/5 p-3">
          <p className="text-[9px] text-warning uppercase tracking-widest mb-1.5">Needs Attention</p>
          <p className="text-sm font-bold text-text-hi">{summary.topMismatch?.label}</p>
          <p className="text-xs text-text-mid mt-1 leading-relaxed">{summary.topMismatch?.explanation}</p>
        </div>
      </div>

      {summary.recommendations?.length > 0 && (
        <div>
          <p className="text-[9px] text-text-lo uppercase tracking-widest mb-1.5">Recommendations</p>
          <div className="space-y-1.5">
            {summary.recommendations.slice(0, 3).map((rec: any) => (
              <div key={rec.id} className="rounded-xl border border-accent/15 bg-accent/5 p-2.5">
                <p className="text-xs text-text-hi leading-relaxed">{rec.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.factorBreakdown?.length > 0 && (
        <div>
          <p className="text-[9px] text-text-lo uppercase tracking-widest mb-1.5">Factor Breakdown</p>
          <div className="space-y-1">
            {summary.factorBreakdown.slice(0, 5).map((factor: any) => (
              <div key={factor.id} className="rounded-xl border border-border bg-surface-raised p-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-text-hi">{factor.label}</p>
                  <span className={cn(
                    "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                    factor.fitState === "Strong Fit" ? "bg-success/10 text-success" :
                    factor.fitState === "Poor Fit" ? "bg-danger/10 text-danger" :
                    "bg-warning/10 text-warning"
                  )}>
                    {factor.fitState}
                  </span>
                </div>
                <p className="text-[10px] text-text-mid mt-0.5">{factor.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== BUCKETS =====
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

function BucketsContent({ portfolio }: { portfolio: any }) {
  const buckets = useMemo(() => buildPortfolioBuckets(portfolio), [portfolio]);
  const [openBucket, setOpenBucket] = useState<PortfolioBucketId | null>(null);
  const totalUsd = buckets.reduce((sum, b) => sum + b.totalUsdValue, 0);

  return (
    <div className="space-y-2 p-3">
      <div className="rounded-xl border border-border bg-surface-raised p-3">
        <p className="text-sm font-bold text-text-hi mb-0.5">Money in 6 Buckets</p>
        <p className="text-[10px] text-text-lo mb-3">Tap bucket to see assets</p>

        <div className="flex h-2 rounded-full overflow-hidden mb-3">
          {buckets.map((b) => {
            const pct = totalUsd > 0 ? (b.totalUsdValue / totalUsd) * 100 : 0;
            return (
              <div
                key={b.bucketId}
                style={{ width: `${Math.max(pct, 1)}%`, background: BUCKET_COLORS[b.bucketId] }}
                className="cursor-pointer"
                onClick={() => setOpenBucket(openBucket === b.bucketId ? null : b.bucketId)}
              />
            );
          })}
        </div>

        <div className="space-y-1">
          {buckets.map((b) => {
            const pct = totalUsd > 0 ? (b.totalUsdValue / totalUsd) * 100 : 0;
            const Icon = BUCKET_ICONS[b.bucketId];
            const isOpen = openBucket === b.bucketId;
            return (
              <div key={b.bucketId}>
                <button
                  type="button"
                  onClick={() => setOpenBucket(isOpen ? null : b.bucketId)}
                  className={cn(
                    "w-full flex items-center justify-between rounded-lg border px-2 py-1.5 text-left transition-all",
                    isOpen ? "border-accent/40 bg-accent/5" : "border-border/50 bg-bg/50"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-sm flex-shrink-0" style={{ background: BUCKET_COLORS[b.bucketId] }} />
                    <Icon className="h-3 w-3 text-text-lo flex-shrink-0" />
                    <span className="text-[11px] font-medium text-text-hi capitalize truncate">{b.bucketId.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] text-text-lo num">{formatUSD(b.totalUsdValue)}</span>
                    <ChevronDown className={cn("h-3 w-3 text-text-lo transition-transform", isOpen && "rotate-180")} />
                  </div>
                </button>

                {isOpen && b.items.length > 0 && (
                  <div className="mt-1 rounded-lg border border-accent/15 bg-accent/5 p-2.5">
                    <p className="text-[9px] text-accent uppercase tracking-widest mb-1.5">Assets ({b.items.length})</p>
                    <div className="space-y-1.5">
                      {b.items.slice(0, 8).map((item) => (
                        <div key={item.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-sm">{item.chainEmoji}</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-bold text-text-hi">{item.symbol}</span>
                                {item.protocolName && (
                                  <span className="text-[9px] text-text-lo">· {item.protocolName}</span>
                                )}
                              </div>
                              <p className="text-[9px] text-text-lo">{item.reason}</p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-text-hi num flex-shrink-0 ml-2">{formatUSD(item.usdValue)}</span>
                        </div>
                      ))}
                    </div>
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

// ===== RISK =====
function RiskContent({ intelligence }: { intelligence?: any }) {
  if (!intelligence) return <p className="text-sm text-text-mid p-4">Loading risk data...</p>;

  const { risk } = intelligence;

  const severityColor = (s: string) => ({
    Safe: "text-success", Watch: "text-warning", Risky: "text-warning", Critical: "text-danger",
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

  const factors = risk.rankedFactors?.length > 0
    ? risk.rankedFactors
    : [...(risk.triggeredFactors ?? []), ...(risk.safeFactors ?? [])];

  return (
    <div className="space-y-3 p-3">
      <div className={cn(
        "rounded-xl border p-3",
        risk.overallState === "Safe" ? "border-success/20 bg-success/5" :
        risk.overallState === "Critical" ? "border-danger/20 bg-danger/5" :
        "border-warning/20 bg-warning/5"
      )}>
        <div className="flex items-center gap-2 mb-1.5">
          <Shield className={cn("h-4 w-4", severityColor(risk.overallState))} />
          <p className={cn("text-sm font-bold", severityColor(risk.overallState))}>{risk.overallState}</p>
        </div>
        <p className="text-xs text-text-mid leading-relaxed">{risk.topReason}</p>
        {risk.secondaryReasons?.length > 0 && (
          <p className="text-[10px] text-text-lo mt-1 leading-relaxed">{risk.secondaryReasons.join(" · ")}</p>
        )}
      </div>

      {risk.leverage?.isActive && (
        <div className="rounded-xl border border-danger/20 bg-danger/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-3.5 w-3.5 text-danger" />
            <p className="text-xs font-bold text-danger">Leverage Active</p>
          </div>
          <p className="text-[10px] text-text-mid">
            {risk.leverage.openPositions} positions · {formatUSD(risk.leverage.exposureUsd ?? 0)} exposure
          </p>
        </div>
      )}

      {factors.length > 0 && (
        <div className="space-y-1.5">
          {factors.slice(0, 6).map((factor: any) => {
            const FIcon = factorIcon(factor.id);
            return (
              <div key={factor.id} className={cn("rounded-xl border p-3", severityBg(factor.state))}>
                <div className="flex items-start gap-2">
                  <FIcon className={cn("h-3.5 w-3.5 flex-shrink-0 mt-0.5", severityColor(factor.state))} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-text-hi">{factor.label}</p>
                      {factor.displayValue && (
                        <span className="text-[10px] font-medium text-text-lo">{factor.displayValue}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-text-mid mt-0.5 leading-relaxed">{factor.explanation}</p>
                    {factor.recommendation && (
                      <p className="text-[10px] text-accent mt-1 leading-relaxed">→ {factor.recommendation}</p>
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

// ===== STRESS =====
function StressContent({ summary }: { summary?: any }) {
  if (!summary) return <p className="text-sm text-text-mid p-4">Loading stress view...</p>;

  return (
    <div className="space-y-3 p-3">
      <div className="rounded-xl border border-accent/20 bg-accent/5 p-3">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="h-4 w-4 text-accent" />
          <p className="text-xs font-bold text-text-hi">Stress View: {summary.overallState}</p>
        </div>
        <p className="text-xs text-text-mid leading-relaxed">{summary.headline}</p>
      </div>

      {summary.biggestDanger && (
        <div className="rounded-xl border border-danger/15 bg-danger/5 p-3">
          <p className="text-[9px] text-danger uppercase tracking-widest mb-1">Biggest Danger</p>
          <p className="text-sm font-bold text-text-hi">{summary.biggestDanger.label}</p>
          <p className="text-xs text-text-mid mt-0.5 leading-relaxed">{summary.biggestDanger.explanation}</p>
        </div>
      )}

      {[
        { key: "defensiveCash", label: "Defensive Cash", sub: "Ready immediately", color: "text-success", border: "border-success/20 bg-success/5" },
        { key: "quickToSell", label: "Quick To Sell", sub: "Easy to sell, price may vary", color: "text-accent", border: "border-accent/20 bg-accent/5" },
        { key: "limitedAccess", label: "Slower Access", sub: "Needs withdrawal or extra steps", color: "text-warning", border: "border-warning/20 bg-warning/5" },
      ].map((tier) => {
        const data = summary[tier.key];
        return (
          <div key={tier.key} className={cn("rounded-xl border p-3", tier.border)}>
            <div className="flex items-center justify-between mb-1.5">
              <p className={cn("text-xs font-bold", tier.color)}>{tier.label}</p>
              <p className={cn("text-sm font-bold num", tier.color)}>{formatUSD(data?.totalUsd ?? 0)}</p>
            </div>
            <p className="text-[10px] text-text-lo mb-1.5">{tier.sub}</p>
            <div className="space-y-0.5">
              {data?.topItems.slice(0, 3).map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-text-mid">{item.label}</span>
                  <span className="text-xs font-medium text-text-hi num">{formatUSD(item.valueUsd ?? 0)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {summary.urgentActions?.length > 0 && (
        <div>
          <p className="text-[9px] text-text-lo uppercase tracking-widest mb-1.5">Urgent Actions</p>
          <div className="space-y-1.5">
            {summary.urgentActions.map((action: any) => (
              <div key={action.id} className="rounded-xl border border-danger/15 bg-danger/5 p-2.5">
                <div className="flex items-start gap-2">
                  <span className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5",
                    action.priority === "High" ? "bg-danger/20 text-danger" :
                    action.priority === "Medium" ? "bg-warning/20 text-warning" :
                    "bg-accent/20 text-accent"
                  )}>
                    {action.priority}
                  </span>
                  <p className="text-xs text-text-hi leading-relaxed">{action.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== WHAT CHANGED =====
function ChangedContent({ attribution, portfolio }: { attribution?: any; portfolio: any }) {
  if (!attribution) {
    return (
      <div className="space-y-3 p-4">
        <div className="rounded-xl border border-border bg-surface-raised p-4 text-center">
          <p className="text-sm text-text-mid">No change data available</p>
          <p className="text-xs text-text-lo mt-1">Change tracking requires historical snapshots</p>
        </div>
      </div>
    );
  }

  const isPositive = attribution.totalChangeDollars >= 0;
  const items = [
    { label: "Price Movement", value: attribution.priceMovement, icon: TrendingUp },
    { label: "DeFi Yield", value: attribution.defiYield, icon: Activity },
    { label: "Rewards", value: attribution.rewards, icon: Sparkles },
    { label: "Perp Change", value: attribution.perpChange, icon: ArrowRightLeft },
    { label: "Net Transfers", value: attribution.netTransfers, icon: ArrowUpRight },
    { label: "Fees Paid", value: -Math.abs(attribution.fees), icon: ArrowDownRight },
  ];

  return (
    <div className="space-y-3 p-3">
      <div className={cn(
        "rounded-xl border p-4",
        isPositive ? "border-success/20 bg-success/5" : "border-danger/20 bg-danger/5"
      )}>
        <p className="text-xs text-text-lo mb-1">{attribution.period}</p>
        <div className="flex items-center gap-3">
          <span className={cn("text-2xl font-bold num", isPositive ? "text-success" : "text-danger")}>
            {isPositive ? "+" : ""}{formatUSD(attribution.totalChangeDollars)}
          </span>
          <span className={cn("text-lg font-bold num", isPositive ? "text-success" : "text-danger")}>
            ({isPositive ? "+" : ""}{attribution.totalChangePct.toFixed(2)}%)
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface-raised p-3">
        <p className="text-[10px] text-text-lo uppercase tracking-widest mb-2">Breakdown</p>
        <div className="space-y-2">
          {items.map((item) => {
            const itemPositive = item.value >= 0;
            const ItemIcon = item.icon;
            return (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ItemIcon className={cn("h-3.5 w-3.5", item.value >= 0 ? "text-success" : "text-danger")} />
                  <span className="text-xs text-text-mid">{item.label}</span>
                </div>
                <span className={cn("text-xs font-bold num", item.value >= 0 ? "text-success" : "text-danger")}>
                  {item.value >= 0 ? "+" : ""}{formatUSD(item.value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ===== EARN / LOSE (PnL) =====
function PnLContent({ attribution, portfolio, perpsData }: { attribution?: any; portfolio: any; perpsData?: any }) {
  if (!portfolio) return <p className="text-sm text-text-mid p-4">Loading...</p>;

  const s = portfolio.summary;
  const hasPerps = perpsData && perpsData.positions && perpsData.positions.length > 0;
  const perpsPnl = hasPerps ? perpsData.positions.reduce((sum: number, p: any) => sum + (p.unrealizedPnl || 0), 0) : 0;
  const perpsVolume = hasPerps ? perpsData.positions.reduce((sum: number, p: any) => sum + (p.volume || 0), 0) : 0;

  return (
    <div className="space-y-3 p-3">
      {/* Portfolio PnL Summary */}
      <div className="rounded-xl border border-border bg-surface-raised p-4">
        <p className="text-[10px] text-text-lo uppercase tracking-widest mb-3">Portfolio Summary</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/50 bg-bg/50 p-3">
            <p className="text-[10px] text-text-lo">Total Value</p>
            <p className="text-base font-bold text-text-hi num">{formatUSD(s.totalUsdValue)}</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-bg/50 p-3">
            <p className="text-[10px] text-text-lo">24h Change</p>
            <p className={cn("text-base font-bold num", (s.change24h ?? 0) >= 0 ? "text-success" : "text-danger")}>
              {(s.change24h ?? 0) >= 0 ? "+" : ""}{formatUSD(s.change24h ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-bg/50 p-3">
            <p className="text-[10px] text-text-lo">Wallet</p>
            <p className="text-base font-bold text-text-hi num">{formatUSD(s.walletUsdValue)}</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-bg/50 p-3">
            <p className="text-[10px] text-text-lo">DeFi</p>
            <p className="text-base font-bold text-text-hi num">{formatUSD(s.defiNetUsdValue)}</p>
          </div>
        </div>
      </div>

      {/* Perps PnL */}
      {hasPerps && (
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
          <p className="text-[10px] text-accent uppercase tracking-widest mb-3">Perpetuals</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-accent/10 bg-bg/50 p-3">
              <p className="text-[10px] text-text-lo">Unrealized PnL</p>
              <p className={cn("text-base font-bold num", perpsPnl >= 0 ? "text-success" : "text-danger")}>
                {perpsPnl >= 0 ? "+" : ""}{formatUSD(perpsPnl)}
              </p>
            </div>
            <div className="rounded-lg border border-accent/10 bg-bg/50 p-3">
              <p className="text-[10px] text-text-lo">Volume</p>
              <p className="text-base font-bold text-text-hi num">{formatUSD(perpsVolume)}</p>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {perpsData.positions.slice(0, 4).map((p: any, i: number) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border/30 bg-bg/30 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-text-hi">{p.symbol}</span>
                  <span className="text-[9px] text-text-lo">{p.side}</span>
                </div>
                <span className={cn("text-xs font-bold num", (p.unrealizedPnl || 0) >= 0 ? "text-success" : "text-danger")}>
                  {(p.unrealizedPnl || 0) >= 0 ? "+" : ""}{formatUSD(p.unrealizedPnl || 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasPerps && (
        <div className="rounded-xl border border-border bg-surface-raised p-4 text-center">
          <p className="text-sm text-text-mid">No perpetual positions</p>
          <p className="text-xs text-text-lo mt-1">Perp PnL will appear here when you have open positions</p>
        </div>
      )}

      {/* Change Attribution */}
      {attribution && (
        <div className="rounded-xl border border-border bg-surface-raised p-4">
          <p className="text-[10px] text-text-lo uppercase tracking-widest mb-2">Change This Period</p>
          <div className="flex items-center gap-2 mb-2">
            <span className={cn("text-lg font-bold num", attribution.totalChangeDollars >= 0 ? "text-success" : "text-danger")}>
              {attribution.totalChangeDollars >= 0 ? "+" : ""}{formatUSD(attribution.totalChangeDollars)}
            </span>
            <span className="text-xs text-text-lo">({attribution.totalChangePct.toFixed(2)}%)</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-text-lo">Price movement</span>
              <span className={cn("num", attribution.priceMovement >= 0 ? "text-success" : "text-danger")}>
                {attribution.priceMovement >= 0 ? "+" : ""}{formatUSD(attribution.priceMovement)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-lo">DeFi yield</span>
              <span className={cn("num", attribution.defiYield >= 0 ? "text-success" : "text-danger")}>
                {attribution.defiYield >= 0 ? "+" : ""}{formatUSD(attribution.defiYield)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-lo">Rewards</span>
              <span className={cn("num", attribution.rewards >= 0 ? "text-success" : "text-danger")}>
                {attribution.rewards >= 0 ? "+" : ""}{formatUSD(attribution.rewards)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== WHAT IF =====
function WhatIfContent({ portfolio, selectedGoal, perpsData }: { portfolio: any; selectedGoal: any; perpsData?: any }) {
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!portfolio) {
      setScenarios([]);
      setLoading(true);
      return;
    }
    setLoading(true);
    // Compute scenarios synchronously for live data
    const results = buildAdaptiveScenarioResults(portfolio, selectedGoal, perpsData);
    setScenarios(results || []);
    setLoading(false);
  }, [portfolio, selectedGoal, perpsData]);

  if (loading || scenarios.length === 0) return <p className="text-sm text-text-mid p-4">Analyzing your wallet...</p>;

  return (
    <div className="space-y-3 p-4">
      {scenarios.slice(0, 6).map((scenario: any) => {
        const isPositive = (scenario.estimatedValueDeltaUsd ?? 0) >= 0;
        return (
          <div key={scenario.scenarioId} className="rounded-xl border border-border bg-surface-raised overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-text-hi">{scenario.title}</p>
                  <p className="text-xs text-text-lo mt-0.5 leading-relaxed">{scenario.reasonGenerated}</p>
                </div>
                <div className="flex flex-col items-end flex-shrink-0 ml-3">
                  <span className={cn("text-base font-bold num", isPositive ? "text-success" : "text-danger")}>
                    {isPositive ? "+" : ""}{formatUSD(scenario.estimatedValueDeltaUsd ?? 0)}
                  </span>
                  <span className="text-[10px] text-text-lo">
                    {(scenario.estimatedValueDeltaPct ?? 0) >= 0 ? "+" : ""}{(scenario.estimatedValueDeltaPct ?? 0).toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-border/50 bg-bg/40 p-2.5 mb-2">
                <p className="text-xs text-text-mid leading-relaxed">{scenario.description}</p>
              </div>

              <div className="flex flex-wrap gap-1 mb-2">
                {[
                  `${scenario.riskDelta?.before} → ${scenario.riskDelta?.after}`,
                  ...scenario.bucketDeltas?.slice(0, 3).map((d: any) =>
                    `${d.bucket.replace(/_/g, " ")}: ${(d.deltaPctPoints ?? 0) >= 0 ? "+" : ""}${(d.deltaPctPoints ?? 0).toFixed(1)} pts`
                  ) ?? [],
                ].map((tag, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-border/40 text-text-mid">
                    {tag}
                  </span>
                ))}
              </div>

              {scenario.assumptions?.length > 0 && (
                <div className="rounded-lg border border-border/50 bg-bg/30 p-2">
                  <p className="text-[9px] text-text-lo uppercase tracking-widest mb-1">Assumptions</p>
                  <ul className="space-y-0.5">
                    {scenario.assumptions.slice(0, 2).map((a: string, i: number) => (
                      <li key={i} className="text-xs text-text-mid">· {a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===== BEHAVIOR INSIGHTS =====
function BehaviorContent({
  trackedWallets,
  walletResults,
  activeAddress,
  portfolio,
  perpsData,
  selectedGoal,
}: {
  trackedWallets: any[];
  walletResults: any[];
  activeAddress: string;
  portfolio: any;
  perpsData?: any;
  selectedGoal: any;
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
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <Repeat className="h-6 w-6 text-text-lo animate-pulse" />
        <p className="text-xs text-text-lo">Analyzing patterns across your wallets...</p>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <ShieldCheck className="h-6 w-6 text-success" />
        <p className="text-xs text-text-mid text-center px-4">
          No clear behavior patterns yet. Keep using the app to build up history.
        </p>
        {summary.coverageNote && (
          <p className="text-[10px] text-text-lo">{summary.coverageNote}</p>
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
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-2 mb-1">
        <Repeat className="h-4 w-4 text-accent" />
        <p className="text-xs font-semibold text-text-hi">Patterns Over Time</p>
        <span className="text-[10px] text-text-lo">· {summary.scope === "multi_wallet" ? "Cross-wallet" : "Single wallet"}</span>
      </div>

      {summary.coverageNote && (
        <p className="text-[10px] text-text-lo px-1">{summary.coverageNote}</p>
      )}

      <div className="space-y-2">
        {insights.map((insight: BehaviorInsight) => (
          <div key={insight.id} className="rounded-xl border border-border bg-surface-raised p-3">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-xs font-bold text-text-hi">{insight.title}</p>
                <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded", severityColor(insight.severity))}>
                  {insight.severity}
                </span>
              </div>
              <span className="text-[9px] text-text-lo whitespace-nowrap">{scopeLabel(insight.appliesTo)}</span>
            </div>
            <p className="text-[11px] text-text-mid leading-relaxed">{insight.summary}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[9px] text-text-lo">{insight.frequency}</span>
              {insight.confidence !== "High" && (
                <span className="text-[9px] text-text-lo">· {insight.confidence} confidence</span>
              )}
            </div>
            {insight.recommendation && (
              <p className="text-[10px] text-accent mt-1.5 leading-relaxed">
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
export function InsightsTab() {
  const {
    address,
    portfolio,
    intelligence,
    selectedGoal,
    stressSummary,
    goalFitSummary,
    walletCheckupSummary,
    perpsData,
    attribution,
    trackedWallets,
    walletResults,
  } = usePWAData();

  const [activeFeature, setActiveFeature] = useState<InsightFeature>("assistant");

  if (!portfolio) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-text-mid">Loading insights...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Quick Actions - 2 rows of 4 */}
      <div className="flex-shrink-0 border-b border-border bg-bg px-2 py-2">
        <div className="grid grid-cols-4 gap-1.5">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            const isActive = activeFeature === action.id;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => setActiveFeature(action.id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border py-2 px-1 transition-all min-h-[52px]",
                  isActive
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-border/50 bg-bg/50 text-text-mid hover:border-border"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[10px] font-medium whitespace-nowrap">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content - scrollable */}
      <div className="flex-1 overflow-y-auto">
        {activeFeature === "buckets" && <BucketsContent portfolio={portfolio} />}
        {activeFeature === "risk" && <RiskContent intelligence={intelligence} />}
        {activeFeature === "stress" && <StressContent summary={stressSummary} />}
        {activeFeature === "whatif" && <WhatIfContent portfolio={portfolio} selectedGoal={selectedGoal} perpsData={perpsData} />}
        {activeFeature === "changed" && <ChangedContent attribution={attribution} portfolio={portfolio} />}
        {activeFeature === "airdrop" && (
          <div className="p-3">
            <ActivityScore address={address} portfolio={portfolio} perps={perpsData} />
          </div>
        )}
        {activeFeature === "assistant" && (
          <div className="p-3">
            <AIAssistant portfolio={portfolio} perps={perpsData} intelligence={intelligence ?? undefined} />
          </div>
        )}
        {activeFeature === "pnl" && <PnLContent attribution={attribution} portfolio={portfolio} perpsData={perpsData} />}
        {activeFeature === "behavior" && (
          <BehaviorContent
            trackedWallets={trackedWallets}
            walletResults={walletResults}
            activeAddress={address}
            portfolio={portfolio}
            perpsData={perpsData}
            selectedGoal={selectedGoal}
          />
        )}
      </div>
    </div>
  );
}
