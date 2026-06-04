"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface TokenLogoProps {
  logo?:     string;
  symbol:    string;
  size?:     "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZE: Record<string, string> = {
  xs: "h-6 w-6 text-[9px]",
  sm: "h-8 w-8 text-[10px]",
  md: "h-10 w-10 text-xs",
  lg: "h-12 w-12 text-sm",
};

// Canonical icons by ticker — used when a position has no logo (or its logo
// fails to load), so e.g. Hyperliquid USDC collateral shows the real USDC mark
// instead of a "US" letter avatar. Same asset → same icon across networks.
const CC_ICONS = "https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons/svg/color";
const SYMBOL_ICON: Record<string, string> = {
  USDC: `${CC_ICONS}/usdc.svg`,
  USDC0: `${CC_ICONS}/usdc.svg`,
  USDT: `${CC_ICONS}/usdt.svg`,
  DAI: `${CC_ICONS}/dai.svg`,
  ETH: "/token-ethereum.svg",
  WETH: "/token-ethereum.svg",
  BTC: "/token-bitcoin.svg",
  WBTC: "/token-bitcoin.svg",
  SOL: "/token-solana.svg",
  HYPE: "/tokens/hype.svg",
  WHYPE: "/tokens/hype.svg",
};

/** Deterministic color from symbol string */
function tokenColor(symbol: string): string {
  const palette = [
    "#3B82F6", "#6366F1", "#8B5CF6", "#00f3ff",
    "#10B981", "#14B8A6", "#ffb4ab", "#EF4444",
    "#F97316", "#06B6D4", "#84CC16", "#A78BFA",
  ];
  let hash = 0;
  for (const ch of (symbol ?? "?")) {
    hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

export function TokenLogo({ logo, symbol, size = "md", className }: TokenLogoProps) {
  // Ordered candidate sources: the position's own logo, then a canonical icon
  // for the ticker. Advance on load error until exhausted, then show initials.
  const symbolIcon = SYMBOL_ICON[(symbol ?? "").toUpperCase()];
  const candidates = [logo, symbolIcon].filter(
    (src, i, arr): src is string => Boolean(src) && arr.indexOf(src) === i
  );
  const [idx, setIdx] = useState(0);

  const initials = (symbol ?? "?").slice(0, 2).toUpperCase();
  const color = tokenColor(symbol ?? "?");
  const current = candidates[idx];

  if (current) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={current}
        alt={symbol}
        width={40}
        height={40}
        className={cn("rounded-full object-cover flex-shrink-0", SIZE[size], className)}
        onError={() => setIdx((i) => i + 1)}
      />
    );
  }

  return (
    <span
      title={symbol}
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-text-hi flex-shrink-0 select-none",
        SIZE[size],
        className
      )}
      style={{ background: color }}
    >
      {initials}
    </span>
  );
}
