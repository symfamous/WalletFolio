"use client";

import { useState } from "react";
import {
  TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  BarChart2, Activity, AlertTriangle, ShieldAlert,
  ExternalLink, Info,
} from "lucide-react";
import { cn, formatUSD, formatPct } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { PositionExplainButton, PositionExplainDrawer } from "@/components/PositionExplainDrawer";
import { buildItemExplanation } from "@/lib/positionExplainer";
import type { NormalizedPerpPosition, NormalizedPerpPlatform } from "../lib/providers/perps/types";
import type { PerpsApiResponse, PositionExplanation } from "@/types";

interface Props {
  data:      PerpsApiResponse | null;
  isLoading: boolean;
}

// ─── Platform badge ───────────────────────────────────────────────

function PlatformBadge({ platform, color }: { platform: string; color: string }) {
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-md font-medium border whitespace-nowrap"
      style={{ color, borderColor: `${color}40`, backgroundColor: `${color}12` }}
    >
      {platform}
    </span>
  );
}

// ─── Accuracy badge ───────────────────────────────────────────────

function AccuracyBadge({ isExact, note }: { isExact: boolean; note?: string }) {
  return (
    <span
      className={cn(
        "text-[10px] px-1.5 py-0.5 rounded-md border font-medium flex items-center gap-1",
        isExact
          ? "text-success bg-success/8 border-success/25"
          : "text-warning bg-warning/8 border-warning/25"
      )}
      title={note}
    >
      {isExact ? "✓ Exact" : "~ Estimated"}
    </span>
  );
}

// ─── Risk badge ───────────────────────────────────────────────────

function RiskBadge({ level }: { level: NormalizedPerpPosition["riskLevel"] }) {
  return (
    <span className={cn(
      "text-[10px] px-1.5 py-0.5 rounded-md font-medium border",
      level === "critical" ? "text-danger  bg-danger/10  border-danger/30"
      : level === "warning" ? "text-warning bg-warning/10 border-warning/30"
      : "text-success bg-success/8 border-success/20"
    )}>
      {level === "critical" ? "⚠ Liq Risk" : level === "warning" ? "⚡ Watch" : "✓ Safe"}
    </span>
  );
}

// ─── Single position card ─────────────────────────────────────────

