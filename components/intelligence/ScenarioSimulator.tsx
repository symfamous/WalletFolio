"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { buildAdaptiveScenarioResults } from "@/lib/scenarioSimulator";
import { cn, formatUSD } from "@/lib/utils";
import type {
  PerpsApiResponse,
  Portfolio,
  PortfolioGoal,
  PortfolioScenarioId,
  SupportedCurrency,
} from "@/types";

interface Props {
  portfolio: Portfolio;
  selectedGoal?: PortfolioGoal;
  perps?: PerpsApiResponse | null;
  format: (usd: number) => string;
  currency: SupportedCurrency;
  compact?: boolean;
}

function DeltaLabel({ value }: { value?: number }) {
  const nextValue = value ?? 0;
  const tone = nextValue > 0 ? "text-success" : nextValue < 0 ? "text-danger" : "text-text-hi";
  const sign = nextValue > 0 ? "+" : "";

  return (
    <span className={cn("num text-sm font-semibold", tone)}>
      {sign}{formatUSD(nextValue)}
    </span>
  );
}

export function ScenarioSimulator({
  portfolio,
  selectedGoal,
  perps,
  format,
  currency,
  compact = false,
}: Props) {
  const scenarios = useMemo(
    () => buildAdaptiveScenarioResults(portfolio, selectedGoal, perps),
    [portfolio, selectedGoal, perps]
  );
  const [activeScenarioId, setActiveScenarioId] = useState<PortfolioScenarioId>(scenarios[0]?.scenarioId ?? "scenario");

  useEffect(() => {
    if (!scenarios.length) return;
    if (!scenarios.some((scenario) => scenario.scenarioId === activeScenarioId)) {
      setActiveScenarioId(scenarios[0].scenarioId);
    }
  }, [scenarios, activeScenarioId]);

  const simulation = scenarios.find((scenario) => scenario.scenarioId === activeScenarioId) ?? scenarios[0];

  const showLocal = currency !== "USD";
  const visibleBucketDeltas = simulation
    ? (compact ? simulation.bucketDeltas.slice(0, 2) : simulation.bucketDeltas)
    : [];
  const visibleAssumptions = simulation
    ? (compact ? simulation.assumptions.slice(0, 2) : simulation.assumptions)
    : [];

  if (!simulation) return null;

  return (
    <Card noPadding className="overflow-hidden animate-fade-up">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-accent/25 bg-accent/10">
          <ArrowRightLeft className="h-4 w-4 text-accent" strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-text-hi">What If</h3>
          <p className="text-xs text-text-lo">Directional estimate from your current portfolio.</p>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {scenarios.map((scenario) => {
            const active = scenario.scenarioId === activeScenarioId;
            return (
              <button
                key={scenario.scenarioId}
                type="button"
                onClick={() => setActiveScenarioId(scenario.scenarioId)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition-colors",
                  active
                    ? "border-accent/30 bg-accent/10 text-text-hi"
                    : "border-border bg-surface-raised text-text-mid hover:border-border-strong hover:text-text-hi"
                )}
              >
                <p className={cn("text-xs font-semibold", active && "text-accent")}>{scenario.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-text-lo">{scenario.reasonGenerated}</p>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-border bg-surface-raised p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-hi">{simulation.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-text-lo">{compact ? "Based on your current wallet." : simulation.description}</p>
              <p className="mt-1 text-[11px] text-accent">{simulation.reasonGenerated}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/8 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-accent">
              <Sparkles className="h-3 w-3" />
              Directional only
            </span>
          </div>

          <div className="mt-4 rounded-lg border border-accent/15 bg-accent/6 p-3">
            <p className="text-[11px] uppercase tracking-widest text-accent">Main takeaway</p>
            <p className="mt-1 text-sm text-text-hi">{simulation.takeaway}</p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-bg/40 p-3">
              <p className="text-[11px] uppercase tracking-widest text-text-lo">Value impact</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <DeltaLabel value={simulation.estimatedValueDeltaUsd} />
                <span className="num text-xs text-text-mid">
                  {(simulation.estimatedValueDeltaPct ?? 0) > 0 ? "+" : ""}
                  {(simulation.estimatedValueDeltaPct ?? 0).toFixed(1)}%
                </span>
              </div>
              {showLocal ? (
                <p className="num mt-1 text-[11px] text-text-lo">
                  {(simulation.estimatedValueDeltaUsd ?? 0) > 0 ? "+" : ""}
                  {format(simulation.estimatedValueDeltaUsd ?? 0)}
                </p>
              ) : null}
            </div>

            <div className="rounded-lg border border-border bg-bg/40 p-3">
              <p className="text-[11px] uppercase tracking-widest text-text-lo">Risk</p>
              <p className="mt-1 text-sm font-semibold text-text-hi">
                {simulation.riskDelta.before} → {simulation.riskDelta.after}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-text-lo">{simulation.riskDelta.summary}</p>
            </div>

            {simulation.goalFitDelta ? (
              <div className="rounded-lg border border-border bg-bg/40 p-3">
                <p className="text-[11px] uppercase tracking-widest text-text-lo">Goal fit</p>
                <p className="mt-1 text-sm font-semibold text-text-hi">
                  {simulation.goalFitDelta.before} → {simulation.goalFitDelta.after}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-text-lo">{simulation.goalFitDelta.summary}</p>
              </div>
            ) : null}

            {simulation.liquidityDelta ? (
              <div className="rounded-lg border border-border bg-bg/40 p-3">
                <p className="text-[11px] uppercase tracking-widest text-text-lo">Liquidity</p>
                <p className="mt-1 text-sm font-semibold text-text-hi">
                  {(simulation.liquidityDelta.defensiveCashDeltaUsd ?? 0) > 0 ? "More defensive cash" :
                    (simulation.liquidityDelta.slowerAccessDeltaUsd ?? 0) < 0 ? "Easier access" :
                    "Small shift"}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-text-lo">{simulation.liquidityDelta.summary}</p>
              </div>
            ) : null}
          </div>

          {visibleBucketDeltas.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-[11px] uppercase tracking-widest text-text-lo">Bucket changes</p>
              <div className="space-y-2">
                {visibleBucketDeltas.map((bucket) => (
                  <div key={bucket.bucket} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg/30 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-text-hi">{bucket.bucket}</p>
                      <p className="num text-[11px] text-text-lo">
                        {(bucket.deltaPctPoints ?? 0) > 0 ? "+" : ""}
                        {(bucket.deltaPctPoints ?? 0).toFixed(1)} pts
                      </p>
                    </div>
                    <DeltaLabel value={bucket.deltaUsd} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 space-y-2">
            <p className="text-[11px] uppercase tracking-widest text-text-lo">Assumes</p>
            <ul className="space-y-1.5 text-[11px] leading-relaxed text-text-lo">
              {visibleAssumptions.map((assumption) => (
                <li key={assumption} className="flex gap-2">
                  <span className="text-accent">·</span>
                  <span>{assumption}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}
