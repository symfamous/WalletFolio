"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Send, ArrowDownLeft, ArrowLeftRight, CheckCircle,
  ArrowUpCircle, ArrowDownCircle, Coins, Shuffle,
  Lock, Unlock, Gift, Loader2, ChevronDown,
  ExternalLink, AlertCircle, Database, RefreshCw, Info, ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { cn, isSolanaAddress } from "@/lib/utils";
import type { ActivityFeedSummary, ActivityRiskImpact, ExplainedActivity, HistoryEvent, HistoryEventType } from "@/types";
import { useHistory } from "@/hooks/useHistory";
import { Card } from "@/components/ui/Card";
import {
  explainHistoryEvents,
  getRiskImpactChipLabel,
  getRiskImpactLabel,
  summarizeExplainedActivity,
} from "@/lib/activityExplainer";

// ─── Event config ─────────────────────────────────────────────────

const EVENT_CONFIG: Record<HistoryEventType, {
  icon: LucideIcon;
  color: string;
  bg: string;
  label: string;
}> = {
  send:     { icon: Send,            color: "#F43F5E", bg: "rgba(244,63,94,0.12)",   label: "Sent"       },
  receive:  { icon: ArrowDownLeft,   color: "#10B981", bg: "rgba(16,185,129,0.12)",  label: "Received"   },
  swap:     { icon: ArrowLeftRight,  color: "#3B82F6", bg: "rgba(59,130,246,0.12)",  label: "Swap"       },
  approve:  { icon: CheckCircle,     color: "#5a78a0", bg: "rgba(90,120,160,0.10)", label: "Approval"   },
  deposit:  { icon: ArrowUpCircle,   color: "#8B5CF6", bg: "rgba(139,92,246,0.12)",  label: "Deposit"    },
  withdraw: { icon: ArrowDownCircle, color: "#ffb4ab", bg: "rgba(245,158,11,0.12)",  label: "Withdraw"   },
  borrow:   { icon: Coins,           color: "#EF4444", bg: "rgba(239,68,68,0.12)",   label: "Borrow"     },
  repay:    { icon: Coins,           color: "#10B981", bg: "rgba(16,185,129,0.12)",  label: "Repay"      },
  claim:    { icon: Gift,            color: "#00f3ff", bg: "rgba(236,72,153,0.12)",  label: "Claim"      },
  bridge:   { icon: Shuffle,         color: "#06B6D4", bg: "rgba(6,182,212,0.12)",   label: "Bridge"     },
  stake:    { icon: Lock,            color: "#A78BFA", bg: "rgba(167,139,250,0.12)", label: "Stake"      },
  unstake:  { icon: Unlock,          color: "#A78BFA", bg: "rgba(167,139,250,0.12)", label: "Unstake"    },
  other:    { icon: AlertCircle,     color: "#5a78a0", bg: "rgba(90,120,160,0.08)", label: "Activity"   },
};

// Types shown in filter — approvals hidden by default, available in filter
const FILTER_TYPES: Array<{ slug: string; label: string }> = [
  { slug: "all",      label: "All"       },
  { slug: "swap",     label: "Swaps"     },
  { slug: "send",     label: "Sent"      },
  { slug: "receive",  label: "Received"  },
  { slug: "deposit",  label: "Deposits"  },
  { slug: "withdraw", label: "Withdraws" },
  { slug: "borrow",   label: "Borrows"   },
  { slug: "repay",    label: "Repays"    },
  { slug: "claim",    label: "Claims"    },
  { slug: "bridge",   label: "Bridges"   },
  { slug: "stake",    label: "Staking"   },
  { slug: "unstake",  label: "Unstaking" },
  { slug: "approve",  label: "Approvals" },
  { slug: "other",    label: "Other"     },
];

const VIEW_OPTIONS = [
  { slug: "explained", label: "Explained" },
  { slug: "raw", label: "Raw" },
];

// ─── Date grouping ────────────────────────────────────────────────

