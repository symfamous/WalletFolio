"use client";

import { useState, useMemo } from "react";
import { usePWAData } from "@/components/pwa/PWAContext";
import { ChainBreakdown } from "@/components/portfolio/ChainBreakdown";
import { DashboardSkeleton } from "@/components/common/Skeleton";
import { TokenLogo } from "@/components/portfolio/TokenLogo";
import { useHistory } from "@/hooks/useHistory";
import { PositionExplainButton, PositionExplainDrawer } from "@/components/portfolio/PositionExplainDrawer";
import { TabHero } from "@/components/pwa/TabHero";
import { filterDust } from "@/lib/aggregate/portfolio";
import { buildHoldingAcquisitionInsights, type HoldingAcquisitionInsight } from "@/lib/holdingAcquisition";
import { buildItemExplanation } from "@/lib/positionExplainer";
import {
  Search, ArrowUpRight, ArrowDownRight, AlertCircle,
  Layers, ChevronDown,
} from "lucide-react";
import { cn, formatUSD, formatBalance, formatPrice, formatPct } from "@/lib/utils";
import type { AggregatedHolding, PositionExplanation } from "@/types";

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-0">
      <div className="skeleton h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="skeleton h-3 w-16 rounded" />
        <div className="skeleton h-2.5 w-24 rounded" />
      </div>
      <div className="text-right space-y-1.5">
        <div className="skeleton h-3 w-14 rounded ml-auto" />
        <div className="skeleton h-2.5 w-10 rounded ml-auto" />
      </div>
    </div>
  );
}

