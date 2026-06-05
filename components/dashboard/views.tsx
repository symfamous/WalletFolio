"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, CircleDollarSign, Download, Eye, EyeOff, Sparkles } from "lucide-react";
import { AddressInput } from "@/components/wallet/AddressInput";
import { BehaviorInsights } from "@/components/intelligence/BehaviorInsights";
import { DebtToPaidTracker } from "@/components/intelligence/DebtToPaidTracker";
import { FirstWalletCheckupCard } from "@/components/intelligence/FirstWalletCheckupCard";
import { FxBar } from "@/components/common/FxBar";
import { GoalModeCard } from "@/components/intelligence/GoalModeCard";
import { HiddenFundsScanner } from "@/components/intelligence/HiddenFundsScanner";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { KnowledgeVault } from "@/components/intelligence/KnowledgeVault";
import { ActivityScore } from "@/components/intelligence/ActivityScore";
import { PushAlertsToggle } from "@/components/intelligence/PushAlertsToggle";
import { NftHoldings } from "@/components/portfolio/NftHoldings";
import { PerpPositions } from "@/components/portfolio/PerpPositions";
import { PortfolioBuckets } from "@/components/portfolio/PortfolioBuckets";
import { PortfolioIntelligence } from "@/components/intelligence/PortfolioIntelligence";
import { ProtocolPositions } from "@/components/portfolio/ProtocolPositions";
import { RiskMonitor } from "@/components/intelligence/RiskMonitor";
import { ScenarioSimulator } from "@/components/intelligence/ScenarioSimulator";
import { PortfolioValueChart } from "@/components/dashboard/PortfolioValueChart";
import { AllocationDonut } from "@/components/dashboard/AllocationDonut";
import { MoversHeatmap } from "@/components/dashboard/MoversHeatmap";
import { MarketContextBar } from "@/components/dashboard/MarketContextBar";
import { YieldOpportunities } from "@/components/dashboard/YieldOpportunities";
import { FundingRates } from "@/components/dashboard/FundingRates";
import { TrendingTokens } from "@/components/dashboard/TrendingTokens";
import { StablecoinHealth } from "@/components/dashboard/StablecoinHealth";
import { StatCard } from "@/components/ui/StatCard";
import { usePortfolioChart } from "@/hooks/usePortfolioChart";
import { useBenchmark } from "@/hooks/useBenchmark";
import { useHistory } from "@/hooks/useHistory";
import { buildPortfolioPnlLedger } from "@/lib/pnlLedger";
import { exportActivityCsv } from "@/lib/exportCsv";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { TargetPriceCalculator } from "@/components/intelligence/TargetPriceCalculator";
import { WalletHistory } from "@/components/wallet/WalletHistory";
import { GasAnalytics } from "@/components/wallet/GasAnalytics";
import { BenchmarkCard } from "@/components/dashboard/BenchmarkCard";
import { LiveTicker } from "@/components/dashboard/LiveTicker";
import { EarlyTrends } from "@/components/dashboard/EarlyTrends";
import { WalletSafetyScanner } from "@/components/intelligence/WalletSafetyScanner";
import { ApprovalsScanner } from "@/components/intelligence/ApprovalsScanner";
import { WalletManager } from "@/components/wallet/WalletManager";
import { DashboardHeader, PageIntro, ProviderBanner, QuickAccessSelector, SectionHeader, SpotlightCard, WalletSnapshotCard } from "@/components/dashboard/shared";
import { cn } from "@/lib/utils";
import { formatUSD } from "@/lib/utils";
import type { Portfolio, PortfolioApiResponse, PortfolioGoal, PortfolioGoalFitSummary, PortfolioIntelligence as PortfolioIntelligenceType, WalletCheckupSummary, SupportedCurrency } from "@/types";
import type { SnapshotRange } from "@/lib/snapshots";
import type { WalletEntry } from "@/hooks/useMultiWallet";
import type { WalletResult } from "@/hooks/useMultiPortfolio";
import type { PerpsApiResponse } from "@/types";
import type { SavedWallet } from "@/lib/wallets";

type QuickAccessItem = "risk" | "snapshot" | "buckets" | "goal" | "checkup";

