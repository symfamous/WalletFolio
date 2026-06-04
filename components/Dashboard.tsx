"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { DashboardSkeleton } from "@/components/Skeleton";
import { StressViewDrawer } from "@/components/StressViewDrawer";
import { formatUSD } from "@/lib/utils";
import { buildUnifiedRiskSummary } from "@/lib/riskMonitor";
import { buildPortfolioStressSummary } from "@/lib/stressSummary";
import { buildPortfolioGoalFitSummary } from "@/lib/goalFit";
import { buildFirstWalletCheckup } from "@/lib/walletCheckup";
import { portfolioWithPerpsAccountValue } from "@/lib/aggregate/perpsPortfolio";
import { getActivityFeedModeForDashboard, getDashboardViewSections } from "@/lib/dashboardViewMode";
import { DEFAULT_PORTFOLIO_GOAL, readGoalPreference, writeGoalPreference } from "@/lib/goalPreference";
import { useAlerts } from "@/hooks/useAlerts";
import { useFxRate } from "@/hooks/useFxRate";
import { usePerps } from "@/hooks/usePerps";
import { useSnapshots } from "@/hooks/useSnapshots";
import { useWallets } from "@/hooks/useWallets";
import { DashboardHeader, ProviderBanner } from "@/components/dashboard/shared";
import {
  DefiView,
  HistoryView,
  HoldingsView,
  PnlView,
  IntelligenceView,
  OverviewView,
  PatternsView,
  PerpsView,
  ScenariosView,
  SettingsView,
  WalletsView,
} from "@/components/dashboard/views";
import type { DashboardViewMode, Portfolio, PortfolioGoal, PortfolioIntelligence as PIType, PortfolioApiResponse } from "@/types";
import type { WalletEntry } from "@/hooks/useMultiWallet";
import type { WalletResult } from "@/hooks/useMultiPortfolio";

interface DashboardProps {
  address: string;
  portfolio?: Portfolio;
  intelligence?: PIType;
  providerStatus?: PortfolioApiResponse["providerStatus"];
  timestamp?: string;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error?: Error | null;
  onRefresh: () => void;
  onClear: () => void;
  onNewAddress: (address: string) => void;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  trackedWallets: WalletEntry[];
  walletResults: WalletResult[];
  viewMode: DashboardViewMode;
  activeSection: string;
  onAvailableSectionsChange: (sections: string[]) => void;
  onNavigate: (id: string) => void;
}

