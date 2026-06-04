"use client";

import Link from "next/link";
import {
  Activity,
  BookOpen,
  Briefcase,
  Compass,
  History,
  Layers,
  LineChart,
  Settings2,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import { WalletFolioBrand } from "@/components/brand/WalletFolioBrand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useEns } from "@/hooks/useEns";
import { cn } from "@/lib/utils";

export interface SidebarNavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

interface SidebarNavProps {
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  activeId: string;
  availableIds: string[];
  onNavigate: (id: string) => void;
  currentAddress?: string;
  currentTotalUsd?: number;
  currentChangePct?: number;
}

const NAV_ITEMS: SidebarNavItem[] = [
  { id: "overview", label: "Overview", icon: Compass },
  { id: "wallets", label: "Wallets", icon: Wallet },
  { id: "intelligence", label: "Intelligence", icon: Sparkles },
  { id: "holdings", label: "Holdings", icon: Briefcase },
  { id: "pnl", label: "P&L", icon: LineChart },
  { id: "defi-positions", label: "DeFi", icon: Layers },
  { id: "perps", label: "Perps", icon: Activity },
  { id: "wallet-history", label: "History", icon: History },
  { id: "scenarios", label: "Scenarios", icon: Target },
  { id: "patterns", label: "Patterns", icon: BookOpen },
  { id: "settings", label: "Tools", icon: Settings2 },
];

function NavButtons({
  items,
  activeId,
  onNavigate,
}: {
  items: SidebarNavItem[];
  activeId: string | null;
  onNavigate: (id: string) => void;
}) {
  return (
    <>
      {items.map(({ id, label, icon: Icon }) => {
        const active = activeId === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-10 w-full items-center gap-2.5 rounded-[8px] px-3 text-[13px] font-medium transition-colors duration-150",
              id === "settings" && "mt-2",
              active
                ? "bg-accent/10 text-text-hi"
                : "text-text-lo hover:bg-surface-raised hover:text-text-hi"
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-accent" />
            )}
            <Icon
              className={cn(
                "h-[16px] w-[16px] shrink-0 transition-colors",
                active ? "text-accent" : "text-text-lo group-hover:text-text-hi"
              )}
              strokeWidth={1.8}
            />
            <span>{label}</span>
          </button>
        );
      })}
    </>
  );
}

export function SidebarNav({
  autoRefresh,
  onToggleAutoRefresh,
  activeId,
  availableIds,
  onNavigate,
  currentAddress,
  currentTotalUsd,
  currentChangePct,
}: SidebarNavProps) {
  const visibleItems = NAV_ITEMS.filter((item) => availableIds.includes(item.id));
  const ens = useEns(currentAddress);

  return (
    <aside className="hidden lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-border lg:bg-surface">
      {/* Brand + status */}
      <div className="flex items-center justify-between gap-2 px-4 py-3.5">
        <Link
          href="/"
          onClick={() => {
            if (typeof window !== "undefined") sessionStorage.removeItem("walletfolio_entered");
          }}
          className="inline-flex"
        >
          <WalletFolioBrand size={26} wordmarkClassName="text-[15px] tracking-tight" />
        </Link>
        <ThemeToggle className="h-7 w-7" />
      </div>

      {/* Active wallet KPI */}
      {currentAddress ? (
        <div className="mx-3 mb-1 rounded-[10px] border border-border bg-bg px-3 py-3">
          <div className="flex items-center gap-2">
            {ens.data?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ens.data.avatar} alt="" className="h-5 w-5 rounded-full object-cover" />
            ) : null}
            {ens.data?.name ? (
              <span className="truncate text-xs font-medium text-text-hi">{ens.data.name}</span>
            ) : (
              <span className="num text-[11px] text-text-lo">
                {currentAddress.slice(0, 6)}…{currentAddress.slice(-4)}
              </span>
            )}
          </div>
          <p className="num mt-1.5 text-xl font-semibold leading-none text-text-hi">
            {currentTotalUsd !== undefined
              ? `$${currentTotalUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
              : "—"}
          </p>
          {currentChangePct !== undefined ? (
            <p
              className={cn(
                "num mt-1.5 text-[11px]",
                currentChangePct >= 0 ? "text-success" : "text-danger"
              )}
            >
              {currentChangePct >= 0 ? "+" : ""}
              {currentChangePct.toFixed(2)}% · 24h
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-text-lo">Portfolio synced</p>
          )}
        </div>
      ) : null}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
        <NavButtons items={visibleItems} activeId={activeId} onNavigate={onNavigate} />
      </nav>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border px-4 py-3 text-[11px] text-text-lo">
        <span>{visibleItems.length} sections</span>
        <button
          type="button"
          onClick={onToggleAutoRefresh}
          className={cn(
            "inline-flex items-center gap-1.5 transition-colors",
            autoRefresh ? "text-accent" : "text-text-lo hover:text-text-hi"
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              autoRefresh ? "bg-accent" : "bg-text-lo"
            )}
          />
          {autoRefresh ? "Live" : "Paused"}
        </button>
      </div>
    </aside>
  );
}
