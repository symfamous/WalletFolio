"use client";

import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { WalletFolioBrand } from "@/components/brand/WalletFolioBrand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  address?: string;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
}

export function AppHeader({ address, autoRefresh, onToggleAutoRefresh }: AppHeaderProps) {
  return (
    <header
      className="sticky top-0 z-50 w-full border-b bg-bg/90 backdrop-blur-[20px]"
      style={{ borderColor: "rgb(var(--border))" }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-4">

          {/* Brand */}
          <Link
            href="/"
            onClick={() => {
              if (typeof window !== "undefined") {
                sessionStorage.removeItem("walletfolio_entered");
              }
            }}
            className="group flex items-center gap-2.5 hover:opacity-80 transition-opacity flex-shrink-0"
          >
            <WalletFolioBrand size={28} wordmarkClassName="text-[15px]" />
          </Link>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {address && (
              <button
                onClick={onToggleAutoRefresh}
                title={autoRefresh ? "Auto-refresh on — click to pause" : "Auto-refresh paused — click to enable"}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all",
                  autoRefresh
                    ? "text-accent hover:bg-accent/8"
                    : "border-border bg-surface-raised text-text-lo hover:text-text-mid"
                )}
                style={autoRefresh ? {
                  borderColor: "rgb(var(--accent))",
                  background: "rgb(var(--accent) / 0.06)",
                  fontFamily: "var(--font-geist-mono), monospace",
                } : { fontFamily: "var(--font-geist-mono), monospace" }}
              >
                {autoRefresh ? (
                  <><Pause className="h-3 w-3" /><span className="hidden sm:inline">LIVE</span></>
                ) : (
                  <><Play className="h-3 w-3" /><span className="hidden sm:inline">PAUSED</span></>
                )}
              </button>
            )}
            <span
              className="text-xs hidden sm:block"
              style={{ color: "rgb(var(--text-lo))", fontFamily: "var(--font-geist-mono), monospace" }}
            >
              // read-only
            </span>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Auto-refresh accent glow line */}
      {autoRefresh && (
        <div
          className="h-px w-full"
          style={{ background: "linear-gradient(90deg,transparent,rgb(var(--accent)),transparent)", opacity: 0.35 }}
        />
      )}
    </header>
  );
}
