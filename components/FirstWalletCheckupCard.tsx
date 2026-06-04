"use client";

import { RefreshCw, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { WalletCheckupSummary } from "@/types";

interface FirstWalletCheckupCardProps {
  summary: WalletCheckupSummary | null;
  compact?: boolean;
  onRunAgain: () => void;
  onDismiss?: () => void;
}

function fitVariant(state: WalletCheckupSummary["goalFit"]["fitState"]) {
  switch (state) {
    case "Strong Fit":
      return "success" as const;
    case "Mostly Fits":
      return "accent" as const;
    case "Mixed":
      return "warning" as const;
    case "Poor Fit":
    default:
      return "danger" as const;
  }
}

function complexityVariant(level: WalletCheckupSummary["complexity"]["level"]) {
  switch (level) {
    case "Low":
      return "success" as const;
    case "Medium":
      return "warning" as const;
    case "High":
    default:
      return "danger" as const;
  }
}

function priorityVariant(priority: "First" | "Next" | "Keep in Mind") {
  switch (priority) {
    case "First":
      return "danger" as const;
    case "Next":
      return "warning" as const;
    case "Keep in Mind":
    default:
      return "default" as const;
  }
}

export function FirstWalletCheckupCard({
  summary,
  compact = false,
  onRunAgain,
  onDismiss,
}: FirstWalletCheckupCardProps) {
  if (!summary) return null;

  if (compact) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 bg-card-shine sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-text-hi">First Wallet Checkup</p>
          <p className="mt-1 text-xs text-text-lo">Run the beginner checkup again for a fresh read of this wallet.</p>
        </div>
        <button
          type="button"
          onClick={onRunAgain}
          className="inline-flex items-center gap-2 rounded-lg border border-accent/25 bg-accent/10 px-3 py-2 text-sm text-accent transition-colors hover:bg-accent/15"
        >
          <RefreshCw className="h-4 w-4" />
          Run Again
        </button>
      </div>
    );
  }

  return (
    <Card accent>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <p className="text-sm font-semibold text-text-hi">First Wallet Checkup</p>
            </div>
            <p className="mt-1 text-xs text-text-lo">A quick read of what this wallet looks like and what matters first.</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={onRunAgain}
              className="inline-flex items-center gap-1 rounded-lg border border-accent/20 bg-accent/8 px-2.5 py-1.5 text-xs text-accent transition-colors hover:bg-accent/12"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Run Again
            </button>
            {onDismiss ? (
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-raised text-text-lo transition-colors hover:border-border-strong hover:text-text-hi"
                aria-label="Dismiss wallet checkup"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-raised/20 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">Style: {summary.walletStyle.label}</Badge>
            <Badge variant={fitVariant(summary.goalFit.fitState)}>Fit: {summary.goalFit.fitState}</Badge>
            <Badge variant={complexityVariant(summary.complexity.level)}>Complexity: {summary.complexity.level}</Badge>
          </div>
          <p className="mt-3 text-sm text-text-hi">{summary.walletStyle.explanation}</p>
          <p className="mt-1 text-xs text-text-mid">{summary.goalFit.goal} goal: {summary.goalFit.explanation}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-danger/15 bg-danger/5 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-text-lo">Biggest Risk</p>
            <p className="mt-2 text-sm font-medium text-text-hi">{summary.biggestRisk.label}</p>
            <p className="mt-1 text-xs text-text-mid">{summary.biggestRisk.explanation}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface-raised/20 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-text-lo">Dominant Area</p>
            <p className="mt-2 text-sm font-medium text-text-hi">{summary.dominantArea.label}</p>
            <p className="mt-1 text-xs text-text-mid">{summary.dominantArea.explanation}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface-raised/20 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-text-lo">Goal Fit</p>
            <p className="mt-2 text-sm font-medium text-text-hi">{summary.goalFit.fitState}</p>
            <p className="mt-1 text-xs text-text-mid">{summary.goalFit.explanation}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-raised/20 px-4 py-3">
          <p className="text-[11px] uppercase tracking-widest text-text-lo">First Things To Understand</p>
          <div className="mt-3 space-y-2">
            {summary.firstThingsToUnderstand.slice(0, 3).map((item) => (
              <div key={item.id} className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-2">
                <Badge variant={priorityVariant(item.priority)} className="w-fit sm:mt-0.5">{item.priority}</Badge>
                <p className="text-sm text-text-mid">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {summary.dataConfidence && summary.dataConfidence.level !== "High" ? (
          <div className="rounded-xl border border-border bg-surface-raised/15 px-4 py-3">
            <div className="flex items-center gap-2">
              <Badge variant={summary.dataConfidence.level === "Medium" ? "warning" : "danger"}>
                {summary.dataConfidence.level}
              </Badge>
              <p className="text-xs text-text-mid">{summary.dataConfidence.explanation}</p>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
