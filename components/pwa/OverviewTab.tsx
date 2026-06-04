"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  TrendingDown,
  TrendingUp,
  Wifi,
  Clock,
  Shield,
  Sparkles,
  Target,
  Layers,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { usePWAData } from "@/components/pwa/PWAContext";
import { PortfolioTimeline } from "@/components/portfolio/PortfolioTimeline";
import { CollapsibleSection } from "@/components/common/CollapsibleSection";
import { DashboardSkeleton } from "@/components/common/Skeleton";
import { useCountUp } from "@/hooks/useCountUp";
import { TabHero } from "@/components/pwa/TabHero";
import { Badge } from "@/components/ui/Badge";
import { getRiskStatePresentation } from "@/lib/riskMonitor";
import { cn, formatUSD, formatPct } from "@/lib/utils";

function StatPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn("flex-1 min-w-0 rounded-xl px-3 py-2.5", accent && "border-accent/25")}
      style={{
        background: accent ? "rgb(var(--accent)/0.12)" : "rgb(var(--text-hi)/0.04)",
        border: `1px solid ${accent ? "rgb(var(--accent)/0.25)" : "rgb(var(--text-hi)/0.07)"}`,
        backdropFilter: "blur(8px)",
      }}
    >
      <p className="text-[10px] text-text-lo uppercase tracking-widest truncate">{label}</p>
      <p className="num text-sm font-semibold text-text-hi leading-snug truncate mt-0.5">{value}</p>
    </div>
  );
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 32;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  const color = positive ? "rgb(var(--success))" : "rgb(var(--danger))";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill="url(#sparkGrad)" />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 3px ${color})` }}
      />
    </svg>
  );
}

function AllocationHeatmap({ items }: { items: Array<{ symbol: string; pct: number }> }) {
  if (items.length === 0) return null;
  const top = items.slice(0, 8);
  const colors = ["#6366F1", "#3B82F6", "#8B5CF6", "#10B981", "#ffb4ab", "#00f3ff", "#06B6D4", "#14B8A6"];

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        border: "1px solid rgb(var(--text-hi)/0.07)",
        background: "rgb(var(--text-hi)/0.03)",
        backdropFilter: "blur(8px)",
      }}
    >
      <p className="text-[10px] text-text-lo uppercase tracking-widest px-4 pt-3 pb-2">Allocation</p>
      <div className="flex h-2 mx-4 rounded-full overflow-hidden mb-3">
        {top.map((item, i) => (
          <div
            key={item.symbol}
            style={{ width: `${item.pct}%`, background: colors[i % colors.length] }}
            title={`${item.symbol} ${item.pct.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 px-4 pb-3">
        {top.map((item, i) => (
          <div key={item.symbol} className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-sm flex-shrink-0" style={{ background: colors[i % colors.length] }} />
            <span className="text-[11px] text-text-mid font-medium">{item.symbol}</span>
            <span className="text-[10px] text-text-lo">{item.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OverviewTab() {
  const {
    portfolio,
    providerStatus,
    isLoading,
    isError,
    error,
    onRefresh,
    chartData,
    snapshotRange,
    setSnapshotRange,
    hasHistory,
    earliestSnapshot,
    clearSnapshots,
    format,
    currency,
    intelligence,
    address,
    viewMode,
    setViewMode,
    visibleSections,
    selectedGoal,
    setSelectedGoal,
    stressSummary,
    goalFitSummary,
    walletCheckupSummary,
    perpsData,
  } = usePWAData();
  const animatedValue = useCountUp(portfolio?.summary.totalUsdValue);
  const showLocal = currency !== "USD";

  if (!address) {
    return (
      <div className="px-4 pt-8 flex flex-col items-center gap-4 text-center">
        <Wallet className="h-7 w-7 text-accent" />
        <p className="text-sm text-text-hi font-medium">No wallet address yet</p>
        <p className="text-xs text-text-mid max-w-[280px]">
          Enter an EVM or Solana address on the Profile tab to view your portfolio.
        </p>
      </div>
    );
  }

  if (isLoading) return <div className="px-4 pt-3"><DashboardSkeleton /></div>;

  if (isError || !portfolio) {
    return (
      <div className="px-4 pt-8 flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="h-7 w-7 text-danger" />
        <p className="text-sm text-text-mid">{error?.message ?? "Failed to load portfolio."}</p>
        <button onClick={onRefresh} className="px-4 py-2 rounded-lg bg-accent/10 border border-accent/20 text-accent text-sm">Retry</button>
      </div>
    );
  }

  const s = portfolio.summary;
  const changeUp = (s.change24h ?? 0) >= 0;
  const sparkValues = chartData.slice(-20).map((d) => d.total);
  const totalVal = s.totalUsdValue || 1;
  const allocItems = portfolio.aggregated
    .filter((h) => h.priceAvailable && h.totalUsdValue > 0)
    .sort((a, b) => b.totalUsdValue - a.totalUsdValue)
    .slice(0, 8)
    .map((h) => ({ symbol: h.symbol, pct: (h.totalUsdValue / totalVal) * 100 }));
  const riskState = intelligence?.risk.overallState ?? "Safe";
  const risk = getRiskStatePresentation(riskState);
  const topReason = intelligence?.risk.topReason ?? "Risk data will appear after the portfolio loads.";

  return (
    <>
      <div className="space-y-4 px-4 pt-0 pb-24">
        <TabHero
          title="Overview"
          address={address}
          totalValue={s.totalUsdValue}
          change24h={s.change24h}
        />

        {providerStatus?.zerion === "partial" && (
          <div className="rounded-xl border border-warning/20 bg-warning/5 px-3 py-2 flex items-center gap-2">
            <Wifi className="h-3.5 w-3.5 text-warning flex-shrink-0" />
            <p className="text-xs text-text-mid">Some data may be incomplete</p>
          </div>
        )}

        <div
          className="rounded-2xl px-5 py-4 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg,rgb(var(--accent)/0.12),rgb(var(--accent)/0.05))",
            border: "1px solid rgb(var(--accent)/0.18)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 4px 24px rgb(var(--accent)/0.07),inset 0 1px 0 rgb(var(--text-hi)/0.05)",
          }}
        >
          <div
            className="absolute -top-6 -right-6 w-28 h-28 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle,rgb(var(--accent) / 0.15),transparent 70%)" }}
          />

          <p className="text-[10px] text-text-lo uppercase tracking-widest mb-1">Portfolio Value</p>
          <p className="num text-[26px] font-bold text-text-hi leading-none sm:text-[30px]">
            ${animatedValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>

          {showLocal ? (
            <p className="num text-sm text-accent mt-0.5 leading-none">{format(s.totalUsdValue)}</p>
          ) : null}

          {s.change24h !== undefined ? (
            <div className={cn("flex items-center gap-1 mt-2 text-xs font-medium num", changeUp ? "text-success" : "text-danger")}>
              {changeUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {formatPct(s.change24h)} (24h)
            </div>
          ) : null}

          {sparkValues.length >= 4 ? (
            <div className="mt-3 -mx-1">
              <Sparkline data={sparkValues} positive={changeUp} />
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StatPill label="Wallet" value={formatUSD(s.walletUsdValue, { compact: true })} />
          <StatPill label="DeFi" value={formatUSD(s.defiNetUsdValue, { compact: true })} />
          <StatPill label="Risk" value={riskState} accent={riskState !== "Safe"} />
        </div>

        {viewMode === "full" && allocItems.length > 0 ? <AllocationHeatmap items={allocItems} /> : null}

        {viewMode === "full" && visibleSections.timeline ? (
          <CollapsibleSection
            id="pwa-timeline"
            icon={Clock}
            title="Timeline"
            badge={hasHistory ? snapshotRange : undefined}
            badgeVariant="accent"
            summary={hasHistory ? `${snapshotRange} · ${chartData.length} snapshots` : "Building..."}
            defaultCollapsed={!hasHistory}
          >
            <PortfolioTimeline
              chartData={chartData}
              range={snapshotRange}
              onRangeChange={setSnapshotRange}
              hasHistory={hasHistory}
              earliestDate={earliestSnapshot}
              onClearHistory={clearSnapshots}
              format={format}
            />
          </CollapsibleSection>
        ) : null}

      </div>
    </>
  );
}
