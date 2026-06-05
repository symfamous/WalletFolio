"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  RefreshCw,
  Wifi,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { getProviderBannerState } from "@/lib/ui/provider-banner";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { cn, formatUSD, isSolanaAddress, shortenAddress } from "@/lib/utils";
import type { Portfolio, PortfolioApiResponse } from "@/types";

export interface SectionKpi {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  delta?: ReactNode;
  tone?: "positive" | "negative" | "neutral";
}

/**
 * Consistent premium section header: a clean title/subtitle + an optional row
 * of KPI stat tiles (the Overview "bento" language, applied across every tab).
 * Replaces the old gradient PageIntro banner.
 */
export function SectionHeader({
  title,
  subtitle,
  kpis,
  action,
}: {
  title: string;
  subtitle?: string;
  kpis?: SectionKpi[];
  action?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-hi">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-xs text-text-lo">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {kpis && kpis.length > 0 ? (
        <div
          className={cn(
            "grid gap-4",
            kpis.length <= 2
              ? "grid-cols-2"
              : kpis.length === 3
                ? "grid-cols-2 sm:grid-cols-3"
                : "grid-cols-2 lg:grid-cols-4"
          )}
        >
          {kpis.map((k) => (
            <StatCard
              key={k.label}
              label={k.label}
              value={k.value}
              sub={k.sub}
              delta={k.delta}
              deltaTone={k.tone}
              valueTone={k.delta ? "neutral" : k.tone}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

const providerBannerSeenAt = new Map<string, number>();
const PROVIDER_BANNER_REPEAT_WINDOW_MS = 120_000;

export function ProviderBanner({
  status,
  error,
  hasRenderablePortfolio = false,
}: {
  status?: PortfolioApiResponse["providerStatus"];
  error?: Error | null;
  hasRenderablePortfolio?: boolean;
}) {
  const banner = getProviderBannerState(status, {
    errorMessage: error?.message ?? null,
    hasRenderablePortfolio,
  });
  const [suppressed, setSuppressed] = useState(false);

  useEffect(() => {
    if (!banner?.repeatKey) {
      setSuppressed(false);
      return;
    }

    const now = Date.now();
    const lastShownAt = providerBannerSeenAt.get(banner.repeatKey);
    if (lastShownAt && now - lastShownAt < PROVIDER_BANNER_REPEAT_WINDOW_MS) {
      console.info(`[provider-banner] suppressed repeated backup-source notice for ${banner.repeatKey}`);
      setSuppressed(true);
      return;
    }

    providerBannerSeenAt.set(banner.repeatKey, now);
    setSuppressed(false);
  }, [banner?.repeatKey]);

  if (!banner || suppressed) return null;

  const toneStyles =
    banner.tone === "error"
      ? {
          wrapper: "border-danger/30 bg-danger/5",
          icon: "text-danger",
          title: "text-danger",
          Icon: AlertTriangle,
        }
      : banner.tone === "warning"
        ? {
            wrapper: "border-warning/30 bg-warning/5",
            icon: "text-warning",
            title: "text-warning",
            Icon: AlertTriangle,
          }
        : {
            wrapper: "border-border bg-surface-raised",
            icon: "text-text-mid",
            title: "text-text-hi",
            Icon: Wifi,
          };
  const BannerIcon = toneStyles.Icon;

  return (
    <div className={cn("flex items-start gap-2.5 rounded-[10px] border px-3.5 py-2.5", toneStyles.wrapper)}>
      <BannerIcon className={cn("mt-0.5 h-4 w-4 flex-shrink-0", toneStyles.icon)} />
      <div>
        <p className={cn("text-[13px] font-medium", toneStyles.title)}>{banner.title}</p>
        <p className="mt-0.5 text-xs text-text-lo">{banner.message}</p>
      </div>
    </div>
  );
}

export function DashboardHeader({
  address,
  totalValue,
  isFetching,
  timestamp,
  copied,
  onCopy,
  onRefresh,
  onClear,
  unreadAlerts,
  autoRefresh,
}: {
  address: string;
  totalValue?: number;
  isFetching: boolean;
  timestamp?: string;
  copied: boolean;
  onCopy: () => void;
  onRefresh: () => void;
  onClear: () => void;
  unreadAlerts?: number;
  autoRefresh: boolean;
}) {
  const isSolana = isSolanaAddress(address) && !address.startsWith("0x");

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-[12px] border border-border bg-surface px-4 py-3">
      <div>
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-text-lo">Tracking</p>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
              isSolana
                ? "border-accent/30 bg-accent/10 text-accent"
                : "border-accent/30 bg-accent/10 text-accent"
            )}
          >
            {isSolana ? "◎ Solana" : "⬡ EVM"}
          </span>
          <p className="num text-xs text-text-mid">{shortenAddress(address)}</p>
          <button
            onClick={onCopy}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-raised px-2 py-1 text-text-lo transition-colors hover:border-border-strong hover:text-text-hi"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="text-xs">{copied ? "Copied" : "Copy"}</span>
          </button>
          {totalValue !== undefined ? (
            <>
              <span className="text-border-strong">·</span>
              <p className="num text-xs font-semibold text-text-hi">{formatUSD(totalValue)}</p>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {unreadAlerts !== undefined && unreadAlerts > 0 ? (
          <div className="flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="text-[10px] font-medium text-accent">{unreadAlerts} alert{unreadAlerts > 1 ? "s" : ""}</span>
          </div>
        ) : null}

        {timestamp ? (
          <span className="flex items-center gap-1.5 text-xs text-text-lo">
            <Clock className="h-3 w-3" /> {timestamp}
            {autoRefresh ? <span className="text-success">· live</span> : null}
          </span>
        ) : null}

        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isFetching}>
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          {isFetching ? "Refreshing…" : "Refresh"}
        </Button>
        <Button variant="subtle" size="sm" onClick={onClear}>
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      </div>
    </div>
  );
}

export function SpotlightCard({
  id,
  eyebrow,
  title,
  summary,
  action,
  children,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  summary?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="rounded-[12px] border border-border bg-surface p-4 shadow-card"
    >
      <div className="flex flex-col gap-1.5 border-b border-border pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow ? <p className="text-[11px] font-medium uppercase tracking-wide text-text-lo">{eyebrow}</p> : null}
          <h2 className="mt-1 text-[15px] font-semibold text-text-hi">{title}</h2>
          {summary ? <p className="mt-0.5 text-xs text-text-lo">{summary}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function PageIntro({
  eyebrow,
  title,
  summary,
  tone = "default",
}: {
  eyebrow: string;
  title: string;
  summary: string;
  tone?: "default" | "accent" | "danger";
}) {
  const borderClass =
    tone === "danger" ? "border-danger/30" : tone === "accent" ? "border-accent/30" : "border-border";

  return (
    <div className={cn("rounded-[12px] border bg-surface px-4 py-3 shadow-card", borderClass)}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-lo">{eyebrow}</p>
      <h1 className="mt-1 text-lg font-semibold text-text-hi">{title}</h1>
      <p className="mt-1 max-w-[46rem] text-xs leading-relaxed text-text-mid">{summary}</p>
    </div>
  );
}

export function WalletSnapshotCard({
  address,
  portfolio,
  trackedWalletCount,
}: {
  address: string;
  portfolio: Portfolio;
  trackedWalletCount: number;
}) {
  const tiles = [
    { label: "Wallets tracked", value: String(trackedWalletCount) },
    { label: "Chains", value: String(portfolio.summary.activeChainCount) },
    { label: "Wallet value", value: formatUSD(portfolio.summary.walletUsdValue, { compact: true }) },
    { label: "DeFi net", value: formatUSD(portfolio.summary.defiNetUsdValue, { compact: true }) },
  ];

  return (
    <div className="rounded-[12px] border border-border bg-surface p-4 shadow-card">
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-lo">Wallet Snapshot</p>
      <p className="num mt-2 text-sm text-text-mid">{shortenAddress(address)}</p>
      <p className="num mt-2.5 text-[26px] font-semibold leading-none text-text-hi">{formatUSD(portfolio.summary.totalUsdValue)}</p>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-[10px] border border-border bg-surface-raised px-3 py-2.5">
            <p className="text-[11px] text-text-lo">{tile.label}</p>
            <p className="num mt-1 text-sm font-medium text-text-hi">{tile.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function QuickAccessSelector({
  activeItem,
  onSelect,
}: {
  activeItem: "risk" | "snapshot" | "buckets" | "goal" | "checkup";
  onSelect: (item: "risk" | "snapshot" | "buckets" | "goal" | "checkup") => void;
}) {
  const items = [
    { id: "risk" as const, label: "Risk Truth" },
    { id: "snapshot" as const, label: "Wallet Snapshot" },
    { id: "buckets" as const, label: "Where The Money Sits" },
    { id: "goal" as const, label: "Goal Mode" },
    { id: "checkup" as const, label: "Wallet Checkup" },
  ];

  return (
    <div className="rounded-[12px] border border-border bg-surface px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-lo">Quick Access</p>
      <div className="mt-2 grid gap-1 sm:grid-cols-2 xl:grid-cols-5">
        {items.map((item) => {
          const active = activeItem === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                "rounded-[8px] px-2.5 py-2 text-left transition-colors duration-150",
                active
                  ? "bg-accent/10 text-text-hi"
                  : "text-text-mid hover:bg-surface-raised hover:text-text-hi"
              )}
            >
              <span className={cn("block text-[10px] uppercase tracking-wide", active ? "text-accent" : "text-text-lo")}>
                Focus
              </span>
              <span className="mt-0.5 block text-xs font-medium leading-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
