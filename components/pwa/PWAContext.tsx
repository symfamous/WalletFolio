"use client";

import { createContext, useContext } from "react";
import type {
  DashboardViewMode,
  DashboardViewSections,
  Portfolio,
  PortfolioApiResponse,
  PortfolioGoal,
  PortfolioGoalFitSummary,
  PortfolioIntelligence,
  PortfolioStressSummary,
  PerpsApiResponse,
  SupportedCurrency,
  WalletCheckupSummary,
} from "@/types";
import type { ChangeAttribution, PortfolioSnapshot, SnapshotRange } from "@/lib/snapshots";
import type { WalletEntry } from "@/hooks/useMultiWallet";
import type { WalletResult } from "@/hooks/useMultiPortfolio";

export interface PWADataContext {
  address:         string;
  portfolio?:      Portfolio;
  intelligence?:   PortfolioIntelligence;
  providerStatus?: PortfolioApiResponse["providerStatus"];
  timestamp?:      string;
  isLoading:       boolean;
  isFetching:      boolean;
  isError:         boolean;
  error?:          Error | null;
  onRefresh:       () => void;
  onClear:         () => void;
  onNewAddress:    (address: string) => void;
  autoRefresh:     boolean;
  onToggleAutoRefresh: () => void;
  // Perps
  perpsData?:        PerpsApiResponse | null;
  perpsLoading:      boolean;
  perpsTotalPnl:     number;
  perpsOpenCount:    number;
  // Snapshots
  snapshots:         PortfolioSnapshot[];
  chartData:         Array<{ timestamp: string; total: number; wallet: number; defi: number; perp: number; label: string }>;
  snapshotRange:     SnapshotRange;
  setSnapshotRange:  (r: SnapshotRange) => void;
  attribution?:      ChangeAttribution | null;
  hasHistory:        boolean;
  earliestSnapshot?: string;
  clearSnapshots:    () => void;
  // FX — use SupportedCurrency to match useFxRate hook
  currency:         SupportedCurrency;
  setCurrency:      (c: SupportedCurrency) => void;
  rates:            Record<string, number>;
  format:           (usd: number) => string;
  // Alerts
  alertUnreadCount: number;
  // Beginner-first mobile preferences and summaries
  viewMode:         DashboardViewMode;
  setViewMode:      (mode: DashboardViewMode) => void;
  visibleSections:  DashboardViewSections;
  selectedGoal:     PortfolioGoal;
  setSelectedGoal:  (goal: PortfolioGoal) => void;
  trackedWallets:   WalletEntry[];
  walletResults:    WalletResult[];
  stressSummary?:   PortfolioStressSummary | null;
  goalFitSummary?:  PortfolioGoalFitSummary | null;
  walletCheckupSummary?: WalletCheckupSummary | null;
  showWalletCheckup: boolean;
  dismissWalletCheckup: () => void;
  runWalletCheckupAgain: () => void;
  openRiskMonitor:  () => void;
  // Format helpers
  formatUSD:        (v: number, opts?: { compact?: boolean }) => string;
}

export const PWAContext = createContext<PWADataContext | null>(null);

export function usePWAData(): PWADataContext {
  const ctx = useContext(PWAContext);
  if (!ctx) throw new Error("usePWAData must be used inside PWAShell");
  return ctx;
}
