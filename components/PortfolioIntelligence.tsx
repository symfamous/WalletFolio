"use client";

import { useMemo, useState, useRef } from "react";
import {
  MapPin, TrendingUp, TrendingDown, ShieldAlert, ShieldCheck,
  DollarSign, AlertTriangle, Info, Zap, Eye, BarChart3, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  type LucideIcon,
} from "lucide-react";
import { cn, formatUSD, formatPct } from "@/lib/utils";
import { TokenLogo } from "@/components/TokenLogo";
import { Card } from "@/components/ui/Card";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";
import type {
  PortfolioIntelligence as PI, Portfolio, SupportedCurrency, UnifiedRiskFactor,
} from "@/types";
import { getRiskStatePresentation } from "@/lib/riskMonitor";
import { ChangeAttributionPanel } from "@/components/ChangeAttributionPanel";
import { useHistory } from "@/hooks/useHistory";
import { buildPortfolioPnlLedger } from "@/lib/pnlLedger";
import type { ChangeAttribution } from "@/lib/snapshots";

interface Props {
  pi:           PI;
  portfolio:    Portfolio;
  format:       (usd: number) => string;
  currency:     SupportedCurrency;
  attribution?: ChangeAttribution | null;
  hasHistory?:  boolean;
  layout?:      "tabs" | "accordion";
  allowedSections?: IntelligenceSection[];
  tabPickerStyle?: "auto" | "grid";
}

type IntelligenceSection = "where" | "change" | "risk" | "pnl";

const TABS: Array<{ key: IntelligenceSection; label: string; icon: LucideIcon }> = [
  { key: "where",  label: "Where is my money?", icon: MapPin      },
  { key: "change", label: "What changed?",       icon: TrendingUp  },
  { key: "risk",   label: "Anything risky?",     icon: ShieldAlert },
  { key: "pnl",    label: "Earn or lose?",       icon: DollarSign  },
];

const PIE_COLORS = [
  "#3B82F6","#8B5CF6","#10B981","#ffb4ab","#EF4444",
  "#06B6D4","#00f3ff","#84CC16","#F97316","#6366F1",
];

// ─────────────────────────────────────────────────────────
// Touch-scrollable horizontal chip row
// ─────────────────────────────────────────────────────────

