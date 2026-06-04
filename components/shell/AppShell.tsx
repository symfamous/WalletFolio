"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useEffect, useRef } from "react";
import { cn, normalizeTrackedAddress } from "@/lib/utils";
import { Footer } from "@/components/shell/Footer";
import { WalletBar } from "@/components/wallet/WalletBar";
import { Button } from "@/components/ui/Button";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { ShareCardModal } from "@/components/shell/ShareCardModal";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { useMultiWallet } from "@/hooks/useMultiWallet";
import { useMultiPortfolio } from "@/hooks/useMultiPortfolio";
import { useStandalone } from "@/hooks/useStandalone";
import { writeDashboardViewMode, readDashboardViewMode, DEFAULT_DASHBOARD_VIEW_MODE } from "@/lib/dashboardViewMode";
import { writeGoalPreference, readGoalPreference, DEFAULT_PORTFOLIO_GOAL } from "@/lib/goalPreference";
import type { DashboardViewMode, PortfolioGoal } from "@/types";

const AUTO_REFRESH_MS = 30_000;
const LS_AUTO_REFRESH = "pseryte_auto_refresh";
const LS_ACTIVE_ADDR = "pseryte_last_address";

const Dashboard = dynamic(
  () => import("@/components/shell/Dashboard").then((mod) => mod.Dashboard),
  {
    loading: () => <div className="min-h-[24rem] rounded-xl bg-surface animate-pulse" />,
  },
);

// Installed-PWA / standalone experience. Only rendered for standalone clients;
// desktop browser users get the Linear redesign below.
const PWAShell = dynamic(
  () => import("@/components/pwa/PWAShell").then((mod) => mod.PWAShell),
  { ssr: false },
);

