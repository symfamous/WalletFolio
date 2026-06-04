"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Bell, ShieldAlert, ShieldCheck } from "lucide-react";
import { WalletFolioBrand } from "@/components/brand/WalletFolioBrand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PWAContext } from "@/components/pwa/PWAContext";
import { BottomNav } from "@/components/pwa/BottomNav";
import { PWATopBar } from "@/components/pwa/PWATopBar";
import { PWASheet } from "@/components/pwa/PWASheet";
import { PWAOnboarding } from "@/components/pwa/PWAOnboarding";
import { OverviewTab } from "@/components/pwa/OverviewTab";
import { HoldingsTab } from "@/components/pwa/HoldingsTab";
import { DeFiTab } from "@/components/pwa/DeFiTab";
import { TradingTab } from "@/components/pwa/TradingTab";
import { ActivityTab } from "@/components/pwa/ActivityTab";
import { ToolsTab } from "@/components/pwa/ToolsTab";
import { ProfileTab } from "@/components/pwa/ProfileTab";
import { AlertsCenter } from "@/components/AlertsCenter";
import { RiskMonitor } from "@/components/RiskMonitor";
import { InsightsTab } from "@/components/pwa/InsightsTab";
import { usePerps } from "@/hooks/usePerps";
import { useSnapshots } from "@/hooks/useSnapshots";
import { useAlerts } from "@/hooks/useAlerts";
import { useFxRate } from "@/hooks/useFxRate";
import { buildPortfolioStressSummary } from "@/lib/stressSummary";
import { buildPortfolioGoalFitSummary } from "@/lib/goalFit";
import { buildFirstWalletCheckup } from "@/lib/walletCheckup";
import { portfolioWithPerpsAccountValue } from "@/lib/aggregate/perpsPortfolio";
import { DEFAULT_PORTFOLIO_GOAL, readGoalPreference, writeGoalPreference } from "@/lib/goalPreference";
import {
  DEFAULT_DASHBOARD_VIEW_MODE,
  getDashboardViewSections,
  readDashboardViewMode,
  writeDashboardViewMode,
} from "@/lib/dashboardViewMode";
import {
  dismissWalletCheckup,
  markWalletCheckupSeen,
  readWalletCheckupPreference,
  resetWalletCheckupDismissed,
} from "@/lib/walletCheckupPreference";
import { buildUnifiedRiskSummary, getAlertStatusCopy, getLegacyRiskLevel, getRiskSummaryLine } from "@/lib/riskTruth";
import { formatUSD } from "@/lib/utils";
import type { PWATab } from "@/components/pwa/BottomNav";
import type { DashboardViewMode, Portfolio, PortfolioApiResponse, PortfolioGoal, PortfolioIntelligence } from "@/types";
import type { WalletEntry } from "@/hooks/useMultiWallet";
import type { WalletResult } from "@/hooks/useMultiPortfolio";

const LS_ACTIVE_TAB = "pseryte_pwa_tab";
const TAB_ORDER: PWATab[] = ["overview", "holdings", "defi", "trading", "activity", "insights", "tools", "profile"];

const TAB_COMPONENTS: Record<PWATab, React.ComponentType> = {
  overview: OverviewTab,
  holdings: HoldingsTab,
  defi: DeFiTab,
  trading: TradingTab,
  activity: ActivityTab,
  insights: InsightsTab,
  tools: ToolsTab,
  profile: ProfileTab,
};

interface PWAShellProps {
  address: string;
  portfolio?: Portfolio;
  intelligence?: PortfolioIntelligence;
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
}