function HScroll({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref  = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; sl: number } | null>(null);

  function start(x: number) {
    if (!ref.current) return;
    drag.current = { x, sl: ref.current.scrollLeft };
  }
  function move(x: number) {
    if (!drag.current || !ref.current) return;
    ref.current.scrollLeft = drag.current.sl - (x - drag.current.x);
  }
  function end() { drag.current = null; }

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10"
        style={{ background: "linear-gradient(to left, rgb(var(--surface)), transparent)" }}
      />
      <div
        ref={ref}
        className={cn("overflow-x-auto scrollbar-none select-none", className)}
        onMouseDown={(e) => start(e.pageX)}
        onMouseMove={(e) => { if (drag.current) move(e.pageX); }}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={(e) => start(e.touches[0].clientX)}
        onTouchMove={(e) => move(e.touches[0].clientX)}
        onTouchEnd={end}
      >
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// WHERE: Allocation view
// ─────────────────────────────────────────────────────────

function AllocationTab({ pi, portfolio, format }: { pi: PI; portfolio: Portfolio; format: (u: number) => string }) {
  const [view, setView] = useState<"token" | "chain" | "protocol">("token");

  const tokenData = pi.allocation.byToken.slice(0, 10).map((t, i) => ({
    name:  t.symbol,
    value: t.usdValue,
    color: PIE_COLORS[i % PIE_COLORS.length],
    pct:   t.percentage,
  }));

  const chainData = pi.allocation.byChain.filter((c) => c.totalUsdValue > 0).slice(0, 10).map((c, i) => ({
    name:  c.chainName,
    value: c.totalUsdValue,
    color: c.chainColor,
    pct:   c.percentage,
  }));

  const protoData = pi.allocation.byProtocol.filter((p) => p.netUsdValue > 0).slice(0, 8).map((p, i) => ({
    name:  p.protocolName,
    value: p.netUsdValue,
    color: PIE_COLORS[i % PIE_COLORS.length],
    pct:   p.percentage,
  }));

  const data = view === "token" ? tokenData : view === "chain" ? chainData : protoData;

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex gap-2">
        {(["token","chain","protocol"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={cn(
            "px-3 py-1 rounded-lg text-xs capitalize transition-colors",
            view === v
              ? "bg-accent/20 text-accent border border-accent/30"
              : "bg-surface-raised border border-border text-text-lo hover:text-text-mid"
          )}>
            By {v}
          </button>
        ))}
      </div>

      {/* Donut + legend */}
      <div className="flex flex-col sm:flex-row gap-5 items-center">
        {data.length > 0 ? (
          <div className="h-44 w-44 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={72}
                  paddingAngle={2} dataKey="value" stroke="none" animationDuration={600}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={data[i].color} opacity={0.85} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "rgb(var(--surface))", border: "1px solid rgb(var(--border-strong))", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v: number) => [format(v), ""]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-44 w-44 flex-shrink-0 flex items-center justify-center rounded-full border border-border text-text-lo text-xs">
            No data
          </div>
        )}

        <div className="flex-1 space-y-2 min-w-0">
          {data.slice(0, 8).map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-text-hi truncate flex-1">{item.name}</span>
              <span className="num text-xs text-text-mid">{format(item.value)}</span>
              <span className="num text-[10px] text-text-lo w-10 text-right">{item.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chain chips — touch-scrollable ────────────────── */}
      {view === "chain" && pi.allocation.byChain.filter((c) => c.totalUsdValue > 0).length > 0 && (
        <HScroll>
          <div className="flex gap-2 pb-1 min-w-max px-px">
            {pi.allocation.byChain.filter((c) => c.totalUsdValue > 0).map((c) => (
              <div
                key={c.chainSlug}
                className="flex items-center gap-1.5 rounded-xl border px-3 py-2 flex-shrink-0"
                style={{ borderColor: `${c.chainColor}40`, backgroundColor: `${c.chainColor}10` }}
              >
                <span className="text-sm">{c.chainEmoji}</span>
                <span className="text-xs font-medium whitespace-nowrap" style={{ color: c.chainColor }}>
                  {c.chainName}
                </span>
                <span className="num text-xs text-text-mid ml-1">{format(c.totalUsdValue)}</span>
              </div>
            ))}
          </div>
        </HScroll>
      )}

      {/* Token chips — touch-scrollable */}
      {view === "token" && (
        <HScroll>
          <div className="flex gap-2 pb-1 min-w-max px-px">
            {pi.allocation.byToken.map((t, i) => (
              <div
                key={`${t.symbol}-${i}`}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-raised px-3 py-2 flex-shrink-0"
              >
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="text-xs font-medium text-text-hi">{t.symbol}</span>
                <span className="num text-xs text-text-lo">{t.percentage.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </HScroll>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// CHANGE: 24h attribution
// ─────────────────────────────────────────────────────────

function ChangeTab({ pi, format, attribution, hasHistory }: { pi: PI; format: (u: number) => string; attribution?: ChangeAttribution | null; hasHistory?: boolean }) {
  const c   = pi.change24h;
  const pos = c.totalChange24hUsd >= 0;

  return (
    <div className="space-y-4">
      {/* Snapshot-based attribution (if available) */}
      <ChangeAttributionPanel attribution={attribution ?? null} hasHistory={hasHistory ?? false} />

      {/* 24h change */}
      <div className={cn(
        "rounded-xl border p-4 flex items-center justify-between",
        pos ? "border-success/20 bg-success/5" : "border-danger/20 bg-danger/5"
      )}>
        <div>
          <p className="text-xs text-text-lo mb-1">24h price change</p>
          <p className={cn("num text-2xl font-semibold", pos ? "text-success" : "text-danger")}>
            {pos ? "+" : ""}{formatUSD(c.totalChange24hUsd)}
          </p>
          <p className={cn("num text-sm mt-0.5", pos ? "text-success" : "text-danger")}>
            {pos ? "+" : ""}{format(c.totalChange24hUsd)}
          </p>
        </div>
        <div className="text-right">
          <p className={cn("num text-lg font-semibold", pos ? "text-success" : "text-danger")}>
            {pos ? "+" : ""}{formatPct(c.totalChange24hPct)}
          </p>
          {pos
            ? <TrendingUp className="h-6 w-6 text-success ml-auto mt-1" />
            : <TrendingDown className="h-6 w-6 text-danger ml-auto mt-1" />}
        </div>
      </div>

      {/* Attribution */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Price movement", value: c.priceMovementUsd,   hint: "From market price changes" },
          { label: "DeFi yield",     value: c.yieldEarnedUsd,     hint: "Interest / APY earned today" },
          { label: "Rewards",        value: c.rewardsClaimedUsd,  hint: "Claimable protocol rewards" },
          { label: "Gas costs",      value: -c.gasCostsUsd,       hint: "Estimated gas paid" },
        ].map(({ label, value, hint }) => (
          <div key={label} className="rounded-lg border border-border bg-surface-raised p-3">
            <p className="text-[11px] text-text-lo mb-0.5">{label}</p>
            <p className={cn("num text-sm font-semibold", value >= 0 ? "text-success" : "text-danger")}>
              {value >= 0 ? "+" : ""}{formatUSD(Math.abs(value))}
            </p>
            <p className="text-[10px] text-text-lo mt-0.5">{hint}</p>
          </div>
        ))}
      </div>

      {/* Movers */}
      {(c.topGainers.length > 0 || c.topLosers.length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {c.topGainers.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-widest text-text-lo mb-2 font-medium">
                Top Gainers
              </p>
              <div className="space-y-2">
                {c.topGainers.slice(0, 4).map((g) => (
                  <div key={g.symbol} className="flex items-center gap-2">
                    <TokenLogo symbol={g.symbol} logo={g.logo} size="xs" />
                    <span className="text-xs text-text-hi flex-1">{g.symbol}</span>
                    <span className="num text-xs text-success">+{g.changePct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {c.topLosers.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-widest text-text-lo mb-2 font-medium">
                Top Losers
              </p>
              <div className="space-y-2">
                {c.topLosers.slice(0, 4).map((g) => (
                  <div key={g.symbol} className="flex items-center gap-2">
                    <TokenLogo symbol={g.symbol} logo={g.logo} size="xs" />
                    <span className="text-xs text-text-hi flex-1">{g.symbol}</span>
                    <span className="num text-xs text-danger">{g.changePct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// RISK: DeFi monitor
// ─────────────────────────────────────────────────────────

function RiskTab({ pi }: { pi: PI }) {
  const r = pi.risk;
  const presentation = getRiskStatePresentation(r.overallState);
  const riskBg = {
    Safe:     "border-success/20 bg-success/5",
    Watch:    "border-warning/20 bg-warning/5",
    Risky:    "border-danger/20 bg-danger/5",
    Critical: "border-danger/40 bg-danger/10",
  }[r.overallState];

  function SeverityIcon({ s }: { s: UnifiedRiskFactor["state"] }) {
    return s === "Critical" || s === "Risky" || s === "Watch"
      ? <AlertTriangle className={cn("h-4 w-4 flex-shrink-0", s === "Critical" ? "text-danger" : "text-warning")} />
      : <Info className="h-4 w-4 text-text-lo flex-shrink-0" />;
  }

  return (
    <div className="space-y-4">
      {/* Overall badge */}
      <div className={cn("rounded-xl border p-4 flex items-center gap-3", riskBg)}>
        {r.overallState === "Safe"
          ? <ShieldCheck className="h-9 w-9 text-success flex-shrink-0" />
          : <ShieldAlert className={cn("h-9 w-9 flex-shrink-0", presentation.textClassName)} />}
        <div>
          <p className={cn("text-lg font-semibold", presentation.textClassName)}>
            {r.overallState}
          </p>
          <p className="text-sm text-text-mid">{r.topReason}</p>
          {r.overallState === "Safe" && (
            <p className="text-xs text-text-lo mt-0.5">{r.summaryCopy}</p>
          )}
        </div>
      </div>

      {/* Factors */}
      {r.triggeredFactors.length > 0 ? (
        <div className="space-y-2">
          {r.triggeredFactors.slice(0, 3).map((factor) => (
            <div key={factor.id} className={cn(
              "rounded-xl border p-3.5 flex items-start gap-3",
              factor.state === "Critical" ? "border-danger/30 bg-danger/5"
              : factor.state === "Risky" || factor.state === "Watch" ? "border-warning/30 bg-warning/5"
              : "border-border bg-surface-raised"
            )}>
              <SeverityIcon s={factor.state} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-sm font-medium text-text-hi">{factor.label}</span>
                </div>
                <p className="text-xs text-text-mid">{factor.explanation}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-raised p-6 text-center">
          <ShieldCheck className="h-8 w-8 text-success mx-auto mb-2" />
          <p className="text-sm text-text-hi">Safe</p>
          <p className="text-xs text-text-lo mt-1">{r.summaryCopy}</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// P&L: Earn or lose
// ─────────────────────────────────────────────────────────

function PnlTab({ pi, portfolio, format }: { pi: PI; portfolio: Portfolio; format: (u: number) => string }) {
  const p   = pi.profit;
  const pos = p.netTotal >= 0;
  const history = useHistory(portfolio.address);
  const ledger = useMemo(
    () => buildPortfolioPnlLedger(portfolio.aggregated, history.events),
    [portfolio.aggregated, history.events]
  );
  const ledgerPositive = ledger.netTrackedPnlUsd >= 0;

  const rows = [
    { label: "Price appreciation",  value: p.unrealized,    hint: "Unrealized gains/losses from prices" },
    { label: "DeFi yield earned",   value: p.yieldTotal,    hint: "Interest earned from lending/staking" },
    { label: "Rewards earned",      value: p.rewardsTotal,  hint: "Claimable protocol reward tokens" },
    { label: "Realized gains",      value: p.realized,      hint: "Gains from sold/closed positions" },
    { label: "Gas costs",           value: -p.gasCosts,     hint: "Estimated gas fees paid" },
  ].filter((r) => Math.abs(r.value) > 0);

  return (
    <div className="space-y-4">
      <div className={cn(
        "rounded-xl border p-4",
        ledgerPositive ? "border-accent/20 bg-accent/5" : "border-danger/20 bg-danger/5"
      )}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs text-text-lo">Tracked activity P&amp;L ledger</p>
            <p className={cn("num mt-1 text-2xl font-semibold", ledgerPositive ? "text-success" : "text-danger")}>
              {ledgerPositive ? "+" : ""}{format(ledger.netTrackedPnlUsd)}
            </p>
          </div>
          <span className="rounded-md border border-accent/20 bg-accent/8 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-accent">
            {ledger.coverage} coverage
          </span>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-text-lo">{ledger.note}</p>
        {history.isLoading ? <p className="mt-2 text-xs text-text-lo">Loading activity ledger...</p> : null}
        {history.hasMore ? (
          <button
            type="button"
            onClick={history.loadMore}
            disabled={history.isFetching}
            className="mt-2 rounded-lg border border-accent/18 px-2.5 py-1.5 text-[10px] text-accent transition-colors hover:bg-accent/8 disabled:opacity-40"
          >
            {history.isFetching ? "Loading older activity..." : "Load older activity into ledger"}
          </button>
        ) : null}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Realized trades", value: ledger.realizedPnlUsd },
            { label: "Unrealized", value: ledger.unrealizedPnlUsd },
            { label: "Income", value: ledger.incomeUsd },
            { label: "Fees", value: -ledger.feesUsd },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-border/70 bg-bg/25 px-2.5 py-2">
              <p className="text-[10px] text-text-lo">{item.label}</p>
              <p className={cn("num mt-0.5 text-xs font-semibold", item.value >= 0 ? "text-success" : "text-danger")}>
                {item.value >= 0 ? "+" : ""}{format(item.value)}
              </p>
            </div>
          ))}
        </div>
        {ledger.assets.some((asset) => asset.trackedCostBasisUsd !== undefined) ? (
          <div className="mt-3 space-y-1.5">
            {ledger.assets.filter((asset) => asset.trackedCostBasisUsd !== undefined).slice(0, 4).map((asset) => (
              <div key={asset.symbol} className="flex items-center justify-between rounded-lg border border-border/60 px-2.5 py-1.5 text-xs">
                <span className="text-text-hi">{asset.symbol}</span>
                <span className="text-text-lo">Basis {format(asset.trackedCostBasisUsd ?? 0)}</span>
                <span className={cn("num", (asset.unrealizedPnlUsd ?? 0) >= 0 ? "text-success" : "text-danger")}>
                  {(asset.unrealizedPnlUsd ?? 0) >= 0 ? "+" : ""}{format(asset.unrealizedPnlUsd ?? 0)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Net P&L */}
      <div className={cn(
        "rounded-xl border p-4",
        pos ? "border-success/20 bg-success/5" : "border-danger/20 bg-danger/5"
      )}>
        <p className="text-xs text-text-lo mb-1">24h market estimate</p>
        <p className={cn("num text-2xl font-semibold", pos ? "text-success" : "text-danger")}>
          {pos ? "+" : ""}{formatUSD(p.netTotal)}
        </p>
        <p className={cn("num text-sm mt-0.5", pos ? "text-success" : "text-danger")}>
          {pos ? "+" : ""}{format(p.netTotal)}
        </p>
        {p.roi !== 0 && isFinite(p.roi) && (
          <p className={cn("num text-sm mt-2 font-medium", pos ? "text-success" : "text-danger")}>
            {p.roi > 0 ? "+" : ""}{(p.roi ?? 0).toFixed(2)}% overall ROI
          </p>
        )}
        <p className="text-[10px] text-text-lo mt-1.5">
          {"Estimated from 24h price changes"}
        </p>
      </div>

      {/* Breakdown */}
      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map(({ label, value, hint }) => (
            <div key={label} className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised px-3 py-2.5">
              <div className={cn("h-2 w-2 rounded-full flex-shrink-0", value >= 0 ? "bg-success" : "bg-danger")} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-hi">{label}</p>
                <p className="text-[10px] text-text-lo">{hint}</p>
              </div>
              <p className={cn("num text-sm font-semibold", value >= 0 ? "text-success" : "text-danger")}>
                {value >= 0 ? "+" : ""}{formatUSD(Math.abs(value))}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Hidden funds scanner */}
      {pi.hiddenFunds.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-widest text-text-lo mb-2 font-medium flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" /> Hidden &amp; Idle Funds
          </p>
          <div className="space-y-2">
            {pi.hiddenFunds.slice(0, 6).map((fund, i) => (
              <div key={i} className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2.5",
                fund.actionable ? "border-accent/20 bg-accent/5" : "border-border bg-surface-raised"
              )}>
                <TokenLogo symbol={fund.symbol} logo={fund.logo} size="xs" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-hi truncate">{fund.description}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="text-[10px] rounded px-1.5 py-0.5"
                      style={{ color: fund.chainColor, backgroundColor: `${fund.chainColor}15` }}
                    >
                      {fund.chainEmoji} {fund.chainName}
                    </span>
                    {fund.actionable && <span className="text-[10px] text-accent">Actionable</span>}
                  </div>
                </div>
                <p className="num text-sm font-medium text-text-hi">{formatUSD(fund.usdValue)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Main exported component
// ─────────────────────────────────────────────────────────

export function PortfolioIntelligence({
  pi, portfolio, format, currency, attribution, hasHistory, layout = "tabs", allowedSections, tabPickerStyle = "auto",
}: Props) {
  const tabs = TABS.filter((tab) => !allowedSections || allowedSections.includes(tab.key));
  const [activeTab, setActiveTab] = useState<IntelligenceSection>(tabs[0]?.key ?? "where");
  const [expandedSections, setExpandedSections] = useState<Record<IntelligenceSection, boolean>>({
    where: true,
    change: true,
    risk: true,
    pnl: true,
  });

  const mobileQuickColumns = [
    tabs.slice(0, Math.ceil(tabs.length / 2)),
    tabs.slice(Math.ceil(tabs.length / 2)),
  ];

  const sectionSummaries: Record<IntelligenceSection, string> = {
    where: `${pi.allocation.byToken.filter((token) => token.usdValue > 0).length} assets · ${portfolio.chainAllocations.length} chains`,
    change: `${pi.change24h.totalChange24hPct >= 0 ? "+" : ""}${pi.change24h.totalChange24hPct.toFixed(2)}% today`,
    risk: `${pi.risk.overallState} · ${pi.risk.triggeredFactors.length} factor${pi.risk.triggeredFactors.length === 1 ? "" : "s"}`,
    pnl: `${pi.profit.netTotal >= 0 ? "+" : ""}${formatUSD(pi.profit.netTotal)}`,
  };

  const allExpanded = tabs.every(({ key }) => expandedSections[key]);

  function toggleSection(section: IntelligenceSection) {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  function toggleAllSections() {
    const next = !allExpanded;
    setExpandedSections({
      where: allowedSections ? (allowedSections.includes("where") ? next : false) : next,
      change: allowedSections ? (allowedSections.includes("change") ? next : false) : next,
      risk: allowedSections ? (allowedSections.includes("risk") ? next : false) : next,
      pnl: allowedSections ? (allowedSections.includes("pnl") ? next : false) : next,
    });
  }

  function stepTab(direction: -1 | 1) {
    const index = tabs.findIndex((tab) => tab.key === activeTab);
    const nextIndex = (index + direction + tabs.length) % tabs.length;
    setActiveTab(tabs[nextIndex].key);
  }

  function renderSectionContent(section: IntelligenceSection) {
    if (section === "where") {
      return <AllocationTab pi={pi} portfolio={portfolio} format={format} />;
    }
    if (section === "change") {
      return <ChangeTab pi={pi} format={format} attribution={attribution} hasHistory={hasHistory} />;
    }
    if (section === "risk") {
      return <RiskTab pi={pi} />;
    }
    return <PnlTab pi={pi} portfolio={portfolio} format={format} />;
  }

  return (
    <div className="animate-fade-in">
      <Card noPadding className="overflow-hidden">
        {layout === "accordion" ? (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-accent/8 bg-surface/66 px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-text-hi">
                  <BarChart3 className="h-4 w-4 text-accent" strokeWidth={1.5} />
                  Portfolio Intelligence
                </p>
                <p className="mt-1 text-xs text-text-lo">
                  Read every insight in one vertical flow.
                </p>
              </div>
              <button
                onClick={toggleAllSections}
                className="rounded-lg border border-accent/18 bg-accent/6 px-3 py-1.25 text-[11px] font-medium text-accent transition-colors hover:border-accent/30 hover:bg-accent/9"
              >
                {allExpanded ? "Collapse all" : "Expand all"}
              </button>
            </div>

            <div className="divide-y divide-accent/8">
              {tabs.map(({ key, label, icon: Icon }) => {
                const expanded = expandedSections[key];

                return (
                  <div key={key}>
                    <button
                      onClick={() => toggleSection(key)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/[0.04]"
                      aria-expanded={expanded}
                    >
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-accent/15 bg-accent/8">
                        <Icon className="h-4 w-4 text-accent" strokeWidth={1.6} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-text-hi">{label}</span>
                        <span className="mt-0.5 block truncate text-xs text-text-lo">{sectionSummaries[key]}</span>
                      </span>
                      <span className={cn(
                        "flex items-center text-text-lo transition-colors",
                        expanded && "text-accent",
                      )}>
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </span>
                    </button>

                    {expanded && (
                      <div className="px-4 pb-4">
                        {renderSectionContent(key)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="border-b border-accent/8 bg-surface/54 px-3 py-2.5">
              {tabPickerStyle === "grid" || tabs.length <= 3 ? (
                <div className="grid grid-cols-2 gap-2">
                  {mobileQuickColumns.map((column, index) => (
                    <div key={index} className="space-y-2">
                      {column.map(({ key, label, icon: Icon }) => (
                        <button
                          key={key}
                          onClick={() => setActiveTab(key)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-xl border px-3 py-2.25 text-left transition-colors",
                            activeTab === key
                              ? "border-accent/22 bg-accent/7 text-accent"
                              : "border-accent/7 bg-text-hi/[0.028] text-text-lo hover:text-text-hi"
                          )}
                        >
                          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/10">
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="text-xs font-medium">{label}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => stepTab(-1)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/8 bg-text-hi/[0.03] text-text-lo transition-colors hover:border-accent/18 hover:text-text-hi"
                    aria-label="Previous intelligence question"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => stepTab(1)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-accent/25 bg-accent/8 px-3 py-2 text-left text-accent transition-colors hover:border-accent/40 hover:bg-accent/12"
                    aria-label="Next intelligence question"
                  >
                    {(() => {
                      const active = tabs.find((tab) => tab.key === activeTab)!;
                      const ActiveIcon = active.icon;
                      return (
                        <>
                          <ActiveIcon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate text-sm font-medium">{active.label}</span>
                        </>
                      );
                    })()}
                  </button>

                  <button
                    onClick={() => stepTab(1)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/8 bg-text-hi/[0.03] text-text-lo transition-colors hover:border-accent/18 hover:text-text-hi"
                    aria-label="Next intelligence question"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="p-3.5 sm:p-4">
              {renderSectionContent(activeTab)}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