export function OverviewView({
  address,
  portfolio,
  providerStatus,
  isFetching,
  timeStr,
  copied,
  onCopy,
  onRefresh,
  onClear,
  unreadAlerts,
  autoRefresh,
  format,
  currency,
  intelligence,
  perpsData,
  trackedWalletCount,
  selectedGoal,
  goalFitSummary,
  walletCheckupSummary,
  onSelectGoal,
  overviewQuickAccess,
  onOverviewQuickAccessChange,
  onRunCheckupAgain,
  onNavigate,
}: {
  address: string;
  portfolio: Portfolio;
  providerStatus?: PortfolioApiResponse["providerStatus"];
  isFetching: boolean;
  timeStr?: string;
  copied: boolean;
  onCopy: () => void;
  onRefresh: () => void;
  onClear: () => void;
  unreadAlerts: number;
  autoRefresh: boolean;
  format: (usd: number) => string;
  currency: SupportedCurrency;
  intelligence?: PortfolioIntelligenceType | null;
  perpsData?: PerpsApiResponse | null;
  trackedWalletCount: number;
  selectedGoal: PortfolioGoal;
  goalFitSummary: PortfolioGoalFitSummary | null;
  walletCheckupSummary: WalletCheckupSummary | null;
  onSelectGoal: (goal: PortfolioGoal) => void;
  overviewQuickAccess: QuickAccessItem;
  onOverviewQuickAccessChange: (item: QuickAccessItem) => void;
  onRunCheckupAgain: () => void;
  onNavigate: (id: string) => void;
}) {
  const s = portfolio.summary;
  const showLocal = currency !== "USD";
  const unpriced = Math.max(0, s.totalAssetCount - s.pricedAssetCount);
  // Real historical portfolio value (Zerion), with a range selector + benchmark.
  const [chartRange, setChartRange] = useState<SnapshotRange>("30D");
  const chart = usePortfolioChart(address, chartRange);
  const benchmark = useBenchmark(chartRange);
  const youReturn = useMemo(() => {
    const pts = chart.chartData;
    if (pts.length < 2 || !pts[0].total) return null;
    return ((pts[pts.length - 1].total - pts[0].total) / pts[0].total) * 100;
  }, [chart.chartData]);
  return (
    <div id="overview" className="space-y-4">
      <ProviderBanner
        status={providerStatus}
        hasRenderablePortfolio={s.totalUsdValue > 0 || portfolio.aggregated.length > 0 || portfolio.protocols.length > 0}
      />

      <LiveTicker symbols={portfolio.aggregated.slice(0, 8).map((h) => h.symbol)} />

      <MarketContextBar />

      {/* Hero: portfolio chart + bento KPI tiles */}
      <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <PortfolioValueChart
          totalUsd={s.totalUsdValue}
          change24h={s.change24h}
          localValue={showLocal ? format(s.totalUsdValue) : undefined}
          chartData={chart.chartData}
          range={chartRange}
          onRangeChange={setChartRange}
          hasHistory={chart.hasHistory}
          benchmark={{ you: youReturn, btc: benchmark.data?.btc ?? null, eth: benchmark.data?.eth ?? null }}
        />
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Wallet"
            value={formatUSD(s.walletUsdValue, { compact: true })}
            sub="spot balances"
          />
          <StatCard
            label="DeFi net"
            value={formatUSD(s.defiNetUsdValue, { compact: true })}
            sub={`${s.activeProtocolCount} protocol${s.activeProtocolCount === 1 ? "" : "s"}`}
            deltaTone={s.defiNetUsdValue >= 0 ? "positive" : "negative"}
          />
          <StatCard
            label="Chains"
            value={s.activeChainCount}
            sub="networks"
          />
          <StatCard
            label="Assets"
            value={s.pricedAssetCount}
            sub={unpriced > 0 ? `${unpriced} unpriced/dust hidden` : "all priced"}
          />
        </div>
      </section>

      {/* Allocation + Gainers/Losers heatmap */}
      <section className="grid gap-4 xl:grid-cols-2">
        <AllocationDonut portfolio={portfolio} />
        <MoversHeatmap portfolio={portfolio} />
      </section>

      {/* Vs market benchmark + gas spent */}
      <section className="grid gap-4 xl:grid-cols-2">
        <BenchmarkCard address={address} />
        <GasAnalytics address={address} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-text-mid">Top Holdings</p>
            <button type="button" onClick={() => onNavigate("holdings")} className="text-xs text-text-lo transition-colors hover:text-text-hi">
              View all
            </button>
          </div>
          <HoldingsTable portfolio={portfolio} address={address} compact limit={5} hideSidebar />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-text-mid">DeFi Positions · {formatUSD(portfolio.summary.defiNetUsdValue, { compact: true })} net</p>
            <button type="button" onClick={() => onNavigate("defi-positions")} className="text-xs text-text-lo transition-colors hover:text-text-hi">
              Expand
            </button>
          </div>
          <ProtocolPositions protocols={portfolio.protocols} totalDefiUsd={portfolio.summary.defiNetUsdValue} compact limit={4} />
        </div>
      </section>

      <YieldOpportunities portfolio={portfolio} address={address} />

      <section className="grid gap-4 xl:grid-cols-2">
        <TrendingTokens />
        <EarlyTrends />
      </section>

      <StablecoinHealth portfolio={portfolio} />

      <section className="rounded-[12px] border border-border bg-surface px-4 py-4 shadow-card">
        <div className={cn(
          "grid gap-3 items-start",
          overviewQuickAccess === "buckets" ? "grid-cols-1" : "xl:grid-cols-[220px_minmax(0,1fr)]"
        )}>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-text-lo">Desk Tools</p>
            <p className="mt-1 text-sm font-semibold text-text-hi">Secondary Analysis</p>
            <p className="mt-1 text-xs leading-relaxed text-text-mid">Risk, snapshot, goal mode, and checkup stay here without taking over Overview.</p>
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <QuickAccessSelector activeItem={overviewQuickAccess} onSelect={onOverviewQuickAccessChange} />
            {overviewQuickAccess === "risk" ? (
              intelligence ? (
                <RiskMonitor portfolio={portfolio} intelligence={intelligence} perps={perpsData} />
              ) : (
                <p className="text-sm text-text-mid">Risk truth will appear when portfolio intelligence is available.</p>
              )
            ) : null}
            {overviewQuickAccess === "snapshot" ? (
              <div id="wallet-snapshot">
                <WalletSnapshotCard address={address} portfolio={portfolio} trackedWalletCount={trackedWalletCount} />
              </div>
            ) : null}
            {overviewQuickAccess === "goal" ? (
              <div id="goal-mode">
                <GoalModeCard selectedGoal={selectedGoal} summary={goalFitSummary} onSelectGoal={onSelectGoal} />
              </div>
            ) : null}
            {overviewQuickAccess === "checkup" ? (
              <div id="wallet-checkup">
                <FirstWalletCheckupCard summary={walletCheckupSummary} onRunAgain={onRunCheckupAgain} />
              </div>
            ) : null}
            {overviewQuickAccess === "buckets" ? (
              <div id="buckets">
                <PortfolioBuckets portfolio={portfolio} />
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

export function WalletsView({
  trackedWallets,
  address,
  wallets,
  onNewAddress,
  isFetching,
}: {
  trackedWallets: WalletEntry[];
  address: string;
  wallets: {
    wallets: SavedWallet[];
    isCurrentSaved: boolean;
    saveWallet: (address: string, label: string) => void;
    removeWallet: (address: string) => void;
    renameWallet: (address: string, label: string) => void;
  };
  onNewAddress: (address: string) => void;
  isFetching: boolean;
}) {
  return (
    <div id="wallets" className="space-y-3.5">
      <SectionHeader
        title="Wallets"
        subtitle="Add, save, rename, and switch tracked wallets."
        kpis={[
          { label: "Tracked", value: trackedWallets.length, sub: "in workspace" },
          { label: "Saved", value: wallets.wallets.length, sub: "named wallets" },
        ]}
      />
      <SpotlightCard
        eyebrow="Wallet Control"
        title="Tracked Wallets"
        summary={`${trackedWallets.length} wallet${trackedWallets.length === 1 ? "" : "s"} tracked in this workspace.`}
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,1fr)]">
          <div className="rounded-[10px] border border-border bg-surface-raised p-3.5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <p className="text-sm font-medium text-text-hi">Track another wallet</p>
            </div>
            <AddressInput onSubmit={onNewAddress} isLoading={isFetching} />
          </div>
          <div className="rounded-[10px] border border-border bg-surface-raised p-3.5">
            <WalletManager
              wallets={wallets.wallets}
              currentAddress={address}
              isCurrentSaved={wallets.isCurrentSaved}
              onSaveCurrent={(label) => wallets.saveWallet(address, label)}
              onRemove={wallets.removeWallet}
              onRename={wallets.renameWallet}
              onSwitch={onNewAddress}
            />
          </div>
        </div>
      </SpotlightCard>
    </div>
  );
}

export function IntelligenceView({
  address,
  intelligence,
  portfolio,
  perpsData,
  format,
  currency,
  attribution,
  hasHistory,
  summary,
}: {
  address: string;
  intelligence?: PortfolioIntelligenceType | null;
  portfolio: Portfolio;
  perpsData?: PerpsApiResponse | null;
  format: (usd: number) => string;
  currency: SupportedCurrency;
  attribution: unknown;
  hasHistory: boolean;
  summary: string;
}) {
  const [workspaceTab, setWorkspaceTab] = useState<"analysis" | "vault" | "safety">("analysis");
  const workspaceTitle = workspaceTab === "analysis" ? "Analysis Workspace"
    : workspaceTab === "vault" ? "Wallet Vault" : "Wallet Safety Scanner";
  const workspaceSummary = workspaceTab === "analysis"
    ? summary
    : workspaceTab === "vault"
      ? "Connected notes for holdings, protocols, networks, trades, and transactions."
      : "Review approval transactions and wallet activity signals requiring attention.";

  return (
    <div id="intelligence" className="space-y-3.5">
      <SectionHeader
        title="Portfolio Intelligence"
        subtitle="Allocation, change, risk, and PnL — the analysis workspace."
        kpis={[
          { label: "Total value", value: formatUSD(portfolio.summary.totalUsdValue) },
          {
            label: "24h",
            value: portfolio.summary.change24h !== undefined
              ? `${portfolio.summary.change24h >= 0 ? "+" : ""}${portfolio.summary.change24h.toFixed(2)}%`
              : "—",
            tone: (portfolio.summary.change24h ?? 0) >= 0 ? "positive" : "negative",
          },
          { label: "Assets", value: portfolio.summary.pricedAssetCount, sub: "priced" },
          { label: "Chains", value: portfolio.summary.activeChainCount, sub: "networks" },
        ]}
      />
      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[10px] border border-border bg-surface-raised px-4 py-3.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-lo">Analysis Canvas</p>
          <h3 className="mt-1 text-[15px] font-semibold text-text-hi">Start with the active workspace</h3>
          <p className="mt-1 text-[11px] text-text-mid">Use this as the main read. Explorer pages are for raw detail.</p>
        </div>
        <div className="rounded-[10px] border border-border bg-surface-raised px-4 py-3.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-lo">Read Order</p>
          <p className="mt-1 text-[11px] leading-relaxed text-text-mid">Pick the question first, then read the output below.</p>
        </div>
      </div>
      <SpotlightCard
        title={workspaceTitle}
        summary={workspaceSummary}
        action={
          <div className="flex rounded-full border border-border bg-surface-raised p-1">
            {(["analysis", "vault", "safety"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setWorkspaceTab(tab)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs capitalize transition-colors",
                  workspaceTab === tab ? "bg-accent/12 text-accent" : "text-text-mid hover:text-text-hi"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        }
      >
        {workspaceTab === "vault" ? (
          <KnowledgeVault address={address} portfolio={portfolio} perps={perpsData} />
        ) : workspaceTab === "safety" ? (
          <div className="space-y-4">
            <ApprovalsScanner address={address} />
            <WalletSafetyScanner address={address} />
          </div>
        ) : intelligence ? (
          <div className="space-y-4">
            <ActivityScore address={address} portfolio={portfolio} perps={perpsData} />
            <PortfolioIntelligence
              pi={intelligence}
              portfolio={portfolio}
              format={format}
              currency={currency}
              attribution={attribution as never}
              hasHistory={hasHistory}
              tabPickerStyle="grid"
            />
          </div>
        ) : (
          <p className="text-sm text-text-mid">Portfolio intelligence becomes available as soon as tracked data is ready.</p>
        )}
      </SpotlightCard>
    </div>
  );
}

export function HoldingsView({ portfolio, address }: { portfolio: Portfolio; address?: string }) {
  const [holdingSection, setHoldingSection] = useState<"tokens" | "nfts">("tokens");
  return (
    <div id="holdings" className="space-y-3.5">
      <SectionHeader
        title="Holdings"
        subtitle="Spot positions, chain allocation, and explain workflows."
        kpis={[
          { label: "Total value", value: formatUSD(portfolio.summary.totalUsdValue) },
          { label: "Assets", value: portfolio.summary.pricedAssetCount, sub: "priced holdings" },
          { label: "Chains", value: portfolio.summary.activeChainCount, sub: "networks" },
          { label: "Wallet", value: formatUSD(portfolio.summary.walletUsdValue, { compact: true }), sub: "spot balances" },
        ]}
      />
      <SpotlightCard
        title={holdingSection === "tokens" ? "Asset Explorer" : "NFT Gallery"}
        summary={holdingSection === "tokens"
          ? `${portfolio.aggregated.length} assets grouped into a calmer explorer view.`
          : "OpenSea-verified collectibles with estimated value above $10."}
        action={
          <div className="flex rounded-full border border-border bg-surface-raised p-1">
            {(["tokens", "nfts"] as const).map((section) => (
              <button
                key={section}
                type="button"
                onClick={() => setHoldingSection(section)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs capitalize transition-colors",
                  holdingSection === section ? "bg-accent/12 text-accent" : "text-text-mid hover:text-text-hi"
                )}
              >
                {section}
              </button>
            ))}
          </div>
        }
      >
        {holdingSection === "tokens" ? (
          <HoldingsTable portfolio={portfolio} address={address} />
        ) : address ? (
          <NftHoldings address={address} />
        ) : (
          <p className="text-sm text-text-mid">Enter a wallet address to load verified NFTs.</p>
        )}
      </SpotlightCard>
    </div>
  );
}

export function DefiView({
  portfolio,
  hideDefi,
  onToggleHideDefi,
}: {
  portfolio: Portfolio;
  hideDefi: boolean;
  onToggleHideDefi: () => void;
}) {
  return (
    <div id="defi-positions" className="space-y-3.5">
      <SectionHeader
        title="DeFi"
        subtitle="Protocol positions, net value, and exposure."
        kpis={[
          { label: "DeFi net", value: formatUSD(portfolio.summary.defiNetUsdValue, { compact: true }), tone: portfolio.summary.defiNetUsdValue >= 0 ? "positive" : "negative" },
          { label: "Protocols", value: portfolio.summary.activeProtocolCount, sub: "active" },
          { label: "Positions", value: portfolio.protocols.length, sub: "tracked" },
          { label: "Borrows", value: formatUSD(portfolio.summary.totalBorrowUsdValue, { compact: true }), tone: portfolio.summary.totalBorrowUsdValue > 0 ? "negative" : "neutral" },
        ]}
      />
      <SpotlightCard
        title="DeFi Positions"
        summary={`${portfolio.protocols.length} protocols · ${formatUSD(portfolio.summary.defiNetUsdValue, { compact: true })} net`}
        action={
          <button
            type="button"
            onClick={onToggleHideDefi}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-raised px-3 py-2 text-xs text-text-mid transition-colors hover:border-border-strong hover:text-text-hi"
          >
            {hideDefi ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {hideDefi ? "Show DeFi" : "Hide DeFi"}
          </button>
        }
      >
        <div className="mb-3 rounded-[10px] border border-border bg-surface-raised px-3.5 py-2.5">
          <p className="text-[10px] text-text-mid">Scan concentration and net value first.</p>
        </div>
        {!hideDefi ? (
          <ProtocolPositions protocols={portfolio.protocols} totalDefiUsd={portfolio.summary.defiNetUsdValue} />
        ) : (
          <div className="rounded-[10px] border border-border bg-surface-raised px-4 py-5 text-sm text-text-mid">
            DeFi blocks are hidden for this dashboard pass. Use the toggle above to bring them back.
          </div>
        )}
      </SpotlightCard>
    </div>
  );
}

export function PerpsView({
  perpsData,
  isLoading,
}: {
  perpsData?: PerpsApiResponse | null;
  isLoading: boolean;
}) {
  return (
    <div id="perps" className="space-y-3.5">
      <SectionHeader
        title="Perps"
        subtitle="Leverage, liquidation distance, and unrealized PnL."
        kpis={[
          { label: "Account value", value: formatUSD(perpsData?.totalAccountValue ?? 0, { compact: true }) },
          { label: "Unrealized PnL", value: formatUSD(perpsData?.totalUnrealizedPnl ?? 0, { compact: true }), tone: (perpsData?.totalUnrealizedPnl ?? 0) >= 0 ? "positive" : "negative" },
          { label: "Open positions", value: perpsData?.openPositionCount ?? 0, sub: "live" },
          { label: "Lifetime PnL", value: formatUSD(perpsData?.netLifetimePnl ?? 0, { compact: true }), tone: (perpsData?.netLifetimePnl ?? 0) >= 0 ? "positive" : "negative" },
        ]}
      />
      <SpotlightCard
        title="Perp Positions"
        summary="Margin, liquidation distance, and PnL stay visually separated from core spot holdings."
      >
        <div className="mb-3 rounded-[10px] border border-danger/30 bg-danger/5 px-3.5 py-2.5">
          <p className="text-[11px] text-danger">Read this as a risk review first.</p>
        </div>
        <PerpPositions data={perpsData ?? null} isLoading={isLoading} />
      </SpotlightCard>

      <FundingRates highlightCoins={(perpsData?.allPositions ?? []).map((p) => p.coin)} />
    </div>
  );
}

export function HistoryView({
  address,
  initialViewMode,
  allowRawToggle,
  compact,
}: {
  address: string;
  initialViewMode: "explained" | "raw";
  allowRawToggle: boolean;
  compact: boolean;
}) {
  return (
    <div id="wallet-history" className="space-y-3.5">
      <SectionHeader
        title="History"
        subtitle="Explained activity first, with raw chain mode still available."
      />
      <SpotlightCard
        title="Wallet History"
        summary="Explained mode stays the human-first default with raw chain data still available."
      >
        <div className="mb-3 rounded-[10px] border border-border bg-surface-raised px-3.5 py-2.5">
          <p className="text-[10px] text-text-mid">Filters and the feed should be the first read here.</p>
        </div>
        <WalletHistory
          address={address}
          initialViewMode={initialViewMode}
          allowRawToggle={allowRawToggle}
          compact={compact}
        />
      </SpotlightCard>
    </div>
  );
}

export function ScenariosView({
  portfolio,
  selectedGoal,
  perpsData,
  format,
  currency,
}: {
  portfolio: Portfolio;
  selectedGoal: PortfolioGoal;
  perpsData?: PerpsApiResponse | null;
  format: (usd: number) => string;
  currency: SupportedCurrency;
}) {
  return (
    <div id="scenarios" className="space-y-3.5">
      <SectionHeader
        title="Scenarios"
        subtitle="Directional what-if analysis."
        kpis={[
          { label: "Total value", value: formatUSD(portfolio.summary.totalUsdValue) },
          { label: "Goal lens", value: selectedGoal },
        ]}
      />
      <SpotlightCard
        title="Scenario Simulator"
        summary="Directional what-if estimates based on the same bucket, stress, and goal logic."
      >
        <ScenarioSimulator portfolio={portfolio} selectedGoal={selectedGoal} perps={perpsData} format={format} currency={currency} />
      </SpotlightCard>
    </div>
  );
}

export function PatternsView({
  trackedWallets,
  walletResults,
  address,
  portfolio,
  perpsData,
  selectedGoal,
  intelligence,
  hiddenFundsSummary,
}: {
  trackedWallets: WalletEntry[];
  walletResults: WalletResult[];
  address: string;
  portfolio: Portfolio;
  perpsData?: PerpsApiResponse | null;
  selectedGoal: PortfolioGoal;
  intelligence?: PortfolioIntelligenceType | null;
  hiddenFundsSummary: string;
}) {
  return (
    <div id="patterns" className="space-y-3.5">
      <SectionHeader
        title="Patterns"
        subtitle="Cross-wallet and single-wallet behavior patterns."
        kpis={[
          { label: "Tracked wallets", value: trackedWallets.length },
          { label: "Goal lens", value: selectedGoal },
          { label: "Total value", value: formatUSD(portfolio.summary.totalUsdValue) },
        ]}
      />
      <SpotlightCard
        title="Behavior Insights"
        summary="Recurring portfolio and activity patterns from tracked wallets."
      >
        <BehaviorInsights
          trackedWallets={trackedWallets}
          walletResults={walletResults}
          activeAddress={address}
          portfolio={portfolio}
          perps={perpsData}
          selectedGoal={selectedGoal}
        />
      </SpotlightCard>

      {intelligence ? (
        <SpotlightCard
          id="hidden-funds"
          eyebrow="Opportunity"
          title="Hidden Funds"
          summary={hiddenFundsSummary}
        >
          <HiddenFundsScanner portfolio={portfolio} intelligence={intelligence} />
        </SpotlightCard>
      ) : null}
    </div>
  );
}

export function SettingsView({
  address,
  hasPriced,
  portfolio,
  format,
  currency,
  setCurrency,
  rates,
}: {
  address: string;
  hasPriced: boolean;
  portfolio: Portfolio;
  format: (usd: number) => string;
  currency: SupportedCurrency;
  setCurrency: (currency: SupportedCurrency) => void;
  rates: Record<string, number>;
}) {
  return (
    <div id="settings" className="space-y-3.5">
      <SectionHeader
        title="Tools"
        subtitle="Frontend-only utilities and display preferences."
      />
      {address ? <PushAlertsToggle address={address} /> : null}
      <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_340px]">
        {hasPriced ? (
          <div className="space-y-3.5">
            <div className="rounded-[12px] border border-border bg-surface p-4 shadow-card">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-text-lo">Primary Tool</p>
              <TargetPriceCalculator portfolio={portfolio} format={format} currency={currency} />
            </div>

            <div className="rounded-[12px] border border-border bg-surface p-4 shadow-card">
              <div className="mb-3 flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4 text-accent" strokeWidth={1.5} />
                <p className="text-[11px] font-medium uppercase tracking-wide text-text-lo">Debt To Paid</p>
              </div>
              <DebtToPaidTracker currency={currency} rates={rates} framed={false} />
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            <div className="rounded-[12px] border border-border bg-surface p-4 shadow-card">
              <p className="text-[11px] font-medium uppercase tracking-wide text-text-lo">Calculator</p>
              <p className="mt-2 text-lg font-semibold text-text-hi">Target Price Calculator</p>
              <p className="mt-2 text-sm text-text-mid">This wallet does not currently have priced holdings available for target calculations.</p>
            </div>

            <div className="rounded-[12px] border border-border bg-surface p-4 shadow-card">
              <div className="mb-3 flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4 text-accent" strokeWidth={1.5} />
                <p className="text-[11px] font-medium uppercase tracking-wide text-text-lo">Debt To Paid</p>
              </div>
              <DebtToPaidTracker currency={currency} rates={rates} framed={false} />
            </div>
          </div>
        )}

        <div className="space-y-3.5">
          <div className="rounded-[12px] border border-border bg-surface p-4 shadow-card">
            <p className="text-[11px] font-medium uppercase tracking-wide text-text-lo">Currency</p>
            <p className="mt-1.5 text-base font-semibold text-text-hi">Display Currency</p>
            <p className="mt-1.5 text-[11px] text-text-mid">Change display currency without affecting calculations.</p>
            <div className="mt-3">
              <FxBar currency={currency} onChangeCurrency={setCurrency} rates={rates} />
            </div>
          </div>

          <div className="rounded-[12px] border border-border bg-surface p-4 shadow-card">
            <p className="text-[11px] font-medium uppercase tracking-wide text-text-lo">Usage Notes</p>
            <div className="mt-2.5 space-y-2.5 text-[11px] leading-relaxed text-text-mid">
              <div className="flex gap-2">
                <ArrowUpRight className="mt-0.5 h-4 w-4 text-accent" />
                <p>Balance uses wallet holdings plus DeFi deposits, staked positions, and rewards while excluding liabilities.</p>
              </div>
              <div className="flex gap-2">
                <ArrowUpRight className="mt-0.5 h-4 w-4 text-accent" />
                <p>Scenario estimates stay directional and share the same portfolio buckets, goal-fit, and stress assumptions as the rest of the app.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PnlView({
  address,
  portfolio,
}: {
  address: string;
  portfolio: Portfolio;
}) {
  const history = useHistory(address);
  const ledger = useMemo(
    () => buildPortfolioPnlLedger(portfolio.aggregated, history.events),
    [portfolio.aggregated, history.events]
  );
  const signed = (v: number) => `${v >= 0 ? "+" : "-"}${formatUSD(Math.abs(v))}`;
  const tone = (v: number | undefined): "positive" | "negative" | "neutral" =>
    v === undefined ? "neutral" : v >= 0 ? "positive" : "negative";
  // Only list real holdings: a current value of at least $10 (hides dust/spam).
  const visibleAssets = ledger.assets.filter((a) => a.currentValueUsd >= 10);

  return (
    <div id="pnl" className="space-y-4">
      <SectionHeader
        title="Profit & Loss"
        subtitle="Cost basis, realized and unrealized P&L from loaded activity (FIFO)."
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => exportActivityCsv(address, history.events)}
            disabled={history.events.length === 0}
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        }
        kpis={[
          { label: "Net P&L (tracked)", value: signed(ledger.netTrackedPnlUsd), tone: tone(ledger.netTrackedPnlUsd) },
          { label: "Unrealized", value: signed(ledger.unrealizedPnlUsd), tone: tone(ledger.unrealizedPnlUsd) },
          { label: "Realized", value: signed(ledger.realizedPnlUsd), tone: tone(ledger.realizedPnlUsd) },
          { label: "Cost basis", value: formatUSD(ledger.trackedCostBasisUsd), sub: `${ledger.tradeCount} trades` },
        ]}
      />

      <SpotlightCard
        title="By asset"
        summary={ledger.note}
        action={
          history.isLoading ? <span className="text-xs text-text-lo">Loading activity…</span> : (
            <span className="rounded-full border border-border bg-surface-raised px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-lo">
              {ledger.coverage}
            </span>
          )
        }
      >
        <DataTable
          columns={[
            { header: "Asset", cell: (a) => <span className="font-medium text-text-hi">{a.symbol}</span> },
            { header: "Value", align: "right", cell: (a) => <span className="num">{formatUSD(a.currentValueUsd)}</span> },
            {
              header: "Cost basis",
              align: "right",
              cell: (a) => (
                <span className="num text-text-lo">
                  {a.trackedCostBasisUsd !== undefined ? formatUSD(a.trackedCostBasisUsd) : "—"}
                </span>
              ),
            },
            {
              header: "Unrealized",
              align: "right",
              cell: (a) => (
                <span className={cn("num", a.unrealizedPnlUsd === undefined ? "text-text-lo" : a.unrealizedPnlUsd >= 0 ? "text-success" : "text-danger")}>
                  {a.unrealizedPnlUsd !== undefined ? signed(a.unrealizedPnlUsd) : "—"}
                </span>
              ),
            },
            {
              header: "Realized",
              align: "right",
              cell: (a) => (
                <span className={cn("num", a.realizedPnlUsd >= 0 ? "text-success" : "text-danger")}>
                  {a.realizedPnlUsd !== 0 ? signed(a.realizedPnlUsd) : "—"}
                </span>
              ),
            },
          ]}
          rows={visibleAssets}
          rowKey={(a) => a.symbol}
          empty="No holdings above $10 to show yet — open History to load more activity."
        />
      </SpotlightCard>
    </div>
  );
}
