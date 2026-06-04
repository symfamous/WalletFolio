"use client";

import { cn, formatUSD, shortenAddress } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface TabHeroProps {
  title:        string;
  subtitle?:    string;
  address?:     string;
  totalValue?:  number;
  change24h?:   number;
  className?:   string;
}

export function TabHero({
  title, subtitle, address, totalValue, change24h, className,
}: TabHeroProps) {
  const changeUp = (change24h ?? 0) >= 0;

  return (
    <div className={cn("pt-5 pb-4 text-center", className)}>

      {/* 1. Brand header — largest, glowing, most prominent */}
      <p
        className="text-[10px] font-black tracking-[0.25em] uppercase leading-none"
        style={{
          background: "linear-gradient(90deg,rgb(var(--accent)) 0%,rgb(var(--success)) 45%,rgb(var(--accent-hover)) 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor:  "transparent",
          backgroundClip: "text",
          filter: "drop-shadow(0 0 10px rgb(var(--accent) / 0.45))",
        }}
      >
        WALLETFOLIO PORTFOLIO TRACKER
      </p>

      {/* small gap */}
      <div className="h-3" />

      {/* 2. Page title — secondary, bold */}
      <h1
        className="text-[22px] font-bold text-text-hi leading-none tracking-tight"
      >
        {title}
      </h1>

      {/* Optional subtitle */}
      {subtitle && !address && (
        <p className="text-xs text-text-lo mt-1">{subtitle}</p>
      )}

      {/* medium gap */}
      <div className="h-3.5" />

      {/* 3. Wallet info row — smallest, informational */}
      {address && (
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <span className="num text-[11px] text-text-lo font-mono">
            {shortenAddress(address)}
          </span>
          {totalValue !== undefined && (
            <>
              <span className="text-text-lo/30 text-[10px]">·</span>
              <span className="num text-[11px] font-semibold text-text-mid">
                {formatUSD(totalValue)}
              </span>
            </>
          )}
          {change24h !== undefined && (
            <span className={cn(
              "num text-[10px] flex items-center gap-0.5 font-medium",
              changeUp ? "text-success" : "text-danger"
            )}>
              {changeUp
                ? <TrendingUp className="h-2.5 w-2.5" />
                : <TrendingDown className="h-2.5 w-2.5" />}
              {change24h >= 0 ? "+" : ""}{change24h.toFixed(2)}%
            </span>
          )}
        </div>
      )}

      {/* Soft glow separator */}
      <div
        className="mx-auto mt-4 h-px rounded-full"
        style={{
          width: "80px",
          background: "linear-gradient(90deg,transparent,rgb(var(--accent) / 0.35),transparent)",
        }}
      />
    </div>
  );
}