export function AppShell({ initialAddress }: { initialAddress?: string } = {}) {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeAddress, setActiveAddress] = useState("");
  const [viewMode, setViewMode] = useState<DashboardViewMode>(DEFAULT_DASHBOARD_VIEW_MODE);
  const [activeSection, setActiveSection] = useState("overview");
  const [availableSections, setAvailableSections] = useState<string[]>(["overview"]);
  const [selectedGoal, setSelectedGoal] = useState<PortfolioGoal>(DEFAULT_PORTFOLIO_GOAL);
  const [runCheckup, setRunCheckup] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isStandalone = useStandalone();
  // Mobile-sized browsers get the mobile shell too (not just installed PWAs).
  // AppShell is loaded with ssr:false, so window is available on first render.
  const [isMobile, setIsMobile] = useState<boolean>(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Use the dedicated mobile shell when installed as a PWA OR on a small screen.
  const useMobileShell = isStandalone || isMobile;

  const { wallets, addWallet, removeWallet } = useMultiWallet();
  const { walletResults, combined, refetchAll } = useMultiPortfolio(wallets, {
    activeAddress,
    fetchStrategy: useMobileShell ? "active-only" : "all",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ar = localStorage.getItem(LS_AUTO_REFRESH);
    if (ar !== null) setAutoRefresh(ar === "1");
    const saved = localStorage.getItem(LS_ACTIVE_ADDR);
    if (saved) setActiveAddress(saved);
    setViewMode(readDashboardViewMode(window.localStorage));
    setSelectedGoal(readGoalPreference(window.localStorage));
  }, []);

  useEffect(() => {
    if (wallets.length === 0) {
      setActiveAddress("");
      return;
    }
    const exactMatch = wallets.some((w) => w.address === activeAddress);
    if (!exactMatch) {
      const ciFallback = wallets.find(
        (w) => w.address.toLowerCase() === activeAddress.toLowerCase(),
      );
      if (ciFallback) {
        setActiveAddress(ciFallback.address);
        if (typeof window !== "undefined") {
          localStorage.setItem(LS_ACTIVE_ADDR, ciFallback.address);
        }
      } else {
        setActiveAddress(wallets[0].address);
      }
    }
  }, [wallets, activeAddress]);

  const handleSubmit = useCallback((a: string, opts?: { viewMode?: DashboardViewMode; goal?: PortfolioGoal; runCheckup?: boolean }) => {
    const normalised = normalizeTrackedAddress(a);
    addWallet(normalised);
    setActiveAddress(normalised);
    if (typeof window !== "undefined") {
      localStorage.setItem(LS_ACTIVE_ADDR, normalised);
      if (opts?.viewMode) writeDashboardViewMode(window.localStorage, opts.viewMode);
      if (opts?.goal) writeGoalPreference(window.localStorage, opts.goal);
      if (opts?.runCheckup === false) sessionStorage.setItem("walletfolio_skip_checkup", "1");
    }
  }, [addWallet]);

  const handleClear = useCallback(() => {
    setActiveAddress("");
    if (typeof window !== "undefined") localStorage.removeItem(LS_ACTIVE_ADDR);
  }, []);

  // Address entered on the landing page → open its portfolio directly (once).
  const didInitRef = useRef(false);
  useEffect(() => {
    if (initialAddress && !didInitRef.current) {
      didInitRef.current = true;
      handleSubmit(initialAddress);
    }
  }, [initialAddress, handleSubmit]);

  const handleSelectWallet = useCallback((address: string) => {
    setActiveAddress(address);
    setActiveSection("overview");
    if (typeof window !== "undefined") localStorage.setItem(LS_ACTIVE_ADDR, address);
  }, []);

  const handleRemoveWallet = useCallback((address: string) => {
    removeWallet(address);
    if (address === activeAddress) {
      const remaining = wallets.filter((w) => w.address !== address);
      const next = remaining[0]?.address ?? "";
      setActiveAddress(next);
      if (typeof window !== "undefined") localStorage.setItem(LS_ACTIVE_ADDR, next);
    }
  }, [removeWallet, activeAddress, wallets]);

  const toggleAutoRefresh = useCallback(() => {
    setAutoRefresh((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") localStorage.setItem(LS_AUTO_REFRESH, next ? "1" : "0");
      return next;
    });
  }, []);

  const handleNavigate = useCallback((id: string) => {
    setActiveSection(id);
  }, []);

  useEffect(() => {
    if (!availableSections.includes(activeSection)) {
      setActiveSection(availableSections[0] ?? "overview");
    }
  }, [activeSection, availableSections]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (wallets.length === 0 || !autoRefresh) return;
    intervalRef.current = setInterval(() => {
      if (document.visibilityState === "visible") refetchAll();
    }, AUTO_REFRESH_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [wallets, autoRefresh, refetchAll]);

  const activeResult = walletResults.find((w) => w.address === activeAddress);
  const portfolio = activeResult?.data?.portfolio;
  const intelligence = activeResult?.data?.intelligence;
  const providerStatus = activeResult?.data?.providerStatus;
  const timestamp = activeResult?.data?.timestamp;
  const isLoading = activeResult?.isLoading ?? false;
  const isFetching = activeResult?.isFetching ?? false;
  const isError = activeResult?.isError ?? false;
  const error = activeResult?.error ?? null;
  const refetch = activeResult?.refetch ?? refetchAll;
  // Build the ticker: one entry per symbol. When the same ticker exists on
  // multiple venues (e.g. HYPE on HyperEVM vs Hyperliquid spot), prefer the
  // Hyperliquid-origin holding; otherwise keep the larger position.
  const tickerCandidates = (portfolio?.aggregated ?? [])
    .filter((holding) => holding.priceAvailable && holding.totalUsdValue > 0 && !holding.isStablecoin);
  const isHyperliquidOrigin = (h: (typeof tickerCandidates)[number]) =>
    h.positions?.some((p) => p.chainSlug === "hyperliquid") ?? false;
  const tickerBySymbol = new Map<string, (typeof tickerCandidates)[number]>();
  for (const h of tickerCandidates) {
    const sym = h.symbol.toUpperCase();
    const existing = tickerBySymbol.get(sym);
    if (!existing) {
      tickerBySymbol.set(sym, h);
      continue;
    }
    const hHl = isHyperliquidOrigin(h);
    const eHl = isHyperliquidOrigin(existing);
    const better =
      hHl !== eHl ? (hHl ? h : existing) : h.totalUsdValue > existing.totalUsdValue ? h : existing;
    tickerBySymbol.set(sym, better);
  }
  const tickerItems = [...tickerBySymbol.values()]
    .sort((a, b) => b.totalUsdValue - a.totalUsdValue)
    .slice(0, 7);

  const openShareCard = () => {
    if (portfolio && activeAddress) setShareOpen(true);
  };

  const sharedProps = {
    address: activeAddress,
    portfolio,
    intelligence,
    providerStatus,
    timestamp,
    isLoading,
    isFetching,
    isError,
    error,
    onRefresh: refetch,
    onClear: handleClear,
    onNewAddress: handleSubmit,
    autoRefresh,
    onToggleAutoRefresh: toggleAutoRefresh,
    trackedWallets: wallets,
    walletResults,
    viewMode,
  };

  const SECTION_TITLES: Record<string, { title: string; subtitle: string }> = {
    overview: { title: "Overview", subtitle: "Where the money sits" },
    wallets: { title: "Wallets", subtitle: "Tracked workspace" },
    intelligence: { title: "Intelligence", subtitle: "Analysis workspace" },
    holdings: { title: "Holdings", subtitle: "Asset explorer" },
    pnl: { title: "P&L", subtitle: "Cost basis & returns" },
    "defi-positions": { title: "DeFi", subtitle: "Protocol exposure" },
    perps: { title: "Perps", subtitle: "Leverage review" },
    "wallet-history": { title: "History", subtitle: "Activity feed" },
    scenarios: { title: "Scenarios", subtitle: "What-if planning" },
    patterns: { title: "Patterns", subtitle: "Behavior analysis" },
    settings: { title: "Tools", subtitle: "Preferences and utilities" },
  };
  const activeSectionMeta = SECTION_TITLES[activeSection] ?? SECTION_TITLES.overview;

  // Installed PWAs and mobile-sized browsers get the dedicated mobile shell;
  // desktop browsers get the Linear redesign below.
  if (useMobileShell) {
    return <PWAShell {...sharedProps} />;
  }

  return (
    <>
      <div className="min-h-screen bg-bg lg:h-screen lg:overflow-hidden">
        <main className="w-full px-4 pb-20 pt-4 sm:px-6 lg:h-screen lg:overflow-hidden lg:px-0 lg:pb-0 lg:pt-0">
          <div className="grid items-stretch gap-0 lg:h-screen lg:grid-cols-[272px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
            <SidebarNav
              autoRefresh={autoRefresh}
              onToggleAutoRefresh={toggleAutoRefresh}
              activeId={activeSection}
              availableIds={availableSections}
              onNavigate={handleNavigate}
              currentAddress={activeAddress}
              currentTotalUsd={portfolio?.summary.totalUsdValue}
              currentChangePct={portfolio?.summary.change24h}
            />

            <div className="min-w-0 lg:min-h-0">
              <div className="flex min-h-screen flex-col bg-bg lg:h-full lg:min-h-0 lg:overflow-hidden">
                <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-border bg-surface px-5 py-2">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-text-hi">{activeSectionMeta.title}</span>
                      <span className="text-border-strong">/</span>
                      <span className="truncate text-xs text-text-lo">{activeSectionMeta.subtitle}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-lo">
                    {timestamp ? <span className="num hidden xl:inline">{new Date(timestamp).toLocaleDateString([], { month: "short", day: "2-digit" })}</span> : null}
                    {wallets.length > 0 ? <span className="hidden xl:inline">{wallets.length} wallets</span> : null}
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new Event("walletfolio:open-command"))}
                      className="inline-flex items-center gap-2 rounded-[8px] border border-border bg-surface-raised px-2.5 py-1 text-text-lo transition-colors hover:border-border-strong hover:text-text-hi"
                    >
                      <span>Search</span>
                      <kbd className="rounded border border-border px-1 text-[10px]">⌘K</kbd>
                    </button>
                    {portfolio && activeAddress ? (
                      <button
                        type="button"
                        onClick={openShareCard}
                        className="inline-flex items-center gap-1.5 rounded-[8px] border border-border bg-surface-raised px-2.5 py-1 text-text-lo transition-colors hover:border-border-strong hover:text-text-hi"
                      >
                        Share
                      </button>
                    ) : null}
                    <Button variant="subtle" size="sm" onClick={() => handleNavigate("overview")}>Snapshot</Button>
                    <Button variant="subtle" size="sm" onClick={() => handleNavigate("holdings")}>Holdings</Button>
                    <Button variant="subtle" size="sm" onClick={() => handleNavigate("defi-positions")}>DeFi</Button>
                    <Button
                      variant={autoRefresh ? "primary" : "ghost"}
                      size="sm"
                      onClick={toggleAutoRefresh}
                    >
                      {autoRefresh ? "Live" : "Paused"}
                    </Button>
                  </div>
                </div>
                {tickerItems.length > 0 ? (
                  <div className="flex min-h-[32px] items-center gap-5 overflow-hidden border-b border-border bg-surface px-5 text-xs text-text-lo">
                    {tickerItems.map((item, index) => (
                      <div key={item.aggregateKey} className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                        <span className="text-text-mid">{item.symbol}</span>
                        <span className="num font-medium text-text-hi">{item.price !== undefined ? `$${item.price.toLocaleString("en-US", { maximumFractionDigits: item.price < 1 ? 3 : 2 })}` : "—"}</span>
                        {item.priceChange24h !== undefined ? (
                          <span className={cn("num", item.priceChange24h >= 0 ? "text-success" : "text-danger")}>
                            {item.priceChange24h >= 0 ? "+" : ""}{item.priceChange24h.toFixed(2)}%
                          </span>
                        ) : null}
                        {index < tickerItems.length - 1 ? <span className="text-border">|</span> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="border-b border-border bg-surface px-4 py-1.5">
                  <WalletBar
                    wallets={wallets}
                    walletResults={walletResults}
                    combined={combined}
                    activeAddress={activeAddress}
                    onSelect={handleSelectWallet}
                    onAdd={handleSubmit}
                    onRemove={handleRemoveWallet}
                  />
                </div>
                {activeAddress ? (
                  <div className="px-3 py-2 sm:px-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:px-4 lg:py-2.5 xl:px-4.5 xl:py-3">
                    <Dashboard
                      {...sharedProps}
                      activeSection={activeSection}
                      onAvailableSectionsChange={setAvailableSections}
                      onNavigate={handleNavigate}
                    />
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center px-4 py-12">
                    <div className="text-center">
                      <p className="text-base font-medium text-text-hi">No wallet selected</p>
                      <p className="mt-1 text-sm text-text-mid">Add a wallet from the bar above, or return home to enter an address.</p>
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            localStorage.removeItem("walletfolio_entered");
                            window.location.reload();
                          }
                        }}
                        className="mt-4 inline-flex items-center gap-2 rounded-[10px] border border-border bg-surface px-4 py-2 text-sm text-text-hi transition-colors hover:border-border-strong"
                      >
                        Back to home
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      <div className={wallets.length > 0 ? "lg:hidden" : ""}>
        <Footer />
      </div>
      </div>
      <CommandPalette
        sections={availableSections}
        onNavigate={handleNavigate}
        wallets={wallets}
        activeAddress={activeAddress}
        onSelectWallet={handleSelectWallet}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={toggleAutoRefresh}
        onShare={portfolio && activeAddress ? openShareCard : undefined}
      />
      {portfolio && activeAddress ? (
        <ShareCardModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          name={`${activeAddress.slice(0, 6)}…${activeAddress.slice(-4)}`}
          totalUsd={portfolio.summary.totalUsdValue}
          change24h={portfolio.summary.change24h}
          topAssets={tickerItems.slice(0, 6).map((t) => t.symbol)}
        />
      ) : null}
    </>
  );
}