function PositionCard({
  pos,
  onExplain,
}: {
  pos: NormalizedPerpPosition;
  onExplain: (explanation: PositionExplanation) => void;
}) {
  const [open, setOpen] = useState(false);
  const isLong = pos.side === "long";
  const pnlPos = pos.unrealizedPnl >= 0;

  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-surface transition-colors duration-200 hover:border-border-strong">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0",
            isLong ? "bg-success/12 text-success border border-success/20"
                   : "bg-danger/12 text-danger border border-danger/20"
          )}>
            {isLong ? "L" : "S"}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-text-hi">{pos.market}</p>
              <PlatformBadge platform={pos.platform} color={pos.chainColor} />
            </div>
            <p className="mt-0.5 text-[10px] text-text-lo">
              {pos.leverage}x {pos.leverageType} · {pos.size.toPrecision(4)} {pos.coin}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1">
            <p className={cn("num text-sm font-semibold", pnlPos ? "text-success" : "text-danger")}>
              {pnlPos ? "+" : ""}{formatUSD(pos.unrealizedPnl)}
            </p>
            <RiskBadge level={pos.riskLevel} />
          </div>

          {open ? <ChevronUp className="h-3.5 w-3.5 text-text-lo flex-shrink-0 ml-1" />
                 : <ChevronDown className="h-3.5 w-3.5 text-text-lo flex-shrink-0 ml-1" />}
        </button>

        <PositionExplainButton
          onClick={() => onExplain(buildItemExplanation({ kind: "perp", item: pos }))}
          label={`Explain ${pos.market}`}
        />
      </div>

      {open && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-accent/7 px-4 pb-4 pt-3 text-xs animate-fade-in sm:grid-cols-3">
          {[
            { label: "Entry Price",     value: `$${pos.entryPrice.toLocaleString("en-US", { maximumFractionDigits: pos.entryPrice < 1 ? 6 : 2 })}` },
            { label: "Mark Price",      value: `$${pos.markPrice.toLocaleString("en-US",  { maximumFractionDigits: pos.markPrice < 1  ? 6 : 2 })}` },
            { label: "Position Value",  value: formatUSD(pos.positionValue) },
            { label: "Margin Used",     value: formatUSD(pos.marginUsed) },
            { label: "ROE",             value: formatPct(pos.returnOnEquity * 100) },
            { label: "Funding (open)",  value: formatUSD(pos.fundingSinceOpen) },
            pos.liquidationPrice !== null
              ? { label: "Liq. Price",    value: `$${pos.liquidationPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })}` }
              : null,
            pos.liqDistancePct !== null
              ? { label: "Liq. Distance", value: `${pos.liqDistancePct.toFixed(1)}% away` }
              : null,
          ].filter(Boolean).map((item) => (
            <div key={item!.label}>
              <p className="text-text-lo mb-0.5">{item!.label}</p>
              <p className="num text-text-hi font-medium">{item!.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Platform section ─────────────────────────────────────────────

function PlatformSection({
  platform,
  onExplain,
}: {
  platform: NormalizedPerpPlatform;
  onExplain: (explanation: PositionExplanation) => void;
}) {
  const [showPnl, setShowPnl] = useState(false);
  const hasPositions = platform.positions.length > 0;
  const accountValue = Math.max(platform.accountSummary?.accountValue ?? 0, platform.accountSummary?.withdrawable ?? 0);
  const hasPnl       = platform.pnl.fillCount > 0 || platform.pnl.unrealizedPnl !== 0;
  const netPos       = platform.pnl.netLifetime >= 0;
  const isError      = platform.error === "no-public-api" || platform.error === "evm-address-not-supported";

  // Skip platforms with no data and a known incompatibility error
  if (isError && !hasPositions) return null;

  return (
    <div className="space-y-3">
      {/* Platform header */}
      <div className="flex items-center gap-2 flex-wrap">
        <PlatformBadge platform={platform.platform} color={platform.chainColor} />
        <span className="text-xs text-text-lo">{platform.chain}</span>
        {hasPositions && (
          <span className="num text-xs text-accent">{platform.positions.length} open</span>
        )}
        {accountValue > 0 && (
          <span className="num text-xs text-text-mid ml-auto">
            {formatUSD(accountValue)} account value
          </span>
        )}
      </div>

      {/* Positions */}
      {hasPositions ? (
        <div className="space-y-2">
          {platform.positions.map((pos, i) => (
            <PositionCard key={`${pos.market}-${i}`} pos={pos} onExplain={onExplain} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-accent/7 bg-text-hi/[0.02] px-4 py-4 text-center">
          <p className="text-xs text-text-lo">
            {platform.error === "no-public-api"
              ? "GMX: No public API for positions — on-chain query required"
              : platform.error === "evm-address-not-supported"
              ? "Drift: Solana only — not compatible with EVM addresses"
              : platform.error === "activity-only"
              ? "Recent Drift activity detected. Exact open positions require the Drift account adapter."
              : accountValue > 0
              ? `Idle collateral: ${formatUSD(accountValue)} USDC`
              : "No open positions"}
          </p>
        </div>
      )}

      {/* Lifetime PnL (collapsible) */}
      {hasPnl && (
        <div className="overflow-hidden rounded-xl border border-accent/12">
          <button
            onClick={() => setShowPnl((s) => !s)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-accent/[0.04]"
          >
            <div className="flex items-center gap-2">
              <BarChart2 className="h-3.5 w-3.5 text-text-lo" strokeWidth={1.5} />
              <span className="text-xs font-medium text-text-mid">PnL Analytics</span>
              <AccuracyBadge isExact={platform.pnl.isExact} note={platform.pnl.dataNote} />
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("num text-sm font-semibold", netPos ? "text-success" : "text-danger")}>
                {netPos ? "+" : ""}{formatUSD(platform.pnl.netLifetime)}
              </span>
              {showPnl ? <ChevronUp className="h-3.5 w-3.5 text-text-lo" /> : <ChevronDown className="h-3.5 w-3.5 text-text-lo" />}
            </div>
          </button>

          {showPnl && (
            <div className="space-y-3 border-t border-accent/7 px-4 pb-4 pt-3 animate-fade-in">
              <p className="rounded-lg bg-surface-raised px-3 py-2 text-[10px] text-text-lo">
                {platform.pnl.dataNote}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: "Realized PnL",   value: platform.pnl.realizedPnl,   hint: "Closed positions" },
                  { label: "Unrealized PnL", value: platform.pnl.unrealizedPnl, hint: "Open positions" },
                  { label: "Funding",        value: platform.pnl.totalFunding,  hint: "Paid/received" },
                  { label: "Fees",           value: -platform.pnl.totalFees,    hint: "Trading fees" },
                  { label: "Net Lifetime",   value: platform.pnl.netLifetime,   hint: "Total" },
                ].map(({ label, value, hint }) => (
                  <div key={label} className="rounded-lg border border-accent/7 bg-text-hi/[0.03] px-3 py-2.5">
                    <p className="text-[10px] text-text-lo">{label}</p>
                    <p className={cn("num text-sm font-semibold mt-0.5", value >= 0 ? "text-success" : "text-danger")}>
                      {value >= 0 ? "+" : ""}{formatUSD(value)}
                    </p>
                    <p className="text-[9px] text-text-lo mt-0.5">{hint}</p>
                  </div>
                ))}
              </div>

              {platform.pnl.pnlByMarket.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] uppercase tracking-widest text-text-lo font-medium">By Market</p>
                  {platform.pnl.pnlByMarket.slice(0, 6).map(({ coin, pnl }) => {
                    const maxAbs = Math.max(...platform.pnl.pnlByMarket.map((m) => Math.abs(m.pnl)), 1);
                    return (
                      <div key={coin} className="flex items-center gap-3">
                        <span className="num text-xs text-text-hi w-14 font-medium">{coin}</span>
                        <div className="flex-1 h-1.5 bg-surface-overlay rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", pnl >= 0 ? "bg-success" : "bg-danger")}
                            style={{ width: `${Math.abs(pnl) / maxAbs * 100}%`, opacity: 0.7 }}
                          />
                        </div>
                        <span className={cn("num text-xs w-20 text-right", pnl >= 0 ? "text-success" : "text-danger")}>
                          {pnl >= 0 ? "+" : ""}{formatUSD(pnl)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────

export function PerpPositions({ data, isLoading }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedExplanation, setSelectedExplanation] = useState<PositionExplanation | null>(null);

  const totalUnrealized = data?.totalUnrealizedPnl ?? 0;
  const totalNet        = data?.netLifetimePnl     ?? 0;
  const openCount       = data?.openPositionCount  ?? 0;
  const uPos            = totalUnrealized >= 0;
  const nPos            = totalNet >= 0;
  const checkedPlatforms = (data?.platforms ?? []).map((platform) => platform.platform).join(" / ") || "Hyperliquid / dYdX v4";

  const activePlatforms = (data?.platforms ?? []).filter(
    (p) => {
      const accountValue = Math.max(p.accountSummary?.accountValue ?? 0, p.accountSummary?.withdrawable ?? 0);
      return p.positions.length > 0
        || accountValue > 0
        || (p.pnl.fillCount > 0 && p.error !== "no-public-api" && p.error !== "evm-address-not-supported");
    }
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-10 rounded-xl border border-border bg-surface animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-fade-up">
      {/* Section header — always visible */}
      <button onClick={() => setCollapsed((c) => !c)} className="group flex w-full items-center gap-2.5 py-0.5 text-left">
        <Activity className="h-4 w-4 text-accent" strokeWidth={1.5} />
        <h2 className="text-sm font-semibold text-text-hi">Perp Positions</h2>
        <span className="text-[11px] text-text-lo">{checkedPlatforms}</span>
        {openCount > 0 && (
          <span className="text-xs text-accent bg-accent/10 border border-accent/20 rounded px-1.5 py-0.5">
            {openCount} open
          </span>
        )}
        {totalUnrealized !== 0 && (
          <span className={cn("num text-xs font-semibold ml-2", uPos ? "text-success" : "text-danger")}>
            {uPos ? "+" : ""}{formatUSD(totalUnrealized)} unrealized
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 text-xs text-text-lo group-hover:text-text-mid transition-colors">
          {collapsed ? <><ChevronDown className="h-3.5 w-3.5" /> Show</> : <><ChevronUp className="h-3.5 w-3.5" /> Hide</>}
        </span>
      </button>

      {!collapsed && (
        <div className="space-y-5">
          {/* Combined summary strip (only if multi-platform data) */}
          {data && (data.totalAccountValue > 0 || openCount > 0) && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Account Value",    value: formatUSD(data.totalAccountValue) },
                { label: "Open Positions",   value: String(openCount) },
                { label: "Unrealized PnL",   value: formatUSD(totalUnrealized), color: uPos ? "text-success" : "text-danger" },
                { label: "Net Lifetime PnL", value: formatUSD(totalNet), color: nPos ? "text-success" : "text-danger", note: data.isPartialData ? "~" : "" },
              ].map(({ label, value, color, note }) => (
                <div key={label} className="rounded-xl border border-border bg-surface-raised px-3 py-2.25">
                  <p className="text-[10px] text-text-lo mb-0.5">{label}</p>
                  <p className={cn("num text-sm font-semibold", color ?? "text-text-hi")}>
                    {note}{value}
                  </p>
                  {label === "Net Lifetime PnL" && data.isPartialData && (
                    <p className="text-[9px] text-warning/70 mt-0.5">Estimated / partial</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Per-platform sections */}
          {activePlatforms.length > 0 ? (
            <div className="space-y-5">
              {activePlatforms.map((platform) => (
                <PlatformSection
                  key={platform.platform}
                  platform={platform}
                  onExplain={(explanation) => setSelectedExplanation(explanation)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface px-4 py-8 text-center">
              <Activity className="h-6 w-6 text-text-lo mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm text-text-lo">No open perp positions found</p>
              <p className="text-xs text-text-lo mt-1">Checked {checkedPlatforms}</p>
            </div>
          )}
        </div>
      )}

      <PositionExplainDrawer
        open={selectedExplanation !== null}
        explanation={selectedExplanation}
        onClose={() => setSelectedExplanation(null)}
      />
    </div>
  );
}
