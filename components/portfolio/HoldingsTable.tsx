"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Search, ChevronDown, ChevronUp, ChevronsUpDown,
  AlertCircle, ArrowUpRight, ArrowDownRight, ChevronRight,
  Layers, Building2, Wallet2,
} from "lucide-react";
import { cn, formatUSD, formatBalance, formatPrice, formatPct } from "@/lib/utils";
import { TokenLogo } from "@/components/portfolio/TokenLogo";
import { Badge } from "@/components/ui/Badge";
import { PositionExplainButton, PositionExplainDrawer } from "@/components/portfolio/PositionExplainDrawer";
import { useHistory } from "@/hooks/useHistory";
import { filterDust, filterPositionsDust } from "@/lib/aggregate/portfolio";
import { buildHoldingAcquisitionInsights, type HoldingAcquisitionInsight } from "@/lib/holdingAcquisition";
import { buildItemExplanation } from "@/lib/positionExplainer";
import type { Portfolio, AggregatedHolding, NormalizedPosition, PositionExplanation, SortField, SortDir, HoldingsView } from "@/types";

// localStorage keys
const LS_PRICED_ONLY = "folio_priced_only";
const LS_HOLDINGS_VIEW = "folio_holdings_view";

interface HoldingsTableProps {
  portfolio: Portfolio;
  address?: string;
  compact?: boolean;
  limit?: number;
  hideSidebar?: boolean;
}

// ─── Sticky sidebar with Chain Allocation + Top Holdings ──────────

