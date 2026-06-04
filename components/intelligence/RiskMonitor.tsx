"use client";

import {
  ShieldAlert, AlertTriangle, Info,
  Layers, Building2, Coins, ArrowDownLeft, Activity,
  Bot, Calculator, History, LayoutDashboard, TrendingUp, User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { getRiskStatePresentation } from "@/lib/riskMonitor";
import type { Portfolio, PortfolioIntelligence, PerpsApiResponse, UnifiedRiskFactor } from "@/types";

interface RiskMonitorProps {
  portfolio: Portfolio;
  intelligence: PortfolioIntelligence;
  perps?: PerpsApiResponse | null;
}

function severityColor(s: UnifiedRiskFactor["state"]): string {
  return {
    Safe:     "text-success",
    Watch:    "text-warning",
    Risky:    "text-warning",
    Critical: "text-danger",
  }[s];
}

function severityBg(s: UnifiedRiskFactor["state"]): string {
  return {
    Safe:     "border-success/20 bg-success/5",
    Watch:    "border-warning/20 bg-warning/5",
    Risky:    "border-warning/20 bg-warning/5",
    Critical: "border-danger/20 bg-danger/5",
  }[s];
}

function severityBarColor(s: UnifiedRiskFactor["state"]): string {
  return {
    Safe:     "rgb(var(--success))",
    Watch:    "rgb(var(--warning))",
    Risky:    "rgb(var(--warning))",
    Critical: "rgb(var(--danger))",
  }[s];
}

function factorIcon(id: UnifiedRiskFactor["id"]): LucideIcon {
  switch (id) {
    case "chain_concentration":
      return Layers;
    case "protocol_concentration":
      return Building2;
    case "top_holding":
    case "stablecoin_ratio":
      return Coins;
    case "borrow_exposure":
      return ArrowDownLeft;
    case "perp_leverage":
      return Activity;
    case "liquidation_risk":
    default:
      return AlertTriangle;
  }
}

export function RiskMonitor({ portfolio, intelligence, perps }: RiskMonitorProps) {
  const riskState = intelligence.risk.overallState;
  const overall = getRiskStatePresentation(riskState);
  const OIcon = overall.icon;
  const displayedFactors = intelligence.risk.rankedFactors.length > 0
    ? intelligence.risk.rankedFactors
    : [...intelligence.risk.triggeredFactors, ...intelligence.risk.safeFactors];

  return (
    <div className="animate-fade-in">
      <Card noPadding className="overflow-hidden">
        {/* Overall banner */}
        <div className={cn(
          "flex items-center gap-3 border-b border-accent/10 p-4",
          riskState === "Safe" ? "bg-success/3" : riskState === "Critical" ? "bg-danger/3" : "bg-warning/3"
        )}>
          <OIcon className={cn("h-8 w-8 flex-shrink-0", overall.textClassName)} />
          <div>
            <p className={cn("text-base font-semibold", overall.textClassName)}>{overall.label}</p>
            <p className="text-xs text-text-mid">{intelligence.risk.topReason}</p>
            {intelligence.risk.secondaryReasons.length > 0 && (
              <p className="text-xs text-text-lo mt-0.5">
                {intelligence.risk.secondaryReasons.slice(0, 2).join(" · ")}
              </p>
            )}
          </div>
        </div>

        {/* Dimensions */}
        <div className="divide-y divide-accent/8">
          {displayedFactors.map((factor) => {
            const DIcon = factorIcon(factor.id);
            return (
              <div key={factor.id} className={cn("px-4 py-3", severityBg(factor.state), "transition-colors hover:bg-text-hi/[0.02]")}>
                <div className="flex items-start gap-3">
                  <DIcon className={cn("h-4 w-4 flex-shrink-0 mt-0.5", severityColor(factor.state))} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-xs font-medium text-text-hi">{factor.label}</p>
                      <span className={cn("num text-xs font-semibold flex-shrink-0", severityColor(factor.state))}>
                        {factor.displayValue ?? factor.state}
                      </span>
                    </div>
                    {factor.progressPct !== undefined && factor.progressPct > 0 && (
                      <div className="h-1.5 rounded-full bg-surface-overlay overflow-hidden mb-1.5">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(factor.progressPct, 100)}%`,
                            backgroundColor: severityBarColor(factor.state),
                            opacity: 0.75,
                          }}
                        />
                      </div>
                    )}
                    <p className="text-xs text-text-mid">{factor.explanation}</p>
                    {factor.recommendation && (
                      <p className="text-[10px] text-text-lo mt-0.5">→ {factor.recommendation}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