export function PWAShell({
  address, portfolio, intelligence, providerStatus, timestamp,
  isLoading, isFetching, isError, error,
  onRefresh, onClear, onNewAddress, autoRefresh, onToggleAutoRefresh, trackedWallets, walletResults,
}: PWAShellProps) {
  const [activeTab, setActiveTab] = useState<PWATab>("overview");
  const [animDir, setAnimDir] = useState<"left" | "right" | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [riskOpen, setRiskOpen] = useState(false);
  const [selectedGoal, setSelectedGoalState] = useState<PortfolioGoal>(DEFAULT_PORTFOLIO_GOAL);
  const [viewMode, setViewModeState] = useState<DashboardViewMode>(DEFAULT_DASHBOARD_VIEW_MODE);
  const [runCheckup, setRunCheckup] = useState(true);
  const [showWalletCheckup, setShowWalletCheckup] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(LS_ACTIVE_TAB) as PWATab | null;
    if (saved && TAB_ORDER.includes(saved)) setActiveTab(saved);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSelectedGoalState(readGoalPreference(window.localStorage));
    setViewModeState(readDashboardViewMode(window.localStorage));
    // Check if user opted out of checkup on landing page
    const skipCheckup = sessionStorage.getItem("walletfolio_skip_checkup") === "1";
    const pref = readWalletCheckupPreference(window.localStorage, address);
    const shouldShow = !skipCheckup && (!pref.seenAt || !pref.dismissedAt);
    setShowWalletCheckup(shouldShow);
    if (!pref.seenAt) markWalletCheckupSeen(window.localStorage, address);
  }, [address]);

  const handleTabChange = useCallback((tab: PWATab) => {
    const curIdx = TAB_ORDER.indexOf(activeTab);
    const newIdx = TAB_ORDER.indexOf(tab);
    setAnimDir(newIdx > curIdx ? "left" : "right");
    setActiveTab(tab);
    if (typeof window !== "undefined") localStorage.setItem(LS_ACTIVE_TAB, tab);
  }, [activeTab]);

  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      t: Date.now(),
    };
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStart.current.y);
    const elapsed = Date.now() - touchStart.current.t;
    touchStart.current = null;

    if (Math.abs(dx) < 90 || dy > 40 || elapsed < 80) return;

    const curIdx = TAB_ORDER.indexOf(activeTab);
    if (dx < 0 && curIdx < TAB_ORDER.length - 1) handleTabChange(TAB_ORDER[curIdx + 1]);
    if (dx > 0 && curIdx > 0) handleTabChange(TAB_ORDER[curIdx - 1]);
  }, [activeTab, handleTabChange]);

  const perps = usePerps(address);
  const displayPortfolio = useMemo(
    () => portfolioWithPerpsAccountValue(portfolio, perps.data),
    [portfolio, perps.data]
  );
  const snapshots = useSnapshots(address, displayPortfolio, perps.data);
  const intelligenceForUi = useMemo(() => (
    displayPortfolio && intelligence
      ? { ...intelligence, risk: buildUnifiedRiskSummary(displayPortfolio, perps.data) }
      : intelligence
  ), [displayPortfolio, intelligence, perps.data]);
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
  const alerts = useAlerts(displayPortfolio, intelligenceForUi, snapshots.snapshots, perps.data);
  const { currency, setCurrency, rates, format } = useFxRate();
  const riskLevel = getLegacyRiskLevel(intelligenceForUi?.risk.overallState ?? "Safe");
  const RiskIcon = riskLevel === "safe" ? ShieldCheck : ShieldAlert;

  const handleSetGoal = useCallback((goal: PortfolioGoal) => {
    setSelectedGoalState(goal);
    if (typeof window !== "undefined") writeGoalPreference(window.localStorage, goal);
  }, []);

  const handleSetViewMode = useCallback((mode: DashboardViewMode) => {
    setViewModeState(mode);
    if (typeof window !== "undefined") writeDashboardViewMode(window.localStorage, mode);
  }, []);

  const handleDismissWalletCheckup = useCallback(() => {
    setShowWalletCheckup(false);
    if (typeof window !== "undefined") dismissWalletCheckup(window.localStorage, address);
  }, [address]);

  const handleRunWalletCheckupAgain = useCallback(() => {
    setShowWalletCheckup(true);
    if (typeof window !== "undefined") resetWalletCheckupDismissed(window.localStorage, address);
  }, [address]);

  const ActiveTabComponent = TAB_COMPONENTS[activeTab];

  return (
    <PWAContext.Provider value={{
      address, portfolio: displayPortfolio, intelligence: intelligenceForUi, providerStatus, timestamp,
      isLoading, isFetching, isError, error,
      onRefresh, onClear, onNewAddress, autoRefresh, onToggleAutoRefresh,
      perpsData: perps.data,
      perpsLoading: perps.isLoading,
      perpsTotalPnl: perps.totalUnrealizedPnl,
      perpsOpenCount: perps.allPositions.length,
      snapshots: snapshots.snapshots,
      chartData: snapshots.chartData,
      snapshotRange: snapshots.range,
      setSnapshotRange: snapshots.setRange,
      attribution: snapshots.attribution,
      hasHistory: snapshots.hasHistory,
      earliestSnapshot: snapshots.earliest?.timestamp,
      clearSnapshots: snapshots.clearAll,
      currency, setCurrency, rates, format,
      alertUnreadCount: alerts.unreadCount,
      viewMode,
      setViewMode: handleSetViewMode,
      visibleSections,
      selectedGoal,
      setSelectedGoal: handleSetGoal,
      trackedWallets,
      walletResults,
      stressSummary,
      goalFitSummary,
      walletCheckupSummary,
      showWalletCheckup,
      dismissWalletCheckup: handleDismissWalletCheckup,
      runWalletCheckupAgain: handleRunWalletCheckupAgain,
      openRiskMonitor: () => setRiskOpen(true),
      formatUSD,
    }}>
      <div className="flex flex-col bg-bg pwa-min-full-height">
        <PWATopBar
          onBrandClick={() => handleTabChange("overview")}
          onRiskClick={() => setRiskOpen(true)}
          riskLevel={riskLevel}
          onAlertClick={() => setAlertsOpen(true)}
          alertBadge={alerts.unreadCount}
        />

        <main
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px))" }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {!address ? (
            <PWAOnboarding onSubmit={onNewAddress} isLoading={isFetching} />
          ) : (
            <div
              key={activeTab}
              className="animate-fade-in"
              style={{ animationDuration: "0.18s" }}
              data-anim-direction={animDir ?? undefined}
            >
              <ActiveTabComponent />
            </div>
          )}
        </main>

        <BottomNav
          active={activeTab}
          onChange={handleTabChange}
          alertBadge={alerts.unreadCount}
        />

        <PWASheet
          open={riskOpen}
          onClose={() => setRiskOpen(false)}
          title="Risk Monitor"
          subtitle={intelligenceForUi ? getRiskSummaryLine(intelligenceForUi.risk) : "Risk data will appear after the portfolio loads."}
          icon={RiskIcon}
        >
          {displayPortfolio && intelligenceForUi ? (
            <RiskMonitor portfolio={displayPortfolio} intelligence={intelligenceForUi} perps={perps.data} />
          ) : (
            <div className="rounded-2xl border border-border bg-surface px-4 py-6 text-sm text-text-mid">
              Risk data is not available yet.
            </div>
          )}
        </PWASheet>

        <PWASheet
          open={alertsOpen}
          onClose={() => setAlertsOpen(false)}
          title="Alerts"
          subtitle={intelligenceForUi ? getAlertStatusCopy(intelligenceForUi.risk, alerts.events.length) : "Alert data will appear after the portfolio loads."}
          icon={Bell}
        >
          <AlertsCenter
            rules={alerts.rules}
            events={alerts.events}
            unreadCount={alerts.unreadCount}
            emptyStateTone={intelligenceForUi?.risk.overallState ?? "Safe"}
            emptyStateTitle={intelligenceForUi ? getAlertStatusCopy(intelligenceForUi.risk, 0) : "No alert rules have fired"}
            emptyStateSubtitle={intelligenceForUi?.risk.summaryCopy ?? "Your portfolio is still being monitored."}
            onReadAll={alerts.readAll}
            onDismiss={alerts.dismiss}
            onToggleRule={alerts.toggleRule}
            onDeleteRule={alerts.removeRule}
            onAddRule={alerts.addRule}
          />
        </PWASheet>
      </div>
    </PWAContext.Provider>
  );
}