function SidebarPanel({
  title, children, defaultOpen = true,
}: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-surface">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between border-b border-accent/10 px-4 py-3 text-left transition-colors hover:bg-accent/[0.05]"
        style={{ borderBottomWidth: open ? undefined : 0 }}
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">{title}</span>
        {open
          ? <ChevronUp className="h-3.5 w-3.5 text-text-lo" />
          : <ChevronDown className="h-3.5 w-3.5 text-text-lo" />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

function HoldingsSidebar({ portfolio }: { portfolio: Portfolio }) {
  const chains = portfolio.chainAllocations?.filter((a) => a.totalUsdValue > 0) ?? [];
  const top    = portfolio.aggregated?.filter((h) => h.totalUsdValue > 0).slice(0, 8) ?? [];
  const total  = portfolio.summary.totalUsdValue;

  if (chains.length === 0 && top.length === 0) return null;

  return (
    <div className="w-[220px] flex-shrink-0 flex flex-col gap-3 sticky top-20">
      {chains.length > 0 && (
        <SidebarPanel title="Chain Allocation">
          <div className="flex flex-col gap-2">
            {chains.slice(0, 10).map((c) => {
              const pct = total > 0 ? (c.totalUsdValue / total) * 100 : 0;
              return (
                <div key={c.chainName} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.chainColor }} />
                      <span className="text-[11px] text-text-mid truncate max-w-[100px]">{c.chainName}</span>
                    </div>
                    <span className="num text-[11px] text-text-hi">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.chainColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        </SidebarPanel>
      )}

      {top.length > 0 && (
        <SidebarPanel title="Top Holdings">
          <div className="flex flex-col gap-2">
            {top.map((h) => {
              const pct = total > 0 ? (h.totalUsdValue / total) * 100 : 0;
              return (
                <div key={h.aggregateKey} className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
                    style={{ background: "rgb(var(--accent) / 0.1)", color: "rgb(var(--accent))", border: "1px solid rgb(var(--accent) / 0.2)" }}
                  >
                    {h.symbol.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-text-hi truncate">{h.symbol}</span>
                      <span className="num text-[10px] text-text-mid">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-border overflow-hidden mt-0.5">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SidebarPanel>
      )}
    </div>
  );
}

// ─── Aggregated row ───────────────────────────────────────────────

function AggRow({
  agg,
  acquisition,
  historyStatus,
  onExplain,
  compact = false,
}: {
  agg: AggregatedHolding;
  acquisition?: HoldingAcquisitionInsight;
  historyStatus: "loading" | "error" | "ready";
  onExplain: (explanation: PositionExplanation) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const changePos = (agg.priceChange24h ?? 0) >= 0;
  const multi     = agg.positions.length > 1;
  const hasDefi   = agg.positions.some((p) => p.source === "defi");
  const singlePosition = agg.positions.length === 1 ? agg.positions[0] : null;
  const pnlUp = (acquisition?.pnlUsd ?? 0) >= 0;
  const acquiredDate = acquisition
    ? new Date(acquisition.firstAcquiredAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <>
      <tr
        className={cn("group transition-colors hover:bg-accent/[0.05]", multi && "cursor-pointer")}
        onClick={() => multi && setOpen((o) => !o)}
      >
        <td className={cn("px-4", compact ? "py-4" : "py-3")}>
          <div className="flex items-center gap-3">
            <TokenLogo logo={agg.logo} symbol={agg.symbol} size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-text-hi">{agg.symbol}</p>
                {hasDefi && (
                  <span className="flex flex-shrink-0 items-center gap-0.5 rounded border border-accent/12 bg-accent/6 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-accent">
                    <Building2 className="h-2.5 w-2.5" /> DeFi
                  </span>
                )}
              </div>
              <p className={cn("truncate text-text-lo", compact ? "mt-0.5 max-w-[150px] text-[11px]" : "max-w-[110px] text-xs")}>{agg.name}</p>
              {acquisition && acquiredDate ? (
                <p className={cn("mt-1 text-[10px] text-text-lo", compact ? "max-w-[170px]" : "max-w-[220px]")}>
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
                <p className={cn("mt-1 text-[10px] text-text-lo", compact ? "max-w-[170px]" : "max-w-[220px]")}>
                  {historyStatus === "loading"
                    ? "Loading buy history..."
                    : historyStatus === "error"
                    ? "Buy history unavailable"
                    : "No buy history found"}
                </p>
              )}
            </div>
          </div>
        </td>
        <td className={cn("px-3", compact ? "py-4" : "py-3")}>
          {agg.positions.length === 1 ? (
            <Badge variant="chain" color={agg.positions[0].chainColor}>
              {agg.positions[0].chainEmoji} {agg.positions[0].chainName}
            </Badge>
          ) : (
            <span className="text-xs text-text-mid">{agg.positions.length} sources</span>
          )}
        </td>
        <td className={cn("px-3", compact ? "py-4" : "py-3")}>
          <p className="num text-sm text-text-hi">{formatBalance(agg.totalBalance)}</p>
          {agg.defiBalance > 0 && agg.walletBalance > 0 && (
            <p className="num text-[10px] text-text-lo">
              {formatBalance(agg.walletBalance)} wallet · {formatBalance(agg.defiBalance)} DeFi
            </p>
          )}
        </td>
        <td className={cn("px-3", compact ? "py-4" : "py-3")}>
          {agg.priceAvailable
            ? <p className="num text-sm text-text-hi">{formatPrice(agg.price!)}</p>
            : <span className="flex items-center gap-1 text-xs text-text-lo"><AlertCircle className="h-3 w-3" /> N/A</span>
          }
        </td>
        <td className={cn("px-3", compact ? "py-4" : "py-3")}>
          {agg.priceChange24h !== undefined
            ? <span className={cn("inline-flex items-center gap-0.5 num text-xs font-medium", changePos ? "text-success" : "text-danger")}>
                {changePos ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {formatPct(agg.priceChange24h)}
              </span>
            : <span className="text-xs text-text-lo">—</span>
          }
        </td>
        <td className={cn("px-4 text-right", compact ? "py-4" : "py-3")}>
          <div className="flex items-center justify-end gap-2">
            {singlePosition ? (
              <PositionExplainButton
                onClick={() => onExplain(buildItemExplanation({ kind: "position", item: singlePosition }))}
                className="h-6 w-6"
                label={`Explain ${singlePosition.symbol}`}
              />
            ) : null}
            {agg.totalUsdValue > 0
              ? <p className="num text-sm font-medium text-text-hi">{formatUSD(agg.totalUsdValue)}</p>
              : <p className="text-xs text-text-lo italic">Unpriced</p>
            }
            {multi && <ChevronRight className={cn("h-3.5 w-3.5 text-text-lo transition-transform", open && "rotate-90")} />}
          </div>
        </td>
      </tr>

      {open && agg.positions.map((pos) => (
        <tr key={pos.id} className="bg-accent/4" style={{ borderLeft: `2px solid ${pos.chainColor}50` }}>
          <td className="px-4 py-2 pl-14">
            <p className="text-xs text-text-mid">{pos.symbol}</p>
            {pos.protocolName && (
              <p className="text-[9px] text-accent flex items-center gap-0.5">
                <Building2 className="h-2.5 w-2.5" /> {pos.protocolName}
              </p>
            )}
          </td>
          <td className="px-3 py-2">
            <Badge variant="chain" color={pos.chainColor}>{pos.chainEmoji} {pos.chainName}</Badge>
            {pos.positionType !== "wallet" && (
              <p className="text-[9px] text-text-lo capitalize mt-0.5">{pos.positionType}</p>
            )}
          </td>
          <td className="px-3 py-2"><p className="num text-xs text-text-mid">{formatBalance(pos.balance)}</p></td>
          <td /><td />
          <td className="px-4 py-2 text-right">
            <div className="flex items-center justify-end gap-2">
              <PositionExplainButton
                onClick={() => onExplain(buildItemExplanation({ kind: "position", item: pos }))}
                className="h-6 w-6"
                label={`Explain ${pos.symbol}`}
              />
              {pos.usdValue !== undefined && (
                <p className="num text-xs text-text-mid">{formatUSD(pos.usdValue)}</p>
              )}
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── Flat row ─────────────────────────────────────────────────────

function FlatRow({
  pos,
  onExplain,
  compact = false,
}: {
  pos: NormalizedPosition;
  onExplain: (explanation: PositionExplanation) => void;
  compact?: boolean;
}) {
  const changePos = (pos.priceChange24h ?? 0) >= 0;
  return (
    <tr className="group transition-colors hover:bg-accent/[0.05]">
      <td className={cn("px-4", compact ? "py-4" : "py-3")}>
        <div className="flex items-center gap-3">
          <TokenLogo logo={pos.logo} symbol={pos.symbol} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-hi">{pos.symbol}</p>
            <div className="flex items-center gap-1">
              <p className={cn("truncate text-text-lo", compact ? "max-w-[130px] text-[11px]" : "max-w-[90px] text-xs")}>{pos.name}</p>
              {pos.positionType !== "wallet" && (
                <span className="text-[9px] text-accent capitalize">{pos.positionType}</span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className={cn("px-3", compact ? "py-4" : "py-3")}>
        <Badge variant="chain" color={pos.chainColor}>{pos.chainEmoji} {pos.chainName}</Badge>
        {pos.protocolName && (
          <p className="text-[10px] text-accent mt-0.5 flex items-center gap-0.5">
            <Building2 className="h-2.5 w-2.5" /> {pos.protocolName}
          </p>
        )}
      </td>
      <td className={cn("px-3", compact ? "py-4" : "py-3")}><p className="num text-sm text-text-hi">{formatBalance(pos.balance)}</p></td>
      <td className={cn("px-3", compact ? "py-4" : "py-3")}>
        {pos.priceAvailable
          ? <p className="num text-sm text-text-hi">{formatPrice(pos.price!)}</p>
          : <span className="flex items-center gap-1 text-xs text-text-lo"><AlertCircle className="h-3 w-3" /> N/A</span>
        }
      </td>
      <td className={cn("px-3", compact ? "py-4" : "py-3")}>
        {pos.priceChange24h !== undefined
          ? <span className={cn("inline-flex items-center gap-0.5 num text-xs font-medium", changePos ? "text-success" : "text-danger")}>
              {changePos ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {formatPct(pos.priceChange24h)}
            </span>
          : <span className="text-xs text-text-lo">—</span>
        }
      </td>
      <td className={cn("px-4 text-right", compact ? "py-4" : "py-3")}>
        <div className="flex items-center justify-end gap-2">
          <PositionExplainButton
            onClick={() => onExplain(buildItemExplanation({ kind: "position", item: pos }))}
            className="h-6 w-6"
            label={`Explain ${pos.symbol}`}
          />
          {pos.usdValue !== undefined
            ? <p className="num text-sm font-medium text-text-hi">{formatUSD(pos.usdValue)}</p>
            : <p className="text-xs text-text-lo italic">Unpriced</p>
          }
        </div>
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────

export function HoldingsTable({ portfolio, address, compact = false, limit = 5, hideSidebar = false }: HoldingsTableProps) {
  const { aggregated, walletPositions, defiPositions } = portfolio;
  const history = useHistory(address);

  const [search,       setSearch]       = useState("");
  const [sortField,    setSortField]    = useState<SortField>("value");
  const [sortDir,      setSortDir]      = useState<SortDir>("desc");
  const [selectedExplanation, setSelectedExplanation] = useState<PositionExplanation | null>(null);

  // Persisted state — loaded from localStorage on mount
  const [view,         setView]         = useState<HoldingsView>("aggregated");
  const [hideUnpriced, setHideUnpriced] = useState(false);

  useEffect(() => {
    const savedPriced = localStorage.getItem(LS_PRICED_ONLY);
    if (savedPriced !== null) setHideUnpriced(savedPriced === "true");
    const savedView = localStorage.getItem(LS_HOLDINGS_VIEW) as HoldingsView | null;
    if (savedView && ["aggregated","wallet","defi"].includes(savedView)) setView(savedView);
  }, []);

  function toggleHideUnpriced(val: boolean) {
    setHideUnpriced(val);
    localStorage.setItem(LS_PRICED_ONLY, String(val));
  }

  function changeView(v: HoldingsView) {
    setView(v);
    localStorage.setItem(LS_HOLDINGS_VIEW, v);
  }

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortField(field); setSortDir("desc"); }
  }

  const filteredAgg = useMemo(() => {
    // Apply dust filter first (hides zero-balance, unpriced junk, and ≤$5 dust)
    let rows = filterDust(aggregated);
    const q  = search.trim().toLowerCase();
    if (q)            rows = rows.filter((t) => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));
    if (hideUnpriced) rows = rows.filter((t) => t.priceAvailable);

    rows.sort((a, b) => {
      const d = sortDir === "desc" ? 1 : -1;
      switch (sortField) {
        case "value":   return d * (b.totalUsdValue - a.totalUsdValue);
        case "balance": return d * (b.totalBalance - a.totalBalance);
        case "price":   return d * ((b.price ?? -1) - (a.price ?? -1));
        case "change":  return d * ((b.priceChange24h ?? -Infinity) - (a.priceChange24h ?? -Infinity));
        case "symbol":  return d * a.symbol.localeCompare(b.symbol);
        default:        return 0;
      }
    });
    return rows;
  }, [aggregated, search, hideUnpriced, sortField, sortDir]);
  const acquisitionInsights = useMemo(
    () => buildHoldingAcquisitionInsights(aggregated, history.events),
    [aggregated, history.events]
  );
  const historyStatus = history.isLoading || history.isFetching
    ? "loading"
    : history.isError
    ? "error"
    : "ready";

  const filteredFlat = useMemo(() => {
    const base = view === "wallet" ? walletPositions : defiPositions;
    let rows   = filterPositionsDust(base);
    const q    = search.trim().toLowerCase();
    if (q)            rows = rows.filter((p) => p.symbol.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
    if (hideUnpriced) rows = rows.filter((p) => p.priceAvailable);

    rows.sort((a, b) => {
      const d = sortDir === "desc" ? 1 : -1;
      switch (sortField) {
        case "value":   return d * ((b.usdValue ?? -1) - (a.usdValue ?? -1));
        case "balance": return d * (b.balance - a.balance);
        case "price":   return d * ((b.price ?? -1) - (a.price ?? -1));
        case "change":  return d * ((b.priceChange24h ?? -Infinity) - (a.priceChange24h ?? -Infinity));
        case "symbol":  return d * a.symbol.localeCompare(b.symbol);
        default:        return 0;
      }
    });
    return rows;
  }, [walletPositions, defiPositions, view, search, hideUnpriced, sortField, sortDir]);

  function TH({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) {
    return (
      <th onClick={() => toggleSort(field)} className={cn(
        "px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.12em] cursor-pointer select-none whitespace-nowrap hover:text-text-mid transition-colors",
        sortField === field ? "text-accent" : "text-text-lo", className
      )}>
        <span className="inline-flex items-center gap-0.5">
          {children}
          {sortField !== field
            ? <ChevronsUpDown className="h-3 w-3 text-text-lo ml-0.5" />
            : sortDir === "desc"
            ? <ChevronDown className="h-3 w-3 text-accent ml-0.5" />
            : <ChevronUp className="h-3 w-3 text-accent ml-0.5" />}
        </span>
      </th>
    );
  }

  const effectiveView: HoldingsView = compact ? "aggregated" : view;
  const previewAgg = compact ? filteredAgg.slice(0, limit) : filteredAgg;
  const previewFlat = compact ? filteredFlat.slice(0, limit) : filteredFlat;
  const count    = effectiveView === "aggregated" ? previewAgg.length : previewFlat.length;
  // Count what's hidden for transparency
  const rawDustHidden = view === "aggregated"
    ? Math.max(0, aggregated.length - filterDust(aggregated).length)
    : 0;

  return (
    <div className="flex gap-4 items-start animate-fade-up">
      {/* ── Main table ── */}
      <div className="flex-1 min-w-0 overflow-hidden rounded-[12px] border border-border bg-surface shadow-card">
        {/* Toolbar */}
        {!compact ? (
          <div className="flex flex-col gap-2.5 border-b border-accent/8 bg-surface/66 p-3.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-lo" />
            <input
              type="text" placeholder="Search tokens…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-accent/12 bg-text-hi/[0.03] pl-9 pr-3 text-sm text-text-hi placeholder:text-text-lo transition-colors focus:border-accent/40 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center overflow-hidden rounded-lg border border-accent/12 bg-text-hi/[0.03] text-xs">
              {(["aggregated", "wallet", "defi"] as HoldingsView[]).map((v) => (
                <button key={v} onClick={() => changeView(v)} className={cn(
                  "flex items-center gap-1 px-3 py-1.5 transition-colors capitalize",
                  view === v ? "bg-accent/20 text-accent" : "text-text-lo hover:bg-accent/[0.04] hover:text-text-mid"
                )}>
                  {v === "aggregated" && <Layers className="h-3 w-3" />}
                  {v === "wallet"     && <Wallet2 className="h-3 w-3" />}
                  {v === "defi"       && <Building2 className="h-3 w-3" />}
                  {v}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-1.5 text-xs text-text-mid cursor-pointer hover:text-text-hi select-none">
              <input
                type="checkbox"
                checked={hideUnpriced}
                onChange={(e) => toggleHideUnpriced(e.target.checked)}
                className="accent-accent h-3 w-3"
              />
              Priced only
            </label>

            <span className="ml-auto num text-xs text-text-lo">
              {count} shown
              {rawDustHidden > 0 && (
                <span className="ml-1 text-text-lo">· {rawDustHidden} hidden</span>
              )}
            </span>
          </div>
        </div>
        ) : (
          <div className="flex items-center justify-between border-b border-accent/8 bg-surface/62 px-5 py-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent">Top Holdings</p>
            <span className="text-[9px] uppercase tracking-[0.14em] text-text-lo">{filteredAgg.length} assets</span>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-accent/8 bg-surface/80">
                <TH field="symbol" className="pl-4 w-[180px]">Asset</TH>
                <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.12em] text-text-lo">Source</th>
                <TH field="balance">{view === "aggregated" ? "Total" : "Balance"}</TH>
                <TH field="price">Price</TH>
                <TH field="change">24h</TH>
                <TH field="value" className="pr-4 text-right">Value</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-accent/8">
              {count === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-text-lo">
                    No assets match your filters
                  </td>
                </tr>
              ) : effectiveView === "aggregated" ? (
                previewAgg.map((agg) => (
                  <AggRow
                    key={agg.aggregateKey}
                    agg={agg}
                    acquisition={acquisitionInsights[agg.aggregateKey]}
                    historyStatus={historyStatus}
                    compact={compact}
                    onExplain={(explanation) => setSelectedExplanation(explanation)}
                  />
                ))
              ) : (
                previewFlat.map((pos) => (
                  <FlatRow
                    key={pos.id}
                    pos={pos}
                    compact={compact}
                    onExplain={(explanation) => setSelectedExplanation(explanation)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Sidebar panels (Chain Allocation + Top Holdings) ── */}
      {!compact && !hideSidebar ? <HoldingsSidebar portfolio={portfolio} /> : null}

      <PositionExplainDrawer
        open={selectedExplanation !== null}
        explanation={selectedExplanation}
        onClose={() => setSelectedExplanation(null)}
      />
    </div>
  );
}
