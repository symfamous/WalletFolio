"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Building2,
  Coins,
  Lock,
  PiggyBank,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { formatUSD } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { buildPortfolioBuckets } from "@/lib/portfolioBuckets";
import { buildItemExplanation } from "@/lib/positionExplainer";
import { PositionExplainDrawer } from "@/components/portfolio/PositionExplainDrawer";
import type {
  Portfolio,
  PortfolioBucketId,
  PositionExplanation,
  PortfolioBucketSummary,
} from "@/types";

interface PortfolioBucketsProps {
  portfolio: Portfolio;
  previewOnly?: boolean;
}

const BUCKET_ICONS: Record<PortfolioBucketId, LucideIcon> = {
  safe_cash: PiggyBank,
  long_term_holds: Coins,
  active_trades: Activity,
  defi_earn: Building2,
  locked_funds: Lock,
  forgotten_dust: Sparkles,
};

function formatBucketPercentage(value: number): string {
  if (value <= 0) return "0%";
  if (value < 0.1) return "<0.1%";
  if (value >= 10) return `${value.toFixed(0)}%`;
  return `${value.toFixed(1)}%`;
}

function getBucketCountLabel(bucket: PortfolioBucketSummary): string | null {
  if (bucket.itemCount <= 0) return null;
  if (bucket.bucketId === "forgotten_dust") {
    return bucket.itemCount === 1 ? "1 small balance" : `${bucket.itemCount} small balances`;
  }
  return bucket.itemCount === 1 ? "1 asset" : `${bucket.itemCount} assets`;
}

function BucketCard({
  bucket,
  selected,
  onSelect,
  previewOnly = false,
}: {
  bucket: PortfolioBucketSummary;
  selected: boolean;
  onSelect: () => void;
  previewOnly?: boolean;
}) {
  const Icon = BUCKET_ICONS[bucket.bucketId];
  const countLabel = getBucketCountLabel(bucket);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="text-left"
      aria-pressed={selected}
    >
      <Card
        hoverable
        className={
          selected
            ? "border-accent/40 bg-accent/5"
            : "border-border bg-surface"
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-lo">
              {bucket.label}
            </p>
            <p className="num mt-2 text-[20px] font-semibold text-text-hi">
              {formatUSD(bucket.totalUsdValue)}
            </p>
          </div>
          {!previewOnly ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-accent/16 bg-accent/8">
              <Icon className="h-4 w-4 text-accent" strokeWidth={1.6} />
            </div>
          ) : (
            <span className="num text-[11px] font-medium text-accent">{formatBucketPercentage(bucket.percentage)}</span>
          )}
        </div>

        {!previewOnly ? (
          <p className="mt-3 text-xs leading-relaxed text-text-lo">{bucket.description}</p>
        ) : null}

        <div className={previewOnly ? "mt-4 flex items-center justify-between border-t border-[rgb(var(--accent)/0.15)] pt-2.5 text-[11px]" : "mt-4 flex items-center justify-between border-t border-[rgb(var(--accent)/0.2)] pt-3 text-xs"}>
          <span className="text-text-lo">{countLabel ?? "No assets"}</span>
          {!previewOnly ? <span className="num font-medium text-accent">{formatBucketPercentage(bucket.percentage)}</span> : null}
        </div>
        <div className={previewOnly ? "mt-3 h-px overflow-hidden rounded-full bg-text-hi/[0.035]" : "mt-3 h-px overflow-hidden rounded-full bg-text-hi/[0.04]"}>
          <div
            className={`h-full ${selected ? "bg-accent" : "bg-accent/35"}`}
            style={{ width: `${Math.min(bucket.percentage, 100)}%` }}
          />
        </div>
      </Card>
    </button>
  );
}

function BucketDrilldown({
  bucket,
  onExplain,
}: {
  bucket: PortfolioBucketSummary;
  onExplain: (explanation: PositionExplanation) => void;
}) {
  const topItems = bucket.items.slice(0, 8);

  return (
    <Card noPadding className="overflow-hidden">
      <div className="border-b border-[rgb(var(--accent)/0.2)] bg-surface/72 px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-text-hi">{bucket.label}</p>
            <p className="mt-1 text-xs text-text-lo">{bucket.description}</p>
          </div>
          <div className="text-right">
            <p className="num text-sm font-semibold text-text-hi">{formatUSD(bucket.totalUsdValue)}</p>
            <p className="num text-[11px] text-accent">{formatBucketPercentage(bucket.percentage)} of tracked value</p>
          </div>
        </div>
      </div>

      {topItems.length > 0 ? (
        <div className="divide-y divide-accent/[0.08]">
          {topItems.map((item, idx) => (
            <button
              key={`${item.id}-${idx}`}
              type="button"
              onClick={() => onExplain(buildItemExplanation({ kind: "bucket_entry", item }))}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/[0.05] sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-text-hi">{item.name}</p>
                  {item.symbol && item.name !== item.symbol ? <Badge>{item.symbol}</Badge> : null}
                  <Badge variant="chain" color={item.chainColor}>
                    {item.chainEmoji} {item.chainName}
                  </Badge>
                  {item.sourceLabel ? <Badge>{item.sourceLabel}</Badge> : null}
                  {item.protocolName ? <Badge variant="accent">{item.protocolName}</Badge> : null}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-text-lo">{item.reason}</p>
              </div>
              <div className="text-right">
                <p className="num text-sm font-semibold text-text-hi">{formatUSD(item.usdValue)}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="px-4 py-6 text-center sm:px-5">
          <p className="text-sm text-text-mid">Nothing sits in this bucket right now.</p>
        </div>
      )}
    </Card>
  );
}

export function PortfolioBuckets({
  portfolio,
  previewOnly = false,
}: PortfolioBucketsProps) {
  const buckets = useMemo(
    () => buildPortfolioBuckets(portfolio),
    [portfolio]
  );

  const [selectedBucketId, setSelectedBucketId] = useState<PortfolioBucketId>("safe_cash");
  const [selectedExplanation, setSelectedExplanation] = useState<PositionExplanation | null>(null);
  const selectedBucket = buckets.find((bucket) => bucket.bucketId === selectedBucketId) ?? buckets[0];

  return (
    <section className="space-y-3">
      {!previewOnly ? (
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-text-hi">Where my money sits</p>
            <p className="mt-1 text-xs text-text-lo">
              A beginner-friendly split of your funds by risk, liquidity, and how they are being used.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {buckets.map((bucket) => (
          <BucketCard
            key={bucket.bucketId}
            bucket={bucket}
            selected={bucket.bucketId === selectedBucket.bucketId}
            onSelect={() => setSelectedBucketId(bucket.bucketId)}
            previewOnly={previewOnly}
          />
        ))}
      </div>

      {!previewOnly && selectedBucket ? (
        <BucketDrilldown
          bucket={selectedBucket}
          onExplain={(explanation) => setSelectedExplanation(explanation)}
        />
      ) : null}

      {!previewOnly ? (
        <PositionExplainDrawer
          open={selectedExplanation !== null}
          explanation={selectedExplanation}
          onClose={() => setSelectedExplanation(null)}
        />
      ) : null}
    </section>
  );
}
