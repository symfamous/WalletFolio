"use client";

import { useState, useMemo } from "react";
import {
  Calculator, ChevronDown, TrendingUp, TrendingDown,
  Zap, Layers, Building2,
} from "lucide-react";
import { cn, formatUSD, formatPrice, formatBalance, formatPct } from "@/lib/utils";
import { calcTargetPrice } from "@/lib/aggregate/portfolio";
import { TokenLogo } from "@/components/portfolio/TokenLogo";
import { Card } from "@/components/ui/Card";
import type { Portfolio, AggregatedHolding, SupportedCurrency } from "@/types";
import { MIN_VISIBLE_USD } from "@/types";

const MULTIPLIERS = [2, 5, 10, 25, 50, 100];

interface Props {
  portfolio: Portfolio;
  format:    (usd: number) => string;
  currency:  SupportedCurrency;
}

export function TargetPriceCalculator({ portfolio, format, currency }: Props) {
  const [open,        setOpen]        = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [targetInput, setTargetInput] = useState("");

  const eligible = useMemo(
    () =>
      portfolio.aggregated
        .filter((h) => h.priceAvailable && h.totalUsdValue > MIN_VISIBLE_USD)
        .sort((a, b) => {
          if (a.isStablecoin !== b.isStablecoin) return a.isStablecoin ? 1 : -1;
          return b.totalUsdValue - a.totalUsdValue;
        }),
    [portfolio.aggregated]
  );

  const active: AggregatedHolding | undefined =
    eligible.find((h) => h.aggregateKey === selectedKey) ?? eligible[0];

  const targetPrice = parseFloat(targetInput);
  const valid       = !isNaN(targetPrice) && targetPrice > 0;

  const result = useMemo(() => {
    if (!active || !valid) return null;
    return calcTargetPrice(active, targetPrice, portfolio.summary.totalUsdValue);
  }, [active, targetPrice, valid, portfolio.summary.totalUsdValue]);

  const gain = (result?.tokenGainLoss ?? 0) >= 0;
  const showLocal = currency !== "USD";

  function applyMult(m: number) {
    if (!active?.price) return;
    const r   = active.price * m;
    const dec = r >= 1000 ? 0 : r >= 1 ? 2 : r >= 0.01 ? 4 : 6;
    setTargetInput(r.toFixed(dec));
  }

  function select(h: AggregatedHolding) {
    setSelectedKey(h.aggregateKey);
    setTargetInput("");
    setOpen(false);
  }

  if (eligible.length === 0) return null;

  const isMulti    = (active?.positions.length ?? 0) > 1;
  const chainCount = new Set(active?.positions.map((p) => p.chainSlug)).size ?? 0;
  const hasDefi    = active?.positions.some((p) => p.source === "defi");

  return (
    <Card noPadding className="overflow-hidden animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-accent/25 bg-accent/10">
          <Calculator className="h-4 w-4 text-accent" strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="text-sm font-medium text-text-hi">Target Price Calculator</h3>
          <p className="text-xs text-text-lo">Aggregated balance across all chains + protocols</p>
        </div>
      </div>

      <div className="p-5 space-y-4">

        {/* Token selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium uppercase tracking-widest text-text-lo">Token</label>
          <div className="relative">
            <button
              onClick={() => setOpen((o) => !o)}
              className={cn(
                "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left border bg-surface-raised transition-colors",
                open ? "border-accent/40" : "border-border hover:border-border-subtle"
              )}
            >
              {active ? (
                <>
                  <TokenLogo logo={active.logo} symbol={active.symbol} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium text-text-hi">{active.symbol}</p>
                      {chainCount > 1 && (
                        <span className="text-[10px] text-accent flex items-center gap-0.5">
                          <Layers className="h-3 w-3" /> {chainCount} chains
                        </span>
                      )}
                      {hasDefi && (
                        <span className="text-[10px] text-accent flex items-center gap-0.5">
                          <Building2 className="h-2.5 w-2.5" /> incl. DeFi
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-lo">
                      <span className="num">{formatBalance(active.totalBalance)}</span>
                      {" total · "}
                      <span className="num">{formatPrice(active.price!)}</span>
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="num text-sm font-medium text-text-hi">{formatUSD(active.totalUsdValue)}</p>
                    {showLocal && (
                      <p className="num text-xs text-accent">{format(active.totalUsdValue)}</p>
                    )}
                    {isMulti && <p className="text-[10px] text-accent">combined</p>}
                  </div>
                </>
              ) : (
                <span className="text-sm text-text-lo">Select a token…</span>
              )}
              <ChevronDown className={cn("h-4 w-4 text-text-lo flex-shrink-0 transition-transform", open && "rotate-180")} />
            </button>

            {open && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1.5 rounded-xl border border-border bg-surface-overlay shadow-[0_8px_30px_rgba(0,0,0,0.6)] overflow-hidden">
                <div className="max-h-56 overflow-y-auto">
                  {eligible.map((h) => {
                    const chains = new Set(h.positions.map((p) => p.chainSlug)).size;
                    const defi   = h.positions.some((p) => p.source === "defi");
                    return (
                      <button
                        key={h.aggregateKey}
                        onClick={() => select(h)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-surface-raised transition-colors text-left",
                          selectedKey === h.aggregateKey && "bg-accent/5"
                        )}
                      >
                        <TokenLogo logo={h.logo} symbol={h.symbol} size="xs" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-text-hi">{h.symbol}</p>
                            {chains > 1 && <span className="text-[10px] text-accent">{chains} chains</span>}
                            {defi && <span className="text-[10px] text-accent">+DeFi</span>}
                          </div>
                          <p className="num text-xs text-text-lo">{formatBalance(h.totalBalance)}</p>
                        </div>
                        <div className="text-right">
                          <p className="num text-sm text-text-mid">{formatUSD(h.totalUsdValue, { compact: true })}</p>
                          {showLocal && (
                            <p className="num text-xs text-text-lo">{format(h.totalUsdValue)}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Per-chain breakdown */}
          {active && isMulti && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {active.positions.map((pos) => (
                <span
                  key={pos.id}
                  className="inline-flex items-center gap-1 text-[10px] rounded-md px-2 py-0.5 border"
                  style={{ color: pos.chainColor, borderColor: `${pos.chainColor}30`, backgroundColor: `${pos.chainColor}10` }}
                >
                  {pos.chainEmoji} <span className="num">{formatBalance(pos.balance)}</span>
                  {pos.positionType !== "wallet" && (
                    <span className="opacity-70">({pos.positionType})</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Target price input */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium uppercase tracking-widest text-text-lo">Target Price (USD)</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 num text-sm text-text-lo">$</span>
            <input
              type="number" min="0" step="any"
              placeholder={active?.price ? formatPrice(active.price).replace("$", "") : "0.00"}
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              className="w-full h-10 pl-7 pr-4 rounded-lg num text-sm bg-surface-raised border border-border text-text-hi placeholder:text-text-lo focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>

          {active && (
            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              <span className="flex items-center gap-1 text-[11px] text-text-lo">
                <Zap className="h-3 w-3" /> Quick:
              </span>
              {MULTIPLIERS.map((m) => (
                <button
                  key={m}
                  onClick={() => applyMult(m)}
                  className="num text-[11px] px-2 py-0.5 rounded-md border border-border text-text-lo hover:border-accent/40 hover:text-accent hover:bg-accent/5 transition-colors"
                >
                  {m}×
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Result */}
        {result && valid ? (
          <div className={cn(
            "rounded-xl border p-4 space-y-4 animate-scale-in",
            gain ? "border-success/20 bg-success/5" : "border-danger/20 bg-danger/5"
          )}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-text-mid font-medium">
                  {active!.symbol}
                  {isMulti && (
                    <span className="ml-1 text-[10px] text-accent">
                      ({active!.positions.length} positions combined)
                    </span>
                  )}
                </p>
                <span className={cn("flex items-center gap-1 num text-xs font-semibold", gain ? "text-success" : "text-danger")}>
                  {gain ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {formatPct(result.tokenGainLossPct)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-lg bg-bg/60 p-2.5 text-center">
                  <p className="text-[10px] text-text-lo mb-1">Total held</p>
                  <p className="num text-sm font-semibold text-text-hi">{formatBalance(result.totalBalance)}</p>
                  <p className="text-[10px] text-text-lo mt-0.5">{active!.symbol}</p>
                </div>
                <div className="rounded-lg bg-bg/60 p-2.5 text-center">
                  <p className="text-[10px] text-text-lo mb-1">Current</p>
                  <p className="num text-sm font-semibold text-text-hi">{formatUSD(result.currentTokenValue)}</p>
                  {showLocal && (
                    <p className="num text-[10px] text-accent">{format(result.currentTokenValue)}</p>
                  )}
                </div>
                <div className="rounded-lg bg-bg/60 p-2.5 text-center">
                  <p className="text-[10px] text-text-lo mb-1">At target</p>
                  <p className={cn("num text-sm font-semibold", gain ? "text-success" : "text-danger")}>
                    {formatUSD(result.projectedTokenValue)}
                  </p>
                  {showLocal && (
                    <p className={cn("num text-[10px]", gain ? "text-success" : "text-danger")}>
                      {format(result.projectedTokenValue)}
                    </p>
                  )}
                </div>
              </div>

              <p className={cn("text-center num text-sm font-semibold", gain ? "text-success" : "text-danger")}>
                {gain ? "+" : ""}{formatUSD(result.tokenGainLoss)}
                {showLocal && (
                  <span className="ml-1 text-xs opacity-70">({format(result.tokenGainLoss)})</span>
                )}
                {" "}{gain ? "gain" : "loss"} on {active!.symbol}
              </p>
            </div>

            {/* Portfolio impact */}
            <div className="border-t pt-3.5" style={{ borderColor: "rgb(var(--border) / 0.5)" }}>
              <p className="text-[11px] uppercase tracking-widest text-text-lo mb-2.5 font-medium">
                Portfolio impact
              </p>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="num text-text-mid">
                      {formatUSD(result.currentPortfolioValue, { compact: true })}
                    </span>
                    {showLocal && (
                      <span className="num text-xs text-text-lo ml-1">
                        {format(result.currentPortfolioValue)}
                      </span>
                    )}
                  </div>
                  <span className="text-text-lo">→</span>
                  <div>
                    <span className={cn("num font-semibold", gain ? "text-success" : "text-danger")}>
                      {formatUSD(result.projectedPortfolioValue, { compact: true })}
                    </span>
                    {showLocal && (
                      <span className={cn("num text-xs ml-1", gain ? "text-success" : "text-danger")}>
                        {format(result.projectedPortfolioValue)}
                      </span>
                    )}
                  </div>
                </div>
                <span className={cn("num text-xs font-medium", gain ? "text-success" : "text-danger")}>
                  {gain ? "+" : ""}{formatPct(result.portfolioGainLossPct)}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-text-lo">
                If {active!.symbol} reaches {formatPrice(targetPrice)} — all other positions unchanged
              </p>
            </div>
          </div>
        ) : !valid && active ? (
          <p className="text-center text-xs text-text-lo py-4">
            Enter a target price or tap a multiplier above
          </p>
        ) : null}

      </div>
    </Card>
  );
}
