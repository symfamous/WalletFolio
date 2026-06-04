"use client";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { PORTFOLIO_GOALS } from "@/lib/goalFit";
import type { PortfolioGoal, PortfolioGoalFitSummary } from "@/types";

interface GoalModeCardProps {
  selectedGoal: PortfolioGoal;
  summary: PortfolioGoalFitSummary | null;
  onSelectGoal: (goal: PortfolioGoal) => void;
}

function fitBadgeVariant(state: PortfolioGoalFitSummary["overallFitState"]) {
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

function recommendationBadge(priority: "High" | "Medium" | "Low") {
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

function factorTone(fit: "Good" | "Okay" | "Weak") {
  switch (fit) {
    case "Good":
      return "success" as const;
    case "Okay":
      return "warning" as const;
    case "Weak":
    default:
      return "danger" as const;
  }
}

export function GoalModeCard({ selectedGoal, summary, onSelectGoal }: GoalModeCardProps) {
  const goalColumns = [
    PORTFOLIO_GOALS.slice(0, 3),
    PORTFOLIO_GOALS.slice(3),
  ];

  return (
    <Card accent>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-text-hi">Goal Mode</p>
            <p className="mt-1 text-xs text-text-lo">
              Pick the portfolio style you want, then see how well this wallet fits it.
            </p>
          </div>
          {summary ? (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Badge variant="accent">{summary.selectedGoal}</Badge>
              <Badge variant={fitBadgeVariant(summary.overallFitState)}>{summary.overallFitState}</Badge>
              {summary.fitScore !== undefined ? (
                <span className="num text-xs text-text-lo">{summary.fitScore}/100 fit</span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {goalColumns.map((column, index) => (
            <div key={index} className="space-y-2 sm:contents">
              {column.map((goal) => (
                <button
                  key={goal}
                  type="button"
                  onClick={() => onSelectGoal(goal)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left text-[11px] transition-colors sm:w-auto sm:text-xs",
                    selectedGoal === goal
                      ? "border-accent/30 bg-accent/12 text-accent"
                      : "border-border bg-surface-raised text-text-mid hover:border-border-strong hover:text-text-hi"
                  )}
                >
                  {goal}
                </button>
              ))}
            </div>
          ))}
        </div>

        {summary ? (
          <>
            <div className="rounded-xl border border-border bg-surface-raised/25 px-4 py-3">
              <p className="text-[11px] uppercase tracking-widest text-text-lo">Goal Fit Summary</p>
              <p className="mt-2 text-sm text-text-hi">{summary.headline}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <div className="rounded-xl border border-danger/15 bg-danger/5 px-4 py-3">
                <p className="text-[11px] uppercase tracking-widest text-text-lo">Top Mismatch</p>
                <p className="mt-2 text-sm font-medium text-text-hi">{summary.topMismatch.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-text-mid">{summary.topMismatch.explanation}</p>
              </div>
              <div className="rounded-xl border border-success/15 bg-success/5 px-4 py-3">
                <p className="text-[11px] uppercase tracking-widest text-text-lo">Top Aligned Area</p>
                <p className="mt-2 text-sm font-medium text-text-hi">{summary.topAlignedArea.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-text-mid">{summary.topAlignedArea.explanation}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-xl border border-border bg-surface-raised/20 px-4 py-3">
                <p className="text-[11px] uppercase tracking-widest text-text-lo">What To Watch First</p>
                <div className="mt-3 space-y-2">
                  {summary.recommendations.slice(0, 2).map((recommendation) => (
                    <div key={recommendation.id} className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-2">
                      <Badge variant={recommendationBadge(recommendation.priority)} className="w-fit sm:mt-0.5">
                        {recommendation.priority === "High" ? "First" : recommendation.priority === "Medium" ? "Next" : "Keep In Mind"}
                      </Badge>
                      <p className="text-sm text-text-mid">{recommendation.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface-raised/20 px-4 py-3">
                <p className="text-[11px] uppercase tracking-widest text-text-lo">Fit Breakdown</p>
                <div className="mt-3 space-y-2">
                  {summary.factorBreakdown.slice(0, 4).map((factor) => (
                    <div key={factor.id} className="flex items-start justify-between gap-3">
                      <p className="text-sm text-text-hi">{factor.label}</p>
                      <Badge variant={factorTone(factor.fit)}>{factor.fit}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Card>
  );
}
