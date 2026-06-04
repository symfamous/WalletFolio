"use client";

import { useEffect } from "react";
import { AlertTriangle, ShieldCheck, Wallet, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn, formatUSD } from "@/lib/utils";
import { getRiskStatePresentation } from "@/lib/riskMonitor";
import type { PortfolioStressSummary } from "@/types";

interface StressViewDrawerProps {
  open: boolean;
  summary: PortfolioStressSummary | null;
  onClose: () => void;
}

function priorityBadge(priority: "High" | "Medium" | "Low") {
  switch (priority) {
    case "High":
      return "danger" as const;
    case "Medium":
      return "warning" as const;
    case "Low":
    default:
      return "default" as const;
  }
}

function exitBadge(exitDifficulty: "Easy" | "Moderate" | "Hard" | "Locked") {
  switch (exitDifficulty) {
    case "Easy":
      return "success" as const;
    case "Locked":
      return "danger" as const;
    case "Hard":
      return "warning" as const;
    case "Moderate":
    default:
      return "default" as const;
  }
}

function sectionToneClass(kind: "liquid" | "sell" | "limited") {
  return kind === "liquid"
    ? "border-success/20 bg-success/5"
    : kind === "sell"
    ? "border-accent/20 bg-accent/5"
    : "border-warning/20 bg-warning/5";
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-widest text-text-lo">{title}</p>
      {children}
    </section>
  );
}