function getDateGroup(ts: string): string {
  const d    = new Date(ts);
  if (isNaN(d.getTime())) return "Unknown";
  const now  = new Date();
  const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 1)  return "Today";
  if (diff < 2)  return "Yesterday";
  if (diff < 8)  return "This week";
  if (diff < 32) return "This month";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatCompactUsd(value?: number): string | null {
  if (value === undefined || value <= 0) return null;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

// ─── Drag-scroll chip row ─────────────────────────────────────────

function ChipRow<T extends { slug: string; label: string }>({
  options, active, onSelect,
}: { options: T[]; active: string; onSelect: (slug: string) => void }) {
  const ref  = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; sl: number } | null>(null);

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10"
        style={{ background: "linear-gradient(to left, rgb(var(--bg)), transparent)" }}
      />
      <div
        ref={ref}
        className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5 select-none"
        onMouseDown={(e) => { if (ref.current) drag.current = { x: e.pageX, sl: ref.current.scrollLeft }; }}
        onMouseMove={(e) => { if (drag.current && ref.current) ref.current.scrollLeft = drag.current.sl - (e.pageX - drag.current.x); }}
        onMouseUp={() => { drag.current = null; }}
        onMouseLeave={() => { drag.current = null; }}
        onTouchStart={(e) => { if (ref.current) drag.current = { x: e.touches[0].clientX, sl: ref.current.scrollLeft }; }}
        onTouchMove={(e) => { if (drag.current && ref.current) ref.current.scrollLeft = drag.current.sl - (e.touches[0].clientX - drag.current.x); }}
        onTouchEnd={() => { drag.current = null; }}
      >
        {options.map((o) => (
          <button
            key={o.slug}
            onClick={() => onSelect(o.slug)}
            className={cn(
              "flex-shrink-0 rounded-lg px-3 py-1.25 text-xs font-medium transition-all whitespace-nowrap",
              active === o.slug
                ? "bg-accent/15 text-accent border border-accent/30"
                : "bg-surface-raised border border-border text-text-lo hover:text-text-mid hover:border-border-subtle"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function getRiskImpactClasses(riskImpact: ActivityRiskImpact): string {
  switch (riskImpact) {
    case "Higher":
      return "text-danger bg-danger/8 border-danger/20";
    case "Lower":
      return "text-success bg-success/8 border-success/20";
    case "Unchanged":
      return "text-text-mid bg-surface-raised/70 border-border";
    case "Unknown":
    default:
      return "text-text-lo bg-surface-raised/70 border-border";
  }
}

function ActivitySummaryCard({ summary }: { summary: ActivityFeedSummary }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/20 bg-accent/10">
          <ShieldAlert className="h-4 w-4 text-accent" strokeWidth={1.6} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-text-hi">Recent activity explained</p>
            <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-medium", getRiskImpactClasses(summary.overallRiskDirection === "Mixed" ? "Unknown" : summary.overallRiskDirection))}>
              {summary.overallRiskDirection}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-text-lo">{summary.summaryLine}</p>
        </div>
      </div>

      <div className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface-raised/20 px-3 py-2.25">
          <p className="text-[11px] text-text-lo">Main move</p>
          <p className="mt-1 text-sm text-text-hi">{summary.biggestAction}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-raised/20 px-3 py-2.5">
          <p className="text-[11px] text-text-lo">Money moved</p>
          <p className="num mt-1 text-sm text-text-hi">
            {summary.totalMeaningfulVolumeUsd !== undefined ? formatCompactUsd(summary.totalMeaningfulVolumeUsd) : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface-raised/20 px-3 py-2.5">
          <p className="text-[11px] text-text-lo">Protocol touched</p>
          <p className="mt-1 text-sm text-text-hi">{summary.newProtocol ?? "None spotted"}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-raised/20 px-3 py-2.5">
          <p className="text-[11px] text-text-lo">Risk trend</p>
          <p className="mt-1 text-sm text-text-hi">{summary.overallRiskDirection}</p>
        </div>
      </div>
    </Card>
  );
}

function ExplainedHistoryRow({ activity }: { activity: ExplainedActivity }) {
  const [open, setOpen] = useState(false);
  const date = new Date(activity.timestamp);
  const valid = !isNaN(date.getTime());
  const timeStr = valid
    ? date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className="group border-b border-border/30 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full px-4 py-2.75 text-left transition-colors hover:bg-surface-raised/30"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium leading-snug text-text-hi">{activity.title}</p>
              <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-medium", getRiskImpactClasses(activity.riskImpact))}>
                {getRiskImpactChipLabel(activity.riskImpact)}
              </span>
              {activity.isNoise ? (
                <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-text-lo">Low signal</span>
              ) : null}
            </div>

            <div className="mt-1 flex items-center gap-2 flex-wrap text-[10px] text-text-lo">
              <span
                className="rounded border px-1.5 py-0.5"
                style={{
                  color: activity.rawEvent.chainColor,
                  borderColor: `${activity.rawEvent.chainColor}30`,
                  backgroundColor: `${activity.rawEvent.chainColor}12`,
                }}
              >
                {activity.rawEvent.chainEmoji} {activity.rawEvent.chainName}
              </span>
              {activity.protocol ? <span className="rounded border border-accent/20 bg-accent/10 px-1.5 py-0.5 text-accent">{activity.protocol}</span> : null}
              {timeStr ? <span>{timeStr}</span> : null}
            </div>

            {activity.riskReason ? (
              <p className="mt-1.5 text-xs leading-relaxed text-text-lo">
                {activity.riskReason}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {activity.usdValue !== undefined && activity.usdValue > 0 ? (
              <span className="num text-xs text-text-mid">{activity.usdValue >= 1000 ? `$${(activity.usdValue / 1000).toFixed(1)}K` : `$${activity.usdValue.toFixed(2)}`}</span>
            ) : null}
            <ChevronDown className={cn("h-3 w-3 text-text-lo transition-transform", open && "rotate-180")} />
          </div>
        </div>
      </button>

      {open ? (
        <div className="mx-4 mb-3 rounded-xl border border-border/50 bg-surface-raised/20 px-3 py-2.75 text-xs animate-fade-in">
          <p className="text-text-mid">{activity.plainEnglish}</p>
          {activity.bucketImpact ? <p className="mt-2 text-text-lo">Bucket effect: {activity.bucketImpact}</p> : null}
          {activity.beginnerNote ? <p className="mt-2 text-text-lo">Beginner note: {activity.beginnerNote}</p> : null}
          <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-text-lo">
            <span>{getRiskImpactLabel(activity.riskImpact)}</span>
            {activity.usdValue !== undefined ? <span className="num text-text-mid">{formatCompactUsd(activity.usdValue)}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Single history row ───────────────────────────────────────────

function HistoryRow({ event }: { event: HistoryEvent }) {
  const [open, setOpen] = useState(false);
  const cfg   = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.other;
  const Icon  = cfg.icon;

  const date   = new Date(event.timestamp);
  const valid  = !isNaN(date.getTime());
  const timeStr = valid
    ? date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : "";
  const dateStr = valid
    ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";

  return (
    <div className="group border-b border-border/30 last:border-0">
      {/* Main row — compact, clean */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-2.75 text-left transition-colors hover:bg-surface-raised/30"
      >
        {/* Type icon */}
        <div
          className="h-8 w-8 flex-shrink-0 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: cfg.bg }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: cfg.color }} strokeWidth={1.5} />
        </div>

        {/* Description + subtitle */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-hi truncate leading-snug">
            {event.description}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {/* Chain badge */}
            <span
              className="text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap font-medium"
              style={{
                color:           event.chainColor,
                borderColor:     `${event.chainColor}30`,
                backgroundColor: `${event.chainColor}12`,
              }}
            >
              {event.chainEmoji} {event.chainName}
            </span>
            {/* Time */}
            <span className="text-[10px] text-text-lo">
              {timeStr}
            </span>
          </div>
        </div>

        {/* Right: value + expand caret */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {event.usdValue !== undefined && event.usdValue > 0.01 && (
            <span className="num text-xs text-text-mid">${event.usdValue.toFixed(2)}</span>
          )}
          <ChevronDown
            className={cn(
              "h-3 w-3 text-text-lo transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Expanded details — tx-level noise moved here */}
      {open && (
        <div className="mx-4 mb-3 overflow-hidden rounded-xl border border-border/50 bg-surface-raised/20 text-xs divide-y divide-border/30 animate-fade-in">
          {/* Type badge row */}
          <div className="flex items-center gap-2 px-3 py-2.5">
            <span
              className="px-2 py-0.5 rounded-md font-medium border text-[10px]"
              style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: `${cfg.color}30` }}
            >
              {cfg.label}
            </span>
            <span className="text-text-lo">
              {valid ? date.toLocaleString("en-US", {
                month: "short", day: "numeric", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              }) : "Unknown date"}
            </span>
          </div>

          {/* Counterparty */}
          {event.counterparty && (
            <div className="flex justify-between items-center px-3 py-2">
              <span className="text-text-lo">To / From</span>
              <span className="num text-text-mid">{event.counterparty}</span>
            </div>
          )}

          {/* USD value */}
          {event.usdValue !== undefined && event.usdValue > 0 && (
            <div className="flex justify-between items-center px-3 py-2">
              <span className="text-text-lo">Value</span>
              <span className="num text-text-mid">${event.usdValue.toFixed(2)}</span>
            </div>
          )}

          {/* Gas */}
          {event.fee !== undefined && event.fee > 0.001 && (
            <div className="flex justify-between items-center px-3 py-2">
              <span className="text-text-lo">Gas fee (est.)</span>
              <span className="num text-text-mid">${event.fee.toFixed(2)}</span>
            </div>
          )}

          {/* Tx hash + explorer link */}
          {event.txHash && (
            <div className="flex justify-between items-center px-3 py-2">
              <span className="text-text-lo">Transaction</span>
              {event.explorerUrl ? (
                <a
                  href={event.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-accent hover:text-accent num transition-colors"
                >
                  {event.txHash.slice(0, 8)}…{event.txHash.slice(-6)}
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              ) : (
                <span className="num text-text-mid truncate max-w-[160px]">
                  {event.txHash.slice(0, 10)}…
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Date separator ───────────────────────────────────────────────

function DateSeparator({ label }: { label: string }) {
  return (
      <div className="flex items-center gap-3 border-b border-border/40 bg-surface-raised/50 px-4 py-1.75">
      <span className="text-[10px] font-semibold text-text-lo uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}

// ─── Provider info bar ────────────────────────────────────────────

function ProviderBar({
  providerLabel,
  count,
  chainsWithData,
  chainsAvailable,
  zerionCount,
  escanCount,
  freeTierNote,
}: {
  providerLabel?:   string;
  count:            number;
  chainsWithData?:  number;
  chainsAvailable?: number;
  zerionCount?:     number;
  escanCount?:      number;
  freeTierNote?:    string;
}) {
  const label = providerLabel ?? "Zerion";
  const isDual = label.includes("+");

  return (
    <div className="border-b border-border bg-surface-raised/30">
      <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 px-4 py-2 text-[10px] text-text-lo">
        <Database className="h-3 w-3 flex-shrink-0" />
        <span className={cn(isDual ? "text-accent" : "")}>{label}</span>

        {chainsWithData !== undefined && chainsWithData > 0 && (
          <>
            <span className="text-border">·</span>
            <span>{chainsWithData}{chainsAvailable ? `/${chainsAvailable}` : ""} chains</span>
          </>
        )}

        {count > 0 && (
          <>
            <span className="text-border">·</span>
            <span className="num">{count} txns</span>
          </>
        )}

        {isDual && zerionCount !== undefined && escanCount !== undefined && (
          <>
            <span className="text-border">·</span>
            <span className="text-text-lo">
              {zerionCount} from Zerion, {escanCount} from Etherscan
            </span>
          </>
        )}
      </div>
      {freeTierNote && (
        <div className="px-4 pb-2 flex items-center gap-1.5">
          <Info className="h-3 w-3 text-warning/60 flex-shrink-0" />
          <p className="text-[10px] text-warning/60">{freeTierNote}</p>
        </div>
      )}
    </div>
  );
}

export function WalletHistory({
  address,
  initialViewMode = "explained",
  allowRawToggle = true,
  compact = false,
}: {
  address: string;
  initialViewMode?: "explained" | "raw";
  allowRawToggle?: boolean;
  compact?: boolean;
}) {
  const [filterType, setFilterType] = useState("all");
  const [showCount, setShowCount] = useState(compact ? 10 : 25);
  const [viewMode, setViewMode] = useState<"explained" | "raw">(initialViewMode);
  const [showNoise, setShowNoise] = useState(false);
  const isSolana = isSolanaAddress(address) && !address.startsWith("0x");

  useEffect(() => {
    setViewMode(initialViewMode);
  }, [initialViewMode]);

  useEffect(() => {
    if (!allowRawToggle && viewMode !== "explained") {
      setViewMode("explained");
    }
  }, [allowRawToggle, viewMode]);

  const {
    events,
    chainFilter, setChainFilter, chainOptions,
    hasMore, isLoading, isFetching, isError, error, loadMore,
    providerLabel, chainsWithData, chainsAvailable, freeTierNote,
    zerionEventCount, escanEventCount,
  } = useHistory(address);
  const solanaHistoryUnconfigured =
    isSolana && providerLabel?.includes("HELIUS_API_KEY not configured");

  useEffect(() => {
    setShowCount(compact ? 10 : 25);
  }, [compact, filterType, chainFilter, viewMode]);

  // Apply local type filter on top of chain filter from hook
  const filtered = events.filter((e) => {
    if (filterType !== "all" && e.type !== filterType) return false;
    return true;
  });

  const explained = useMemo(() => explainHistoryEvents(filtered), [filtered]);
  const displayEvents = viewMode === "explained" && !showNoise
    ? explained.filter((event) => !event.isNoise)
    : explained;
  const visibleExplained = showCount === -1 ? displayEvents : displayEvents.slice(0, showCount);
  const visibleRaw = showCount === -1 ? filtered : filtered.slice(0, showCount);
  const summary = useMemo(() => summarizeExplainedActivity(displayEvents.slice(0, 25)), [displayEvents]);

  // Group visible events by date
  type Group = { label: string; events: HistoryEvent[]; activities: ExplainedActivity[] };
  const groups: Group[] = [];
  const sourceForGrouping = viewMode === "explained"
    ? visibleExplained.map((activity) => ({ label: getDateGroup(activity.timestamp), activity }))
    : visibleRaw.map((event) => ({ label: getDateGroup(event.timestamp), event }));

  for (const row of sourceForGrouping) {
    const label = row.label;
    const last  = groups[groups.length - 1];
    if (last && last.label === label) {
      if ("event" in row && row.event) last.events.push(row.event);
      if ("activity" in row && row.activity) last.activities.push(row.activity);
    } else {
      groups.push({
        label,
        events: "event" in row && row.event ? [row.event] : [],
        activities: "activity" in row && row.activity ? [row.activity] : [],
      });
    }
  }

  // ── Loading ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-10 gap-2 text-text-lo">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading transaction history…</span>
        </div>
      </Card>
    );
  }

  // ── Error: no API keys ─────────────────────────────────────────
  if (isError && (error?.message?.includes("No API") || error?.message?.includes("503"))) {
    return (
      <Card>
        <div className="flex flex-col items-center py-8 text-center gap-3">
          <Info className="h-8 w-8 text-text-lo" strokeWidth={1.5} />
          <p className="text-sm font-medium text-text-hi">Wallet history unavailable</p>
          <p className="text-xs text-text-mid max-w-sm leading-relaxed">
            Add{" "}
            <code className="text-accent bg-surface-raised px-1 py-0.5 rounded text-[11px]">ZERION_API_KEY</code>
            {" "}or{" "}
            <code className="text-accent bg-surface-raised px-1 py-0.5 rounded text-[11px]">ETHERSCAN_API_KEY</code>
            {" "}to{" "}
            <code className="text-text-mid bg-surface-raised px-1 py-0.5 rounded text-[11px]">.env.local</code>
            {" "}to enable history.
          </p>
        </div>
      </Card>
    );
  }

  // ── Error: other ───────────────────────────────────────────────
  if (isError) {
    return (
      <Card>
        <div className="flex flex-col items-center py-8 text-center gap-3">
          <AlertCircle className="h-7 w-7 text-warning/70" strokeWidth={1.5} />
          <p className="text-sm font-medium text-text-hi">Could not load history</p>
          <p className="text-xs text-text-mid max-w-xs">{error?.message ?? "Unknown error"}</p>
        </div>
      </Card>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────
  if (!isLoading && events.length === 0) {
    return (
      <Card noPadding className="overflow-hidden">
        <ProviderBar
          providerLabel={providerLabel}
          count={0}
          chainsWithData={chainsWithData}
          chainsAvailable={chainsAvailable}
          freeTierNote={freeTierNote}
        />
        <div className="flex flex-col items-center py-10 text-center gap-2">
          <Database className="h-7 w-7 text-text-mid" strokeWidth={1.5} />
          <p className="text-sm text-text-hi">
            {solanaHistoryUnconfigured ? "Solana history unavailable" : "No transactions found"}
          </p>
          <p className="text-xs text-text-lo">
            {solanaHistoryUnconfigured
              ? "Add HELIUS_API_KEY to .env.local to enable free Solana wallet history."
              : "No activity detected on supported chains for this address."}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Chain filter — from hook (shows only chains with results) */}
      {chainOptions.length > 2 && (
        <ChipRow
          options={chainOptions.map((c) => ({ slug: c.slug, label: c.name }))}
          active={chainFilter}
          onSelect={(slug) => {
            setChainFilter(slug);
            setShowCount(25);
          }}
        />
      )}

      {allowRawToggle ? (
        <ChipRow
          options={VIEW_OPTIONS}
          active={viewMode}
          onSelect={(slug) => {
            setViewMode(slug as "explained" | "raw");
            setShowCount(25);
          }}
        />
      ) : null}

      {viewMode === "explained" ? (
        <p className="text-xs text-text-lo">
          {compact
            ? "Simple keeps the most important activity up front."
            : "Simple mode explains what happened in plain English and hides low-signal setup noise by default."}
        </p>
      ) : null}

      {/* Type filter */}
      {!compact ? (
        <ChipRow
          options={FILTER_TYPES}
          active={filterType}
          onSelect={(slug) => {
            setFilterType(slug);
            setShowCount(25);
          }}
        />
      ) : null}

      {viewMode === "explained" && !compact ? (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowNoise((value) => !value)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-lg border transition-colors",
              showNoise
                ? "bg-accent/15 text-accent border-accent/30"
                : "bg-surface-raised border-border text-text-lo hover:text-text-mid"
            )}
          >
            {showNoise ? "Hide low-signal activity" : "Show low-signal activity"}
          </button>
        </div>
      ) : null}

      {viewMode === "explained" && displayEvents.length > 0 ? (
        <ActivitySummaryCard summary={summary} />
      ) : null}

      {/* Show count */}
      {!compact && (viewMode === "explained" ? displayEvents.length : filtered.length) > 10 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-text-lo">Show:</span>
          {[
            { label: "10",  count: 10  },
            { label: "25",  count: 25  },
            { label: "50",  count: 50  },
            { label: "All", count: -1  },
          ].map(({ label, count }) => (
            <button
              key={label}
              onClick={() => setShowCount(count)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-lg border transition-colors",
                (showCount === count || (count === -1 && showCount >= (viewMode === "explained" ? displayEvents.length : filtered.length)))
                  ? "bg-accent/15 text-accent border-accent/30"
                  : "bg-surface-raised border-border text-text-lo hover:text-text-mid"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Empty filter state */}
      {!isLoading && events.length > 0 && (viewMode === "explained" ? visibleExplained.length === 0 : visibleRaw.length === 0) && (
        <Card>
          <p className="text-center text-sm text-text-lo py-6">
            {viewMode === "explained" ? "No explained activity matches this filter." : "No transactions match this filter."}
          </p>
        </Card>
      )}

      {/* Timeline */}
      {groups.length > 0 && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <ProviderBar
            providerLabel={providerLabel}
            count={events.length}
            chainsWithData={chainsWithData}
            chainsAvailable={chainsAvailable}
            zerionCount={zerionEventCount}
            escanCount={escanEventCount}
            freeTierNote={freeTierNote}
          />
          {groups.map((group) => (
            <div key={group.label}>
              <DateSeparator label={group.label} />
              {(viewMode === "explained"
                ? group.activities.map((activity, i) => (
                    <ExplainedHistoryRow key={`${activity.id ?? activity.rawEvent.txHash}-${i}`} activity={activity} />
                  ))
                : group.events.map((event, i) => (
                    <HistoryRow key={`${event.id ?? event.txHash}-${i}`} event={event} />
                  )))
              }
            </div>
          ))}
        </div>
      )}

      {/* Load more / show more */}
      <div className="flex gap-2 flex-wrap">
        {showCount !== -1 && (viewMode === "explained" ? displayEvents.length : filtered.length) > showCount && (
          <button
            onClick={() => setShowCount(-1)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm text-text-mid hover:text-text-hi hover:border-border-strong transition-colors"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            Show all {(viewMode === "explained" ? displayEvents.length : filtered.length)} loaded
          </button>
        )}
        {hasMore && (showCount === -1 || showCount >= (viewMode === "explained" ? displayEvents.length : filtered.length)) && (
          <button
            onClick={loadMore}
            disabled={isFetching}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm text-text-mid hover:text-text-hi hover:border-border-strong transition-colors disabled:opacity-40"
          >
            {isFetching
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading…</>
              : <><RefreshCw className="h-3.5 w-3.5" />Load more</>}
          </button>
        )}
      </div>
    </div>
  );
}
