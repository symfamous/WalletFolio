"use client";

import { Bell, RefreshCw, ShieldAlert, ShieldCheck, Settings } from "lucide-react";
import { WalletFolioBrand } from "@/components/brand/WalletFolioBrand";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { cn } from "@/lib/utils";
import { usePWAData } from "@/components/pwa/PWAContext";

interface PWATopBarProps {
  onBrandClick: () => void;
  onRiskClick?: () => void;
  riskLevel?: "safe" | "moderate" | "risky" | "critical";
  onAlertClick?: () => void;
  alertBadge?: number;
  onSettingsClick?: () => void;
}

export function PWATopBar({
  onBrandClick,
  onRiskClick,
  riskLevel = "safe",
  onAlertClick,
  alertBadge = 0,
  onSettingsClick,
}: PWATopBarProps) {
  const { isFetching, onRefresh, autoRefresh } = usePWAData();
  const RiskIcon = riskLevel === "safe" ? ShieldCheck : ShieldAlert;
  const riskColor = riskLevel === "safe" ? "rgb(var(--text-lo))" : riskLevel === "moderate" ? "#7C5E1A" : riskLevel === "risky" ? "#B86A1C" : "#A33C52";
  const riskHover = riskLevel === "safe" ? "rgb(var(--text-mid))" : riskLevel === "moderate" ? "#D39C1F" : riskLevel === "risky" ? "#F0A245" : "#F16C86";

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        background: "rgb(var(--bg) / 0.88)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderBottom: "1px solid rgb(var(--accent) / 0.07)",
      }}
    >
      <div className="flex items-center h-11 px-4">
        <button
          onClick={onBrandClick}
          className="flex items-center gap-2 flex-shrink-0"
          aria-label="Go to Overview"
        >
          <WalletFolioBrand size={28} wordmarkClassName="text-[13px]" />
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={onRefresh}
            disabled={isFetching}
            className="p-2 rounded-lg transition-colors disabled:opacity-30"
            style={{ color: "rgb(var(--text-lo))" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgb(var(--text-mid))")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgb(var(--text-lo))")}
            aria-label="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </button>

          {onRiskClick && (
            <button
              onClick={onRiskClick}
              className="relative p-2 rounded-lg transition-colors"
              style={{ color: riskColor }}
              onMouseEnter={(e) => (e.currentTarget.style.color = riskHover)}
              onMouseLeave={(e) => (e.currentTarget.style.color = riskColor)}
              aria-label="Risk monitor"
            >
              <RiskIcon className="h-4 w-4" />
            </button>
          )}

          {onAlertClick && (
            <button
              onClick={onAlertClick}
              className="relative p-2 rounded-lg transition-colors"
              style={{ color: alertBadge > 0 ? "rgb(var(--text-mid))" : "rgb(var(--text-lo))" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgb(var(--text-mid))")}
              onMouseLeave={(e) => (e.currentTarget.style.color = alertBadge > 0 ? "rgb(var(--text-mid))" : "rgb(var(--text-lo))")}
              aria-label="Alerts"
            >
              <Bell className="h-4 w-4" />
              {alertBadge > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-bg">
                  {Math.min(alertBadge, 99)}
                </span>
              )}
            </button>
          )}

          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className="p-2 rounded-lg transition-colors"
              style={{ color: "rgb(var(--text-lo))" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgb(var(--text-mid))")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgb(var(--text-lo))")}
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
          <ThemeToggle className="h-8 w-8" />
        </div>
      </div>

      {autoRefresh && (
        <div
          className="h-px w-full"
          style={{ background: "linear-gradient(90deg,transparent,rgb(var(--accent) / 0.3),transparent)" }}
        />
      )}
    </header>
  );
}