export function Dashboard({
  address,
  portfolio,
  intelligence,
  providerStatus,
  timestamp,
  isLoading,
  isFetching,
  isError,
  error,
  onRefresh,
  onClear,
  onNewAddress,
  autoRefresh,
  onToggleAutoRefresh,
  trackedWallets,
  walletResults,
  viewMode,
  activeSection,
  onAvailableSectionsChange,
  onNavigate,
}: DashboardProps) {
  const [copied, setCopied] = useState(false);
  const [hideDefi, setHideDefi] = useState(false);
  const [stressOpen, setStressOpen] = useState(false);
  const [overviewQuickAccess, setOverviewQuickAccess] = useState<"risk" | "snapshot" | "buckets" | "goal" | "checkup">("risk");
  const [selectedGoal, setSelectedGoal] = useState<PortfolioGoal>(DEFAULT_PORTFOLIO_GOAL);

  const { currency, setCurrency, rates, format } = useFxRate();
  const perps = usePerps(address);
  const displayPortfolio = useMemo(
    () => portfolioWithPerpsAccountValue(portfolio, perps.data),
    [portfolio, perps.data]
  );
  const snapshots = useSnapshots(address, displayPortfolio, perps.data);
  const wallets = useWallets(address);

  const unifiedRisk = useMemo(
    () => (displayPortfolio ? buildUnifiedRiskSummary(displayPortfolio, perps.data) : null),
    [displayPortfolio, perps.data]
  );
  const intelligenceForUi = useMemo(
    () => (intelligence && unifiedRisk ? { ...intelligence, risk: unifiedRisk } : intelligence),
    [intelligence, unifiedRisk]
  );
  const stressSummary = useMemo(
    () => (displayPortfolio ? buildPortfolioStressSummary(displayPortfolio, perps.data) : null),
    [displayPortfolio, perps.data]
  );
  const goalFitSummary = useMemo(
    () => (displayPortfolio ? buildPortfolioGoalFitSummary(displayPortfolio, selectedGoal, perps.data) : null),
    [displayPortfolio, perps.data, selectedGoal]
  );
  const walletCheckupSummary = useMemo(
    () => (displayPortfolio ? buildFirstWalletCheckup(displayPortfolio, selectedGoal, perps.data) : null),
    [displayPortfolio, perps.data, selectedGoal]
  );
  const visibleSections = useMemo(
    () => getDashboardViewSections(viewMode),
    [viewMode]
  );
  const activityFeedConfig = useMemo(
    () => getActivityFeedModeForDashboard(viewMode),
    [viewMode]
  );
  const alerts = useAlerts(displayPortfolio, intelligenceForUi, snapshots.snapshots, perps.data);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHideDefi(localStorage.getItem("pseryte_dash_hide_defi") === "1");
    setSelectedGoal(readGoalPreference(window.localStorage));
    setOverviewQuickAccess("risk");
  }, [address]);

  const hasPriced = displayPortfolio?.aggregated.some((holding) => holding.priceAvailable) ?? false;
  const hasProtocols = (displayPortfolio?.protocols.filter((protocol) => protocol.netUsdValue >= 5 || protocol.totalBorrowUsd > 0).length ?? 0) > 0;

  const availableSectionIds = useMemo(() => {
    const ids = ["overview", "wallets", "intelligence"];
    if (visibleSections.detailedHoldings) ids.push("holdings");
    ids.push("pnl");
    if (visibleSections.detailedDefi && hasProtocols) ids.push("defi-positions");
    if (visibleSections.detailedPerps) ids.push("perps");
    if (visibleSections.activityFeed) ids.push("wallet-history");
    if (visibleSections.targetCalculator && hasPriced) ids.push("scenarios");
    if (visibleSections.behaviorInsights) ids.push("patterns");
    ids.push("settings");
    return ids;
  }, [
    hasPriced,
    hasProtocols,
    visibleSections.activityFeed,
    visibleSections.behaviorInsights,
    visibleSections.detailedDefi,
    visibleSections.detailedHoldings,
    visibleSections.detailedPerps,
    visibleSections.targetCalculator,
  ]);

  useEffect(() => {
    onAvailableSectionsChange(availableSectionIds);
  }, [availableSectionIds, onAvailableSectionsChange]);

  function toggleHideDefi() {
    const next = !hideDefi;
    setHideDefi(next);
    localStorage.setItem("pseryte_dash_hide_defi", next ? "1" : "0");
  }

  function handleSelectGoal(goal: PortfolioGoal) {
    setSelectedGoal(goal);
    if (typeof window !== "undefined") writeGoalPreference(window.localStorage, goal);
  }

  async function copyAddress() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const timeStr = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : undefined;

  if (isLoading) {
    return (
      <div className="space-y-5">
        <DashboardHeader
          address={address}
          isFetching={isFetching}
          copied={copied}
          onCopy={copyAddress}
          onRefresh={onRefresh}
          onClear={onClear}
          autoRefresh={autoRefresh}
        />
        <DashboardSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-5">
        <DashboardHeader
          address={address}
          isFetching={false}
          copied={copied}
          onCopy={copyAddress}
          onRefresh={onRefresh}
          onClear={onClear}
          autoRefresh={autoRefresh}
        />
        <ProviderBanner status={providerStatus} error={error} />
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="mb-5 mx-auto max-w-sm text-sm text-text-mid">{error?.message ?? "Failed to load portfolio."}</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={onRefresh} className="inline-flex items-center gap-2 rounded-lg border border-danger/25 bg-danger/10 px-4 py-2 text-sm text-danger transition-colors hover:bg-danger/15">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
            <button onClick={onClear} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-text-mid transition-colors hover:border-border-strong">
              Different address
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!displayPortfolio) return null;

  const hiddenFundsSummary = intelligence && intelligence.hiddenFunds.length > 0
    ? `${intelligence.hiddenFunds.length} items · ${formatUSD(intelligence.hiddenFunds.reduce((sum, fund) => sum + fund.usdValue, 0))} recoverable`
    : "No idle funds found";

  const intelligenceSummary = displayPortfolio.summary.change24h !== undefined
    ? `${displayPortfolio.summary.change24h >= 0 ? "+" : ""}${displayPortfolio.summary.change24h.toFixed(2)}% today`
    : "Portfolio intelligence";

  const workspace =
    activeSection === "wallets" ? (
      <WalletsView
        trackedWallets={trackedWallets}
        address={address}
        wallets={wallets}
        onNewAddress={onNewAddress}
        isFetching={isFetching}
      />
    ) :
    activeSection === "intelligence" ? (
      <IntelligenceView
        address={address}
        intelligence={intelligenceForUi}
        portfolio={displayPortfolio}
        perpsData={perps.data}
        format={format}
        currency={currency}
        attribution={snapshots.attribution}
        hasHistory={snapshots.hasHistory}
        summary={intelligenceSummary}
      />
    ) :
    activeSection === "holdings" ? (
      <HoldingsView portfolio={displayPortfolio} address={address} />
    ) :
    activeSection === "pnl" ? (
      <PnlView address={address} portfolio={displayPortfolio} />
    ) :
    activeSection === "defi-positions" ? (
      <DefiView portfolio={displayPortfolio} hideDefi={hideDefi} onToggleHideDefi={toggleHideDefi} />
    ) :
    activeSection === "perps" ? (
      <PerpsView perpsData={perps.data} isLoading={perps.isLoading} />
    ) :
    activeSection === "wallet-history" ? (
      <HistoryView
        address={address}
        initialViewMode={activityFeedConfig.defaultViewMode}
        allowRawToggle={activityFeedConfig.allowRawToggle}
        compact={activityFeedConfig.compact}
      />
    ) :
    activeSection === "scenarios" ? (
      <ScenariosView
        portfolio={displayPortfolio}
        selectedGoal={selectedGoal}
        perpsData={perps.data}
        format={format}
        currency={currency}
      />
    ) :
    activeSection === "patterns" ? (
      <PatternsView
        trackedWallets={trackedWallets}
        walletResults={walletResults}
        address={address}
        portfolio={displayPortfolio}
        perpsData={perps.data}
        selectedGoal={selectedGoal}
        intelligence={intelligence}
        hiddenFundsSummary={hiddenFundsSummary}
      />
    ) :
    activeSection === "settings" ? (
      <SettingsView
        hasPriced={hasPriced}
        portfolio={displayPortfolio}
        format={format}
        currency={currency}
        setCurrency={setCurrency}
        rates={rates}
      />
    ) : (
      <OverviewView
        address={address}
        portfolio={displayPortfolio}
        providerStatus={providerStatus}
        isFetching={isFetching}
        timeStr={timeStr}
        copied={copied}
        onCopy={copyAddress}
        onRefresh={onRefresh}
        onClear={onClear}
        unreadAlerts={alerts.unreadCount}
        autoRefresh={autoRefresh}
        format={format}
        currency={currency}
        intelligence={intelligenceForUi}
        perpsData={perps.data}
        trackedWalletCount={trackedWallets.length}
        selectedGoal={selectedGoal}
        goalFitSummary={goalFitSummary}
        walletCheckupSummary={walletCheckupSummary}
        onSelectGoal={handleSelectGoal}
        overviewQuickAccess={overviewQuickAccess}
        onOverviewQuickAccessChange={setOverviewQuickAccess}
        onRunCheckupAgain={() => setStressOpen(true)}
        onNavigate={onNavigate}
      />
    );

  return (
    <>
      <div className="animate-fade-in">
        <div className="space-y-6">{workspace}</div>
      </div>
      <StressViewDrawer open={stressOpen} summary={stressSummary} onClose={() => setStressOpen(false)} />
    </>
  );
}