export function StressViewDrawer({ open, summary, onClose }: StressViewDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || !summary) return null;

  const risk = getRiskStatePresentation(summary.overallState);
  const RiskIcon = risk.icon;
  const headlineReason = summary.headline.replace(`${summary.overallState} — `, "");

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close stress view"
        onClick={onClose}
        className="absolute inset-0 bg-bg/80 backdrop-blur-[1px]"
      />

      <div className="absolute inset-x-0 bottom-0 flex max-h-[94dvh] w-full items-end justify-center sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:items-stretch sm:justify-end">
        <div className="flex w-full max-w-3xl flex-col rounded-t-[28px] border border-accent/14 bg-[linear-gradient(180deg,rgb(var(--surface)/0.98),rgb(var(--bg)/0.98))] shadow-[0_0_50px_rgba(0,0,0,0.7)] sm:h-full sm:rounded-none sm:border-b-0 sm:border-l sm:border-r-0 sm:border-t-0">
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-accent/10 bg-surface/90 px-4 py-4 backdrop-blur-xl sm:px-6">
            <div className="min-w-0">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-text-hi/10 sm:hidden" />
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-lg font-semibold text-text-hi">Stress View</p>
                <Badge variant={risk.badgeVariant}>{risk.label}</Badge>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-text-mid">{headlineReason}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-accent/10 bg-text-hi/[0.03] text-text-lo transition-colors hover:border-accent/30 hover:text-accent"
              aria-label="Close stress view"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6"
            style={{ paddingBottom: "calc(28px + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-4">
                <Section title="Overall Portfolio Status">
                  <Card className={cn("border", summary.overallState === "Safe" ? "border-success/20" : summary.overallState === "Critical" ? "border-danger/20" : "border-warning/20")}>
                    <div className="flex items-start gap-3">
                      <RiskIcon className={cn("mt-0.5 h-5 w-5 flex-shrink-0", risk.textClassName)} />
                      <div>
                        <p className={cn("text-base font-semibold", risk.textClassName)}>{risk.label}</p>
                        <p className="mt-1 text-sm text-text-mid">{headlineReason}</p>
                      </div>
                    </div>
                  </Card>
                </Section>

                <Section title="Biggest Danger Right Now">
                  <Card>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-hi">{summary.biggestDanger.label}</p>
                        <p className="mt-1 text-sm leading-relaxed text-text-mid">{summary.biggestDanger.explanation}</p>
                      </div>
                      <Badge variant={summary.overallState === "Critical" ? "danger" : "warning"}>
                        {summary.biggestDanger.type === "protocol" ? "Protocol" :
                          summary.biggestDanger.type === "locked" ? "Locked" :
                          summary.biggestDanger.type === "liquidity" ? "Liquidity" :
                          summary.biggestDanger.type === "concentration" ? "Concentration" :
                          summary.biggestDanger.type === "leverage" ? "Leverage" :
                          "Risk"}
                      </Badge>
                    </div>
                  </Card>
                </Section>
              </div>

              <div className="space-y-4">
                <Section title="What I Can Access Quickly">
                  <Card className={cn("border", sectionToneClass("liquid"))}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-text-hi">Defensive cash</p>
                        <p className="mt-1 text-xs text-text-lo">Stable balances you can usually use right away.</p>
                      </div>
                      <p className="num text-sm text-success">
                        {summary.defensiveCash.totalUsd !== undefined ? formatUSD(summary.defensiveCash.totalUsd) : "—"}
                      </p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {summary.defensiveCash.topItems.length > 0 ? summary.defensiveCash.topItems.slice(0, 3).map((item) => (
                        <div key={`${item.label}-${item.reason}`} className="rounded-lg border border-success/15 bg-surface-raised/20 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm text-text-hi">{item.label}</p>
                            <span className="num text-xs text-text-mid">{item.valueUsd !== undefined ? formatUSD(item.valueUsd) : "—"}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <p className="text-xs text-text-lo">{item.reason}</p>
                            <Badge variant={exitBadge(item.exitDifficulty)}>{item.exitDifficulty}</Badge>
                          </div>
                        </div>
                      )) : (
                        <p className="text-sm text-text-mid">No clearly defensive cash stands out right now.</p>
                      )}
                    </div>
                  </Card>
                </Section>

                <Section title="Quick To Sell">
                  <Card className={cn("border", sectionToneClass("sell"))}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-text-hi">Sellable wallet assets</p>
                        <p className="mt-1 text-xs text-text-lo">Easy to sell, but still exposed to price swings.</p>
                      </div>
                      <p className="num text-sm text-accent">
                        {summary.quickToSell.totalUsd !== undefined ? formatUSD(summary.quickToSell.totalUsd) : "—"}
                      </p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {summary.quickToSell.topItems.length > 0 ? summary.quickToSell.topItems.slice(0, 3).map((item) => (
                        <div key={`${item.label}-${item.reason}`} className="rounded-lg border border-accent/15 bg-surface-raised/20 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm text-text-hi">{item.label}</p>
                            <span className="num text-xs text-text-mid">{item.valueUsd !== undefined ? formatUSD(item.valueUsd) : "—"}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <p className="text-xs text-text-lo">{item.reason}</p>
                            <Badge variant={exitBadge(item.exitDifficulty)}>{item.exitDifficulty}</Badge>
                          </div>
                        </div>
                      )) : (
                        <p className="text-sm text-text-mid">No major wallet assets stand out as quick exits.</p>
                      )}
                    </div>
                  </Card>
                </Section>

                <Section title="What May Take Extra Steps">
                  <Card className={cn("border", sectionToneClass("limited"))}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-text-hi">Slower to access</p>
                        <p className="mt-1 text-xs text-text-lo">May need a withdrawal, unlock, bridge, or another step.</p>
                      </div>
                      <p className="num text-sm text-warning">
                        {summary.limitedAccess.totalLimitedUsd !== undefined ? formatUSD(summary.limitedAccess.totalLimitedUsd) : "—"}
                      </p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {summary.limitedAccess.topItems.length > 0 ? summary.limitedAccess.topItems.slice(0, 3).map((item) => (
                        <div key={`${item.label}-${item.reason}`} className="rounded-lg border border-warning/15 bg-surface-raised/20 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm text-text-hi">{item.label}</p>
                            <span className="num text-xs text-text-mid">{item.valueUsd !== undefined ? formatUSD(item.valueUsd) : "—"}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <p className="text-xs text-text-lo">{item.reason}</p>
                            <Badge variant={exitBadge(item.exitDifficulty)}>{item.exitDifficulty}</Badge>
                          </div>
                        </div>
                      )) : (
                        <p className="text-sm text-text-mid">No major slower-money balances stand out right now.</p>
                      )}
                    </div>
                  </Card>
                </Section>
              </div>
            </div>

            <Section title="Urgent Actions">
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                {summary.urgentActions.map((action) => (
                  <Card key={action.id} className="py-3">
                    <div className="flex items-start gap-2">
                      {action.priority === "High" ? (
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />
                      ) : action.priority === "Low" ? (
                        <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                      ) : (
                        <Wallet className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
                      )}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm text-text-hi">{action.text}</p>
                          <Badge variant={priorityBadge(action.priority)}>{action.priority === "High" ? "First" : action.priority === "Medium" ? "Next" : "Keep in Mind"}</Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Section>

            {summary.stressFactors.length > 0 ? (
              <Section title="Stress Breakdown">
                <div className="space-y-2">
                  {summary.stressFactors.map((factor) => (
                    <Card key={factor.id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-hi">{factor.label}</p>
                          <p className="mt-1 text-xs text-text-lo">{factor.explanation}</p>
                        </div>
                        <Badge variant={factor.state === "Critical" ? "danger" : factor.state === "Safe" ? "success" : "warning"}>
                          {factor.state}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              </Section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
