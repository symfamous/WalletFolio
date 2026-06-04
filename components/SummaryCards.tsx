"use client";

import {
  DollarSign, Coins, Layers, Building2,
  TrendingUp, TrendingDown, AlertTriangle,
} from "lucide-react";
import { cn, formatUSD, formatPct } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { TokenLogo } from "@/components/TokenLogo";
import type { Portfolio, SupportedCurrency } from "@/types";
import { CURRENCY_SYMBOLS } from "@/types";

interface SummaryCardsProps {
  portfolio: Portfolio;
  format:    (usd: number) => string;
  currency:  SupportedCurrency;
}

export function SummaryCards({ portfolio, format, currency }: SummaryCardsProps) {
  const s          = portfolio.summary;
  const symbol     = CURRENCY_SYMBOLS[currency] ?? "$";
  const showLocal  = currency !== "USD";

  const changeUp   = (s.change24h ?? 0) >= 0;
  const changeColor = changeUp ? "text-success" : "text-danger";

  return (
    <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] stagger-children">

      {/* Total portfolio value */}
      <Card accent hoverable className="animate-fade-up p-5">
        <div className="mb-2 flex items-start justify-between">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-accent">
            Portfolio Value
          </p>
          <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-accent/10 border border-accent/20">
            <DollarSign className="h-3.5 w-3.5 text-accent" strokeWidth={1.9} />
          </div>
        </div>

        {/* USD value */}
        <p className="num text-[24px] sm:text-[32px] font-semibold text-text-hi leading-none tracking-tight">
          {formatUSD(s.totalUsdValue)}
        </p>

        {/* Local currency conversion */}
        {showLocal && (
            <p className="num mt-1 text-[11px] text-text-mid leading-none">
            {format(s.totalUsdValue)}
          </p>
        )}

        {/* 24h change */}
        {s.change24h !== undefined ? (
            <span className={cn("mt-2 flex items-center gap-1 text-[11px] font-medium num", changeColor)}>
            {changeUp
              ? <TrendingUp className="h-3.5 w-3.5" />
              : <TrendingDown className="h-3.5 w-3.5" />}
            {formatPct(s.change24h)} (24h)
          </span>
        ) : (
          <span className="mt-2 block text-[11px] text-text-lo">Wallet + DeFi</span>
        )}

        {/* Wallet / DeFi breakdown */}
        <div className="mt-3 space-y-1.5 border-t border-[rgb(var(--card-border)/0.15)] pt-2.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-text-lo">Wallet</span>
            <div className="text-right">
              <span className="num text-text-mid">{formatUSD(s.walletUsdValue, { compact: true })}</span>
              {showLocal && <span className="num text-text-lo ml-1">· {format(s.walletUsdValue)}</span>}
            </div>
          </div>
          {(s.defiNetUsdValue !== 0 || portfolio.protocols.length > 0) && (
            <div className="flex justify-between text-[11px]">
              <span className="text-text-lo">DeFi net</span>
              <div className="text-right">
                <span className={cn("num", s.defiNetUsdValue >= 0 ? "text-text-mid" : "text-danger")}>
                  {s.defiNetUsdValue < 0 ? "-" : ""}{formatUSD(Math.abs(s.defiNetUsdValue), { compact: true })}
                </span>
                {showLocal && (
                  <span className="num text-text-lo ml-1">· {format(Math.abs(s.defiNetUsdValue))}</span>
                )}
              </div>
            </div>
          )}
          {s.totalBorrowUsdValue > 0 && (
            <div className="flex justify-between text-[11px]">
              <span className="flex items-center gap-1 text-text-lo">
                <AlertTriangle className="h-3 w-3 text-danger" /> Borrows
              </span>
              <span className="num text-danger">
                {formatUSD(s.totalBorrowUsdValue, { compact: true })}
              </span>
            </div>
          )}
        </div>

        {/* Largest holding */}
        {s.largestHolding && (
        <div className="mt-2.5 flex items-center gap-2 border-t border-[rgb(var(--card-border)/0.15)] pt-2.5">
            <TokenLogo logo={s.largestHolding.logo} symbol={s.largestHolding.symbol} size="xs" />
            <span className="text-[11px] text-text-lo truncate">
              Largest: <span className="text-text-mid font-medium">{s.largestHolding.symbol}</span>
              {s.largestHolding.totalUsdValue > 0 && (
                <span className="num ml-1">
                  ({showLocal ? format(s.largestHolding.totalUsdValue) : formatUSD(s.largestHolding.totalUsdValue, { compact: true })})
                </span>
              )}
            </span>
          </div>
        )}
      </Card>

      {/* DeFi protocols */}
      <Card hoverable className="animate-fade-up flex h-full flex-col justify-between p-5">
        <div className="mb-2 flex items-start justify-between">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-lo">DeFi</p>
          <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[rgb(var(--card-border)/0.08)] border border-[rgb(var(--card-border)/0.15)]">
            <Building2 className="h-3.5 w-3.5 text-text-mid" strokeWidth={1.5} />
          </div>
        </div>
        <p className="num mb-1 text-[20px] font-semibold text-text-hi leading-none">
          {portfolio.protocols.length}
        </p>
        <p className="text-[11px] text-text-lo">
          <span className="num text-text-mid">{s.activeProtocolCount}</span> protocol{s.activeProtocolCount !== 1 ? "s" : ""}
        </p>
        {s.defiNetUsdValue !== 0 && (
          <p className={cn("num mt-1 text-[11px] font-medium", s.defiNetUsdValue >= 0 ? "text-success" : "text-danger")}>
            {showLocal
              ? format(Math.abs(s.defiNetUsdValue))
              : `${s.defiNetUsdValue < 0 ? "-" : ""}${formatUSD(Math.abs(s.defiNetUsdValue), { compact: true })}`
            } net
          </p>
        )}
      </Card>

      {/* Active chains */}
      <Card hoverable className="animate-fade-up flex h-full flex-col justify-between p-5">
        <div className="mb-2 flex items-start justify-between">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-lo">Chains</p>
          <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[rgb(var(--card-border)/0.08)] border border-[rgb(var(--card-border)/0.15)]">
            <Layers className="h-3.5 w-3.5 text-text-mid" strokeWidth={1.5} />
          </div>
        </div>
        <p className="num mb-1 text-[20px] font-semibold text-text-hi leading-none">
          {s.activeChainCount}
        </p>
        <p className="text-[11px] text-text-lo">networks detected</p>
      </Card>

      {/* Assets */}
      <Card hoverable className="animate-fade-up flex h-full flex-col justify-between p-5">
        <div className="mb-2 flex items-start justify-between">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-lo">Assets</p>
          <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[rgb(var(--card-border)/0.08)] border border-[rgb(var(--card-border)/0.15)]">
            <Coins className="h-3.5 w-3.5 text-text-mid" strokeWidth={1.5} />
          </div>
        </div>
        <p className="num mb-1 text-[20px] font-semibold text-text-hi leading-none">
          {portfolio.aggregated.length}
        </p>
        <p className="text-[11px] text-text-lo">
          <span className="num text-text-mid">{s.pricedAssetCount}</span> priced
          {" · "}
          <span className="num text-text-mid">{s.totalAssetCount - s.pricedAssetCount}</span> unpriced
        </p>
        <p className="mt-1 text-[10px] text-text-lo">Assets ≤ {symbol}5 hidden</p>
      </Card>

    </div>
  );
}
