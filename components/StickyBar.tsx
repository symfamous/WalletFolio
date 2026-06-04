"use client";

import { useEffect, useState } from "react";
import { cn, formatUSD, formatPct } from "@/lib/utils";
import { TrendingUp, TrendingDown, Layers, Building2, Activity } from "lucide-react";
import type { Portfolio } from "@/types";

interface StickyBarProps {
  portfolio:        Portfolio;
  perpUnrealizedPnl: number;
  openPerpCount:    number;
}

export function StickyBar({ portfolio, perpUnrealizedPnl, openPerpCount }: StickyBarProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ticking = false;
    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          setVisible(window.scrollY > 180);
          ticking = false;
        });
        ticking = true;
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const s       = portfolio.summary;
  const changeUp = (s.change24h ?? 0) >= 0;
  const pnlUp    = perpUnrealizedPnl >= 0;

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-out",
      visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
    )}>
      {/* Backdrop blur bar */}
      <div className="border-b border-border/60 bg-bg/80 backdrop-blur-xl shadow-[0_1px_20px_rgba(0,0,0,0.4)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-11 flex items-center gap-4 overflow-x-auto scrollbar-none">

          {/* Portfolio value */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] text-text-lo uppercase tracking-widest hidden sm:block">Portfolio</span>
            <span className="num text-sm font-semibold text-text-hi">{formatUSD(s.totalUsdValue)}</span>
          </div>

          <div className="w-px h-4 bg-border flex-shrink-0" />

          {/* 24h change */}
          {s.change24h !== undefined && (
            <div className={cn("flex items-center gap-1 flex-shrink-0", changeUp ? "text-success" : "text-danger")}>
              {changeUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span className="num text-xs font-medium">{formatPct(s.change24h)}</span>
              {s.change24hAbsolute !== undefined && (
                <span className="num text-xs opacity-80">({changeUp ? "+" : ""}{formatUSD(s.change24hAbsolute)})</span>
              )}
            </div>
          )}

          <div className="w-px h-4 bg-border flex-shrink-0" />

          {/* Active chains */}
          <div className="flex items-center gap-1.5 flex-shrink-0 text-text-mid">
            <Layers className="h-3 w-3 text-text-lo" strokeWidth={1.5} />
            <span className="num text-xs">{s.activeChainCount} chains</span>
          </div>

          {/* Active protocols */}
          {s.activeProtocolCount > 0 && (
            <>
              <div className="w-px h-4 bg-border flex-shrink-0" />
              <div className="flex items-center gap-1.5 flex-shrink-0 text-text-mid">
                <Building2 className="h-3 w-3 text-text-lo" strokeWidth={1.5} />
                <span className="num text-xs">{s.activeProtocolCount} protocols</span>
              </div>
            </>
          )}

          {/* Perp positions */}
          {openPerpCount > 0 && (
            <>
              <div className="w-px h-4 bg-border flex-shrink-0" />
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Activity className="h-3 w-3 text-accent" strokeWidth={1.5} />
                <span className="num text-xs text-text-mid">{openPerpCount} perp{openPerpCount !== 1 ? "s" : ""}</span>
                {perpUnrealizedPnl !== 0 && (
                  <span className={cn("num text-xs font-medium", pnlUp ? "text-success" : "text-danger")}>
                    {pnlUp ? "+" : ""}{formatUSD(perpUnrealizedPnl)}
                  </span>
                )}
              </div>
            </>
          )}

          {/* DeFi value */}
          {s.defiNetUsdValue > 0 && (
            <>
              <div className="w-px h-4 bg-border ml-auto flex-shrink-0" />
              <div className="flex items-center gap-1 flex-shrink-0 text-text-lo">
                <span className="text-[10px] uppercase tracking-widest">DeFi</span>
                <span className="num text-xs text-text-mid">{formatUSD(s.defiNetUsdValue)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}