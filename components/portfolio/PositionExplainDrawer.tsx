"use client";

import { useEffect } from "react";
import { AlertTriangle, Info, Shield, Wallet, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn, formatPct, formatUSD } from "@/lib/utils";
import type { PositionExplanation } from "@/types";

interface PositionExplainDrawerProps {
  open: boolean;
  explanation: PositionExplanation | null;
  onClose: () => void;
}

interface PositionExplainButtonProps {
  onClick: () => void;
  className?: string;
  label?: string;
}

function getRiskClasses(level: PositionExplanation["riskLevel"]) {
  switch (level) {
    case "Low":
      return {
        badge: "success" as const,
        icon: Shield,
        card: "border-success/20 bg-success/5",
      };
    case "High":
      return {
        badge: "danger" as const,
        icon: AlertTriangle,
        card: "border-danger/20 bg-danger/5",
      };
    case "Medium":
    default:
      return {
        badge: "warning" as const,
        icon: Info,
        card: "border-warning/20 bg-warning/5",
      };
  }
}

function getExitClasses(level: PositionExplanation["exitDifficulty"]) {
  switch (level) {
    case "Easy":
      return "success";
    case "Locked":
      return "danger";
    case "Hard":
      return "warning";
    case "Moderate":
    default:
      return "default";
  }
}

export function PositionExplainButton({
  onClick,
  className,
  label = "Explain this position",
}: PositionExplainButtonProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-lg border border-accent/10 bg-text-hi/[0.03] text-text-lo transition-colors hover:border-accent/30 hover:text-accent",
        className
      )}
    >
      <Info className="h-3.5 w-3.5" strokeWidth={1.7} />
    </button>
  );
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

export function PositionExplainDrawer({
  open,
  explanation,
  onClose,
}: PositionExplainDrawerProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || !explanation) return null;

  const risk = getRiskClasses(explanation.riskLevel);
  const RiskIcon = risk.icon;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close explanation drawer"
        className="absolute inset-0 bg-bg/80 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div className="absolute inset-x-0 bottom-0 flex max-h-[90vh] w-full flex-col items-end justify-end sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:items-stretch sm:justify-end sm:w-auto">
        <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-accent/14 bg-[linear-gradient(180deg,rgb(var(--surface)/0.98),rgb(var(--bg)/0.98))] shadow-[0_0_50px_rgba(0,0,0,0.7)] sm:h-full sm:rounded-none sm:border-b-0 sm:border-l sm:border-r-0 sm:border-t-0">
          <div className="flex-shrink-0 flex items-start justify-between gap-3 border-b border-accent/10 bg-surface/90 px-4 py-3 sm:px-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-semibold text-text-hi">{explanation.title}</p>
                {explanation.subtitle ? <Badge>{explanation.subtitle}</Badge> : null}
                <Badge variant={risk.badge}>{explanation.riskLevel} risk</Badge>
              </div>
              {explanation.badges.length > 0 ? (
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  {explanation.badges.map((badge) => (
                    <Badge key={badge}>{badge}</Badge>
                  ))}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-accent/10 bg-text-hi/[0.03] text-text-lo transition-colors hover:border-accent/30 hover:text-accent"
              aria-label="Close explanation drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 overscroll-y-contain sm:px-6" style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}>
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-text-mid">{explanation.quickSummary}</p>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-accent/8 bg-text-hi/[0.03] px-4 py-3 sm:col-span-3">
                  <p className="text-[11px] font-medium uppercase tracking-widest text-text-lo">Bucket</p>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <Badge variant="accent">{explanation.bucketLabel}</Badge>
                    <p className="text-sm text-text-mid">{explanation.bucketReason}</p>
                  </div>
                </div>

                <div className={cn("rounded-xl border px-4 py-3", risk.card)}>
                  <p className="text-[11px] font-medium uppercase tracking-widest text-text-lo">Risk</p>
                  <div className="mt-1 flex items-center gap-2">
                    <RiskIcon className="h-4 w-4" />
                    <Badge variant={risk.badge}>{explanation.riskLevel}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-text-mid">{explanation.riskReason}</p>
                </div>

                <div className="rounded-xl border border-accent/8 bg-text-hi/[0.03] px-4 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-widest text-text-lo"> Exit</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-accent" />
                    <Badge variant={getExitClasses(explanation.exitDifficulty)}>{explanation.exitDifficulty}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-text-mid">{explanation.exitReason}</p>
                </div>

                <div className="rounded-xl border border-warning/20 bg-warning/5 px-4 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-widest text-text-lo">Warning</p>
                  <p className="mt-2 text-sm text-text-hi">{explanation.beginnerWarning}</p>
                </div>
              </div>
            </div>

            <Section title="How It Makes Money">
              <div className="space-y-1.5">
                {explanation.makesMoney.map((line) => (
                  <p key={line} className="text-sm text-text-mid">
                    {line}
                  </p>
                ))}
              </div>
            </Section>

            <Section title="How It Can Lose Money">
              <div className="space-y-1.5">
                {explanation.losesMoney.map((line) => (
                  <p key={line} className="text-sm text-text-mid">
                    {line}
                  </p>
                ))}
              </div>
            </Section>

            {explanation.metadata ? (
              <Section title="Details">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {explanation.metadata.valueUsd !== undefined ? (
                    <div className="rounded-lg border border-border bg-surface-raised/20 px-3 py-2.5">
                      <p className="text-[11px] text-text-lo">Current value</p>
                      <p className="num mt-1 text-sm font-medium text-text-hi">{formatUSD(explanation.metadata.valueUsd)}</p>
                    </div>
                  ) : null}
                  {explanation.metadata.change24hPct !== undefined ? (
                    <div className="rounded-lg border border-border bg-surface-raised/20 px-3 py-2.5">
                      <p className="text-[11px] text-text-lo">24h change</p>
                      <p className="num mt-1 text-sm font-medium text-text-hi">
                        {formatPct(explanation.metadata.change24hPct)}
                      </p>
                    </div>
                  ) : null}
                  {explanation.metadata.chain ? (
                    <div className="rounded-lg border border-border bg-surface-raised/20 px-3 py-2.5">
                      <p className="text-[11px] text-text-lo">Chain</p>
                      <p className="mt-1 text-sm font-medium text-text-hi">{explanation.metadata.chain}</p>
                    </div>
                  ) : null}
                  {explanation.metadata.protocol ? (
                    <div className="rounded-lg border border-border bg-surface-raised/20 px-3 py-2.5">
                      <p className="text-[11px] text-text-lo">Protocol</p>
                      <p className="mt-1 text-sm font-medium text-text-hi">{explanation.metadata.protocol}</p>
                    </div>
                  ) : null}
                  {explanation.metadata.leverage ? (
                    <div className="rounded-lg border border-border bg-surface-raised/20 px-3 py-2.5">
                      <p className="text-[11px] text-text-lo">Leverage</p>
                      <p className="mt-1 text-sm font-medium text-text-hi">{explanation.metadata.leverage}</p>
                    </div>
                  ) : null}
                  {explanation.metadata.sourceType ? (
                    <div className="rounded-lg border border-border bg-surface-raised/20 px-3 py-2.5">
                      <p className="text-[11px] text-text-lo">Source</p>
                      <p className="mt-1 text-sm font-medium text-text-hi">{explanation.metadata.sourceType}</p>
                    </div>
                  ) : null}
                </div>
              </Section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
