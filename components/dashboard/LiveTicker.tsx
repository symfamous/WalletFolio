"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveMids } from "@/hooks/useLiveMids";
import { cn } from "@/lib/utils";

const BASE_SYMBOLS = ["BTC", "ETH", "SOL", "HYPE"];

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toPrecision(2)}`;
}

function TickerItem({ symbol, price }: { symbol: string; price: number }) {
  const prev = useRef(price);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (price > prev.current) setFlash("up");
    else if (price < prev.current) setFlash("down");
    prev.current = price;
    if (price === prev.current) return;
    const t = setTimeout(() => setFlash(null), 700);
    return () => clearTimeout(t);
  }, [price]);

  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-[11px] font-medium text-text-mid">{symbol}</span>
      <span
        className={cn(
          "num text-[11px] font-medium transition-colors duration-300",
          flash === "up" ? "text-success" : flash === "down" ? "text-danger" : "text-text-hi"
        )}
      >
        {formatPrice(price)}
      </span>
    </div>
  );
}

/**
 * Live price ticker streamed from Hyperliquid's websocket (free). Shows majors
 * plus any of the user's holdings that Hyperliquid lists, updating in real time.
 * Shared by desktop + PWA. Renders nothing until the first prices arrive.
 */
export function LiveTicker({ symbols = [], className }: { symbols?: string[]; className?: string }) {
  const { mids, connected } = useLiveMids();

  const wanted = [...new Set([...BASE_SYMBOLS, ...symbols.map((s) => s.toUpperCase())])]
    .filter((s) => typeof mids[s] === "number")
    .slice(0, 14);

  if (wanted.length === 0) return null;

  // Duplicate the row so the -50% marquee loops seamlessly.
  const track = [...wanted, ...wanted];

  return (
    <div className={cn("flex items-center gap-3 overflow-hidden rounded-[12px] border border-border bg-surface px-3 py-2 shadow-card", className)}>
      <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
        <span className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-success animate-pulse" : "bg-text-lo")} />
        <span className="text-[10px] uppercase tracking-wide text-text-lo">Live</span>
      </span>
      <div className="marquee-track relative min-w-0 flex-1 overflow-hidden">
        <div className="animate-marquee flex w-max items-center gap-3.5" aria-hidden={false}>
          {track.map((symbol, i) => (
            <TickerItem key={`${symbol}-${i}`} symbol={symbol} price={mids[symbol]} />
          ))}
        </div>
      </div>
    </div>
  );
}