function HoldingRow({
  agg,
  compact,
  acquisition,
  historyStatus,
  onExplain,
}: {
  agg: AggregatedHolding;
  compact: boolean;
  acquisition?: HoldingAcquisitionInsight;
  historyStatus: "loading" | "error" | "ready";
  onExplain: (agg: AggregatedHolding) => void;
}) {
  const [open, setOpen] = useState(false);
  const changeUp = (agg.priceChange24h ?? 0) >= 0;
  const hasBreakdown = agg.positions.length > 1;
  const pnlUp = (acquisition?.pnlUsd ?? 0) >= 0;
  const acquiredDate = acquisition
    ? new Date(acquisition.firstAcquiredAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="border-b border-border/30 last:border-0">
      <button
        onClick={() => hasBreakdown && setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-text-hi/[0.03] transition-colors"
      >
        <TokenLogo logo={agg.logo} symbol={agg.symbol} size="sm" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-text-hi leading-none">{agg.symbol}</p>
            {agg.positions.some((p) => p.source === "defi") && (
              <span className="text-[9px] bg-accent/10 border border-accent/20 text-accent rounded px-1 py-0.5 flex-shrink-0 leading-none">DeFi</span>
            )}
          </div>
          <p className="text-[11px] text-text-lo mt-0.5 truncate">
            {agg.positions.length === 1
              ? `${agg.positions[0].chainEmoji} ${agg.positions[0].chainName} · ${formatBalance(agg.totalBalance)}`
              : `${agg.positions.length} chains · ${formatBalance(agg.totalBalance)}`}
          </p>
          {acquisition && acquiredDate ? (
            <p className="mt-1 text-[10px] text-text-lo">
              {acquisition.firstAcquiredLabel} {acquiredDate}
              {acquisition.pnlUsd !== undefined ? (
                <span className={cn("num ml-1 font-medium", pnlUp ? "text-success" : "text-danger")}>
                  {pnlUp ? "+" : ""}{formatUSD(acquisition.pnlUsd)}
                  {acquisition.pnlPct !== undefined ? ` (${formatPct(acquisition.pnlPct)})` : ""}
                </span>
              ) : (
                <span className="ml-1">PnL unavailable</span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-[10px] text-text-lo">
              {historyStatus === "loading"
                ? "Loading buy history..."
                : historyStatus === "error"
                ? "Buy history unavailable"
                : "No buy history found"}
            </p>
          )}
        </div>

        <div className="text-right flex-shrink-0 min-w-[96px]">
          <p className="num text-sm font-medium text-text-hi leading-none">
            {agg.priceAvailable ? formatUSD(agg.totalUsdValue) : "—"}
          </p>

          {agg.priceAvailable ? (
            <div className="mt-0.5 flex items-center justify-end gap-1.5">
              <p className="num text-[11px] text-text-lo">@ {formatPrice(agg.price!)}</p>
              {agg.priceChange24h !== undefined && (
                <span className={cn(
                  "num text-[10px] flex items-center gap-0.5 rounded-full px-1.5 py-0.5",
                  changeUp ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
                )}>
                  {changeUp ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                  {formatPct(agg.priceChange24h)}
                </span>
              )}
            </div>
          ) : (
            <span className="mt-0.5 text-[11px] text-text-lo flex items-center justify-end gap-0.5">
              <AlertCircle className="h-2.5 w-2.5" /> N/A
            </span>
          )}
        </div>

        <PositionExplainButton
          onClick={() => onExplain(agg)}
          className="flex-shrink-0"
          label={`Explain ${agg.symbol}`}
        />

        {hasBreakdown && (
          <ChevronDown className={cn("h-3.5 w-3.5 text-text-lo flex-shrink-0 transition-transform duration-200", open && "rotate-180")} />
        )}
      </button>

      {open && !compact && (
        <div className="mx-4 mb-2 rounded-xl border border-border/50 bg-[rgb(var(--surface-raised)/0.6)] divide-y divide-border/30 text-xs overflow-hidden">
          {agg.positions.map((p, i) => (
            <div key={i} className="flex justify-between px-3 py-2">
              <span className="text-text-lo">{p.chainEmoji} {p.chainName}{p.source === "defi" ? " · DeFi" : ""}</span>
              <span className="num text-text-mid">{formatBalance(p.balance)} {agg.symbol}</span>
            </div>
          ))}
          {agg.priceAvailable && (
            <>
              <div className="flex justify-between px-3 py-2">
                <span className="text-text-lo">Price</span>
                <span className="num text-text-mid">{formatPrice(agg.price!)}</span>
              </div>
              {agg.priceChange24h !== undefined && (
                <div className="flex justify-between px-3 py-2">
                  <span className="text-text-lo">24h</span>
                  <span className={cn("num", changeUp ? "text-success" : "text-danger")}>{formatPct(agg.priceChange24h)}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function HoldingsTab() {
  const { portfolio, isLoading, address, visibleSections } = usePWAData();
  const history = useHistory(address);
  const [search, setSearch] = useState("");
  const [pricedOnly, setPricedOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [selectedExplanation, setSelectedExplanation] = useState<PositionExplanation | null>(null);
  const compactMode = !visibleSections.detailedHoldings;

  const filtered = useMemo(() => {
    if (!portfolio) return [];
    let items = filterDust(portfolio.aggregated);
    if (pricedOnly) items = items.filter((h) => h.priceAvailable);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((h) => h.symbol.toLowerCase().includes(q) || h.name.toLowerCase().includes(q));
    }
    return items;
  }, [portfolio, pricedOnly, search]);
  const acquisitionInsights = useMemo(
    () => portfolio ? buildHoldingAcquisitionInsights(portfolio.aggregated, history.events) : {},
    [portfolio, history.events]
  );
  const historyStatus = history.isLoading || history.isFetching
    ? "loading"
    : history.isError
    ? "error"
    : "ready";

  const visible = showAll ? filtered : filtered.slice(0, compactMode ? 10 : 20);
  const s = portfolio?.summary;

  if (isLoading) {
    return (
      <div className="pb-24">
        <div className="px-4"><TabHero title="Holdings" address={address} /></div>
        <div className="mx-4 rounded-xl border border-border bg-surface overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    );
  }
  if (!portfolio) return null;

  return (
    <div className="space-y-3 pb-24">
      <div className="px-4">
        <TabHero title="Holdings" address={address} totalValue={portfolio.summary.totalUsdValue} subtitle={`${filtered.length} assets`} />
      </div>

      <div className="px-4 grid grid-cols-3 gap-2">
        {[
          { label: "Total", value: formatUSD(s!.totalUsdValue, { compact: true }) },
          { label: "Wallet", value: formatUSD(s!.walletUsdValue, { compact: true }) },
          { label: "DeFi", value: formatUSD(s!.defiNetUsdValue, { compact: true }) },
        ].map(({ label, value }) => (
          <div key={label}
            className="rounded-xl px-3 py-2.5 text-center"
            style={{ background: "rgb(var(--text-hi)/0.03)", border: "1px solid rgb(var(--text-hi)/0.07)", backdropFilter: "blur(8px)" }}
          >
            <p className="text-[10px] text-text-lo uppercase tracking-widest">{label}</p>
            <p className="num text-sm font-semibold text-text-hi mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {!compactMode ? (
        <div className="px-4">
          <ChainBreakdown allocations={portfolio.chainAllocations} totalValue={s!.totalUsdValue} />
        </div>
      ) : null}

      <div className="px-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-lo" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tokens…"
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-surface-raised text-sm text-text-hi placeholder:text-text-lo focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>
          <button
            onClick={() => setPricedOnly((p) => !p)}
            className={cn(
              "px-3 py-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap",
              pricedOnly ? "border-accent/30 bg-accent/10 text-accent" : "border-border bg-surface-raised text-text-lo",
            )}
          >
            Priced
          </button>
        </div>
        {compactMode ? (
          <p className="text-xs text-text-lo">The most useful holdings stay up front here, with the deeper table expanding below when needed.</p>
        ) : null}
      </div>

      <div className="mx-4 rounded-xl border border-border bg-surface overflow-hidden">
        <div className="flex items-center px-4 py-2 border-b border-border/50 bg-surface-raised/30">
          <Layers className="h-3.5 w-3.5 text-text-lo mr-2" strokeWidth={1.5} />
          <p className="text-xs text-text-lo">{filtered.length} asset{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-8">
            <AlertCircle className="h-6 w-6 text-text-mid mb-2" strokeWidth={1.5} />
            <p className="text-sm text-text-lo">No assets found</p>
          </div>
        ) : (
          <>
            {visible.map((agg) => (
              <HoldingRow
                key={`${agg.symbol}-${agg.name}`}
                agg={agg}
                compact={compactMode}
                acquisition={acquisitionInsights[agg.aggregateKey]}
                historyStatus={historyStatus}
                onExplain={(holding) => setSelectedExplanation(buildItemExplanation({ kind: "position", item: holding.positions[0] }))}
              />
            ))}
            {!showAll && filtered.length > (compactMode ? 10 : 20) && (
              <button onClick={() => setShowAll(true)}
                className="w-full px-4 py-3 text-xs text-text-mid hover:text-text-hi border-t border-border/40 flex items-center justify-center gap-1.5">
                <ChevronDown className="h-3.5 w-3.5" /> Show {filtered.length - (compactMode ? 10 : 20)} more
              </button>
            )}
          </>
        )}
      </div>

      <PositionExplainDrawer
        open={selectedExplanation !== null}
        explanation={selectedExplanation}
        onClose={() => setSelectedExplanation(null)}
      />
    </div>
  );
}
