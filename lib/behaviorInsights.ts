import { explainHistoryEvents } from "./activityExplainer.ts";
import { buildPortfolioGoalFitSummary } from "./goalFit.ts";
import { buildPortfolioBuckets } from "./portfolioBuckets.ts";
import { buildUnifiedRiskSummary } from "./riskTruth.ts";
import { buildPortfolioStressSummary } from "./stressSummary.ts";
import type { PortfolioSnapshot } from "./snapshots/index.ts";
import type {
  BehaviorInsight,
  BehaviorInsightConfidence,
  BehaviorInsightFrequency,
  BehaviorInsightScope,
  BehaviorInsightsSummary,
  HistoryEvent,
  PerpsApiResponse,
  Portfolio,
  PortfolioGoal,
} from "../types/index.ts";

const LOOKBACK_DAYS = 30;
const MAX_INSIGHTS = 5;
const LEVERAGE_ACTIVE_USD = 50;
const CONCENTRATION_SHARE_PCT = 45;
const PROTOCOL_DEPENDENCE_SHARE_PCT = 45;
const LOW_DEFENSIVE_CASH_PCT = 15;
const HIGH_FRAGMENTATION_ASSETS = 12;
const HIGH_FRAGMENTATION_CHAINS = 4;
const HIGH_FRAGMENTATION_PROTOCOLS = 4;
const HIGH_SLOW_ACCESS_SHARE_PCT = 35;
const MIN_SUPPORTING_SIGNALS = 2;

export interface BehaviorWalletInput {
  address: string;
  label: string;
  portfolio?: Portfolio;
  perps?: PerpsApiResponse | null;
  snapshots?: PortfolioSnapshot[];
  historyEvents?: HistoryEvent[];
}

interface WalletPatternSignal {
  address: string;
  label: string;
  leverageEpisodes: number;
  concentrationEpisodes: number;
  protocolEpisodes: number;
  lowCashSignals: number;
  fragmentationSignals: number;
  liquiditySignals: number;
  goalDriftSignals: number;
  activityRiskUpSignals: number;
  dustSignals: number;
  currentTopHolding?: string;
  currentTopProtocol?: string;
  currentRiskState?: "Safe" | "Watch" | "Risky" | "Critical";
  currentGoalFit?: "Strong Fit" | "Mostly Fits" | "Mixed" | "Poor Fit";
  currentSlowAccessShare?: number;
  currentSafeCashShare?: number;
}

function addCurrentSnapshot(wallet: BehaviorWalletInput): PortfolioSnapshot[] {
  const snapshots = [...(wallet.snapshots ?? [])];
  if (!wallet.portfolio) return snapshots;

  const totalUsdValue = wallet.portfolio.summary.totalUsdValue;
  const latestTimestamp = snapshots[snapshots.length - 1]?.timestamp;
  if (latestTimestamp && Date.now() - new Date(latestTimestamp).getTime() < 5 * 60 * 1000) {
    return snapshots;
  }

  snapshots.push({
    id: `${wallet.address}-current`,
    address: wallet.address,
    timestamp: new Date().toISOString(),
    totalUsdValue,
    walletUsdValue: wallet.portfolio.summary.walletUsdValue,
    defiNetUsdValue: wallet.portfolio.summary.defiNetUsdValue,
    totalBorrowUsdValue: wallet.portfolio.summary.totalBorrowUsdValue,
    perpUnrealizedPnl: wallet.perps?.totalUnrealizedPnl ?? 0,
    perpAccountValue: wallet.perps?.totalAccountValue ?? 0,
    activeChainCount: wallet.portfolio.summary.activeChainCount,
    activeProtocolCount: wallet.portfolio.summary.activeProtocolCount,
    assetCount: wallet.portfolio.summary.totalAssetCount,
    topHoldings: wallet.portfolio.aggregated.slice(0, 5).map((holding) => ({
      symbol: holding.symbol,
      usdValue: holding.totalUsdValue,
      price: holding.price ?? 0,
    })),
    chainAllocations: wallet.portfolio.chainAllocations.map((item) => ({
      chainSlug: item.chainSlug,
      chainName: item.chainName,
      usdValue: item.totalUsdValue,
    })),
    protocolAllocations: wallet.portfolio.protocolAllocations.map((item) => ({
      protocolId: item.protocolId,
      protocolName: item.protocolName,
      usdValue: item.netUsdValue,
    })),
    change24h: wallet.portfolio.summary.change24h,
    change24hAbsolute: wallet.portfolio.summary.change24hAbsolute,
  });

  return snapshots;
}

function getRecentSnapshots(wallet: BehaviorWalletInput): PortfolioSnapshot[] {
  const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  return addCurrentSnapshot(wallet).filter((snapshot) => new Date(snapshot.timestamp).getTime() >= cutoff);
}

function getShare(total: number, value?: number): number {
  return total > 0 && value ? (value / total) * 100 : 0;
}

function getFrequency(count: number): BehaviorInsightFrequency {
  if (count >= 5) return "Frequent";
  if (count >= 2) return "Recurring";
  return "Occasional";
}

function getConfidence(count: number, walletCount: number): BehaviorInsightConfidence {
  if (count >= 4 || (walletCount > 1 && count >= 3)) return "High";
  if (count >= 2) return "Medium";
  return "Low";
}

function getScope(walletCount: number, walletsAnalyzed: number): BehaviorInsightScope {
  if (walletCount >= 2 && walletCount === walletsAnalyzed) return "all_tracked_wallets";
  if (walletCount >= 2) return "multiple_wallets";
  return "one_wallet";
}

function getScopeLine(scope: BehaviorInsightScope, labels: string[]): string {
  if (scope === "all_tracked_wallets") return "It shows up across all tracked wallets.";
  if (scope === "multiple_wallets") return "It shows up across multiple wallets.";
  return labels[0] ? `It is mostly concentrated in ${labels[0]}.` : "It is mostly concentrated in one wallet.";
}

function getWalletSignals(wallet: BehaviorWalletInput, goal: PortfolioGoal): WalletPatternSignal | null {
  const snapshots = getRecentSnapshots(wallet);
  const explainedActivity = explainHistoryEvents(wallet.historyEvents ?? []);
  const hasCoverage = Boolean(wallet.portfolio) || snapshots.length > 0 || explainedActivity.length > 0;
  if (!hasCoverage) return null;

  let currentTopHolding: string | undefined;
  let currentTopProtocol: string | undefined;
  let currentRiskState: WalletPatternSignal["currentRiskState"];
  let currentGoalFit: WalletPatternSignal["currentGoalFit"];
  let currentSlowAccessShare: number | undefined;
  let currentSafeCashShare: number | undefined;
  let leverageEpisodes = snapshots.filter((snapshot) => snapshot.perpAccountValue >= LEVERAGE_ACTIVE_USD).length;
  let concentrationEpisodes = 0;
  let protocolEpisodes = 0;
  let lowCashSignals = 0;
  let fragmentationSignals = 0;
  let liquiditySignals = 0;
  let goalDriftSignals = 0;

  for (const snapshot of snapshots) {
    const topHoldingShare = getShare(snapshot.totalUsdValue, snapshot.topHoldings[0]?.usdValue);
    const topProtocolShare = getShare(snapshot.totalUsdValue, snapshot.protocolAllocations[0]?.usdValue);
    if (topHoldingShare >= CONCENTRATION_SHARE_PCT) concentrationEpisodes += 1;
    if (topProtocolShare >= PROTOCOL_DEPENDENCE_SHARE_PCT) protocolEpisodes += 1;
    if (
      snapshot.assetCount >= HIGH_FRAGMENTATION_ASSETS ||
      snapshot.activeChainCount >= HIGH_FRAGMENTATION_CHAINS ||
      snapshot.activeProtocolCount >= HIGH_FRAGMENTATION_PROTOCOLS
    ) {
      fragmentationSignals += 1;
    }
    if (getShare(snapshot.totalUsdValue, snapshot.defiNetUsdValue) >= HIGH_SLOW_ACCESS_SHARE_PCT) {
      liquiditySignals += 1;
    }
  }

  if (wallet.portfolio) {
    const risk = buildUnifiedRiskSummary(wallet.portfolio, wallet.perps);
    const goalFit = buildPortfolioGoalFitSummary(wallet.portfolio, goal, wallet.perps);
    const stress = buildPortfolioStressSummary(wallet.portfolio, wallet.perps);
    const bucketMap = new Map(buildPortfolioBuckets(wallet.portfolio).map((bucket) => [bucket.bucketId, bucket]));
    currentTopHolding = wallet.portfolio.aggregated[0]?.symbol;
    currentTopProtocol = wallet.portfolio.protocolAllocations[0]?.protocolName;
    currentRiskState = risk.overallState;
    currentGoalFit = goalFit.overallFitState;
    currentSafeCashShare = bucketMap.get("safe_cash")?.percentage ?? 0;
    currentSlowAccessShare = getShare(
      wallet.portfolio.summary.totalUsdValue,
      (stress.limitedAccess.totalLimitedUsd ?? 0) + (stress.quickToSell.totalUsd ?? 0)
    );

    if (risk.leverage.isActive) leverageEpisodes += 2;
    if (risk.topRiskId === "top_holding" || risk.topRiskId === "chain_concentration") concentrationEpisodes += 1;
    if (risk.topRiskId === "protocol_concentration") protocolEpisodes += 1;
    if ((currentSafeCashShare ?? 0) < LOW_DEFENSIVE_CASH_PCT && risk.overallState !== "Safe") lowCashSignals += 2;
    if ((stress.limitedAccess.totalLimitedUsd ?? 0) > 0 && currentSlowAccessShare >= HIGH_SLOW_ACCESS_SHARE_PCT) liquiditySignals += 2;
    if (
      wallet.portfolio.summary.totalAssetCount >= HIGH_FRAGMENTATION_ASSETS ||
      wallet.portfolio.summary.activeChainCount >= HIGH_FRAGMENTATION_CHAINS ||
      wallet.portfolio.summary.activeProtocolCount >= HIGH_FRAGMENTATION_PROTOCOLS ||
      (bucketMap.get("forgotten_dust")?.percentage ?? 0) >= 3
    ) {
      fragmentationSignals += 2;
    }
    if (goalFit.overallFitState === "Poor Fit") goalDriftSignals += 2;
    if (goalFit.overallFitState === "Mixed") goalDriftSignals += 1;
  }

  const activityRiskUpSignals = explainedActivity.filter((event) => event.riskImpact === "Higher" && event.isMeaningful).length;
  const activityRiskDownSignals = explainedActivity.filter((event) => event.riskImpact === "Lower" && event.isMeaningful).length;
  const dustSignals = explainedActivity.filter((event) => event.isNoise && event.type === "receive").length;
  const depositLikeSignals = explainedActivity.filter((event) => ["deposit", "trade", "borrow"].includes(event.type) && event.isMeaningful).length;
  const withdrawLikeSignals = explainedActivity.filter((event) => ["withdraw", "repay"].includes(event.type) && event.isMeaningful).length;

  if (activityRiskUpSignals >= 2 && activityRiskUpSignals > activityRiskDownSignals) lowCashSignals += 1;
  if (depositLikeSignals >= 2 && depositLikeSignals > withdrawLikeSignals) liquiditySignals += 1;
  if (dustSignals >= 2) fragmentationSignals += 1;
  if (goal === "Mostly Safe" && leverageEpisodes >= 2) goalDriftSignals += 1;
  if (goal === "Balanced" && (leverageEpisodes >= 2 || concentrationEpisodes >= 2)) goalDriftSignals += 1;
  if (goal === "Learn Slowly" && (fragmentationSignals >= 2 || leverageEpisodes >= 2)) goalDriftSignals += 1;

  return {
    address: wallet.address,
    label: wallet.label,
    leverageEpisodes,
    concentrationEpisodes,
    protocolEpisodes,
    lowCashSignals,
    fragmentationSignals,
    liquiditySignals,
    goalDriftSignals,
    activityRiskUpSignals,
    dustSignals,
    currentTopHolding,
    currentTopProtocol,
    currentRiskState,
    currentGoalFit,
    currentSlowAccessShare,
    currentSafeCashShare,
  };
}

function buildInsight(params: {
  id: string;
  type: BehaviorInsight["type"];
  title: string;
  walletSignals: WalletPatternSignal[];
  walletsAnalyzed: number;
  totalSignalCount: number;
  severity: BehaviorInsight["severity"];
  summary: string;
  supportingSignals: string[];
  recommendation?: string;
}): BehaviorInsight {
  const walletLabels = params.walletSignals.map((signal) => signal.label);
  const appliesTo = getScope(params.walletSignals.length, params.walletsAnalyzed);

  return {
    id: params.id,
    type: params.type,
    title: params.title,
    summary: `${params.summary} ${getScopeLine(appliesTo, walletLabels)}`.trim(),
    severity: params.severity,
    frequency: getFrequency(params.totalSignalCount),
    appliesTo,
    walletLabels,
    supportingSignals: params.supportingSignals,
    recommendation: params.recommendation,
    confidence: getConfidence(params.totalSignalCount, params.walletSignals.length),
  };
}

export function buildRecurringBehaviorInsights(
  wallets: BehaviorWalletInput[],
  goal: PortfolioGoal
): BehaviorInsightsSummary {
  const signals = wallets
    .map((wallet) => getWalletSignals(wallet, goal))
    .filter((wallet): wallet is WalletPatternSignal => wallet !== null);

  const walletsAnalyzed = signals.length;
  const scope = walletsAnalyzed > 1 ? "multi_wallet" : "single_wallet";
  const timestamps = wallets.flatMap((wallet) => getRecentSnapshots(wallet).map((snapshot) => snapshot.timestamp));
  const totalSnapshots = wallets.reduce((sum, wallet) => sum + getRecentSnapshots(wallet).length, 0);
  const totalHistoryEvents = wallets.reduce((sum, wallet) => sum + (wallet.historyEvents?.length ?? 0), 0);
  const insights: Array<BehaviorInsight & { score: number }> = [];

  const leverageWallets = signals.filter((signal) => signal.leverageEpisodes >= 2);
  if (leverageWallets.length > 0) {
    const totalSignalCount = leverageWallets.reduce((sum, signal) => sum + signal.leverageEpisodes, 0);
    const topWallet = leverageWallets[0];
    insights.push({
      ...buildInsight({
        id: "recurring-leverage",
        type: "leverage",
        title: "Leverage keeps reappearing",
        walletSignals: leverageWallets,
        walletsAnalyzed,
        totalSignalCount,
        severity: leverageWallets.some((signal) => signal.currentRiskState === "Critical" || signal.currentRiskState === "Risky") ? "High" : "Medium",
        summary: leverageWallets.length > 1
          ? "Leverage keeps becoming one of your main risk sources."
          : `Leverage stress mostly comes from ${topWallet.label}.`,
        supportingSignals: [
          `${totalSignalCount} leverage-heavy snapshot${totalSignalCount === 1 ? "" : "s"} in the recent window.`,
          topWallet.currentRiskState ? `Current risk state: ${topWallet.currentRiskState}.` : "Recent leverage signals were detected.",
        ],
        recommendation: "Review where leverage tends to re-enter your portfolio first.",
      }),
      score: 90 + totalSignalCount,
    });
  }

  const concentrationWallets = signals.filter((signal) => signal.concentrationEpisodes >= 2);
  if (concentrationWallets.length > 0) {
    const topHolding = concentrationWallets.find((signal) => signal.currentTopHolding)?.currentTopHolding ?? "one holding";
    const totalSignalCount = concentrationWallets.reduce((sum, signal) => sum + signal.concentrationEpisodes, 0);
    insights.push({
      ...buildInsight({
        id: "recurring-concentration",
        type: "concentration",
        title: "Concentration keeps becoming a main risk",
        walletSignals: concentrationWallets,
        walletsAnalyzed,
        totalSignalCount,
        severity: "High",
        summary: `${topHolding} or another concentrated exposure keeps taking too much weight.`,
        supportingSignals: [
          `${totalSignalCount} concentration-heavy snapshot${totalSignalCount === 1 ? "" : "s"} in the recent window.`,
          topHolding ? `${topHolding} is one of the repeated concentration drivers.` : "A repeated top-holding concentration pattern was detected.",
        ],
        recommendation: "Watch whether one holding keeps becoming the reason your risk rises.",
      }),
      score: 82 + totalSignalCount,
    });
  }

  const defensiveCashWallets = signals.filter((signal) => signal.lowCashSignals >= 2);
  if (defensiveCashWallets.length > 0) {
    const totalSignalCount = defensiveCashWallets.reduce((sum, signal) => sum + signal.lowCashSignals, 0);
    const topWallet = defensiveCashWallets[0];
    insights.push({
      ...buildInsight({
        id: "defensive-cash",
        type: "defensive_cash",
        title: "Defensive cash often stays thin",
        walletSignals: defensiveCashWallets,
        walletsAnalyzed,
        totalSignalCount,
        severity: "Medium",
        summary: topWallet.currentSafeCashShare !== undefined
          ? `Defensive cash is only about ${topWallet.currentSafeCashShare.toFixed(0)}% in one of the main affected wallets.`
          : "Defensive cash tends to stay light when risk is already elevated.",
        supportingSignals: [
          `${totalSignalCount} low-cash warning signal${totalSignalCount === 1 ? "" : "s"} in the recent window.`,
          "Higher-risk activity kept outweighing calmer moves.",
        ],
        recommendation: "Watch whether defensive cash drops when portfolio risk is already high.",
      }),
      score: 74 + totalSignalCount,
    });
  }

  const protocolWallets = signals.filter((signal) => signal.protocolEpisodes >= 2);
  if (protocolWallets.length > 0) {
    const protocolName = protocolWallets.find((signal) => signal.currentTopProtocol)?.currentTopProtocol ?? "one protocol";
    const totalSignalCount = protocolWallets.reduce((sum, signal) => sum + signal.protocolEpisodes, 0);
    insights.push({
      ...buildInsight({
        id: "protocol-dependence",
        type: "protocol_dependence",
        title: "One protocol keeps doing a lot of the work",
        walletSignals: protocolWallets,
        walletsAnalyzed,
        totalSignalCount,
        severity: "Medium",
        summary: `${protocolName} keeps showing up as a repeated dependency.`,
        supportingSignals: [
          `${totalSignalCount} protocol-concentration signal${totalSignalCount === 1 ? "" : "s"} in the recent window.`,
          protocolName ? `${protocolName} is the main repeated protocol.` : "A repeated protocol dependence pattern was detected.",
        ],
        recommendation: "Consider whether one protocol is becoming a repeated dependency.",
      }),
      score: 76 + totalSignalCount,
    });
  }

  const liquidityWallets = signals.filter((signal) => signal.liquiditySignals >= 2);
  if (liquidityWallets.length > 0) {
    const totalSignalCount = liquidityWallets.reduce((sum, signal) => sum + signal.liquiditySignals, 0);
    insights.push({
      ...buildInsight({
        id: "liquidity-pattern",
        type: "liquidity",
        title: "Money often ends up harder to access",
        walletSignals: liquidityWallets,
        walletsAnalyzed,
        totalSignalCount,
        severity: "Medium",
        summary: "Slower-access positions keep taking up a meaningful share of your wallet.",
        supportingSignals: [
          `${totalSignalCount} slower-access signal${totalSignalCount === 1 ? "" : "s"} in the recent window.`,
          "Deposits and active moves kept outweighing exits back to simpler holdings.",
        ],
        recommendation: "Watch whether more of your money keeps moving into slower-access positions.",
      }),
      score: 70 + totalSignalCount,
    });
  }

  const fragmentationWallets = signals.filter((signal) => signal.fragmentationSignals >= 2);
  if (fragmentationWallets.length > 0) {
    const totalSignalCount = fragmentationWallets.reduce((sum, signal) => sum + signal.fragmentationSignals, 0);
    insights.push({
      ...buildInsight({
        id: "fragmentation-pattern",
        type: "fragmentation",
        title: "Wallet clutter keeps building up",
        walletSignals: fragmentationWallets,
        walletsAnalyzed,
        totalSignalCount,
        severity: fragmentationWallets.some((signal) => signal.dustSignals >= 2) ? "Medium" : "Low",
        summary: "Small balances, extra assets, or extra chains keep reducing clarity.",
        supportingSignals: [
          `${totalSignalCount} fragmentation signal${totalSignalCount === 1 ? "" : "s"} in the recent window.`,
          "Small leftover balances kept appearing in activity or snapshots.",
        ],
        recommendation: "If you want a simpler setup, fragmentation is a good pattern to reduce first.",
      }),
      score: 64 + totalSignalCount,
    });
  }

  const goalDriftWallets = signals.filter((signal) => signal.goalDriftSignals >= 2);
  if (goalDriftWallets.length > 0) {
    const totalSignalCount = goalDriftWallets.reduce((sum, signal) => sum + signal.goalDriftSignals, 0);
    insights.push({
      ...buildInsight({
        id: "goal-drift",
        type: "goal_drift",
        title: "Your wallet tends to drift away from your goal",
        walletSignals: goalDriftWallets,
        walletsAnalyzed,
        totalSignalCount,
        severity: goalDriftWallets.some((signal) => signal.currentGoalFit === "Poor Fit") ? "High" : "Medium",
        summary: `${goal} keeps getting pulled off course by repeated risk or complexity patterns.`,
        supportingSignals: [
          `${totalSignalCount} goal-drift signal${totalSignalCount === 1 ? "" : "s"} in the recent window.`,
          `Current goal fit is ${goalDriftWallets[0].currentGoalFit ?? "mixed"} in one of the affected wallets.`,
        ],
        recommendation: "Notice which repeated behaviors keep pushing the wallet away from your chosen goal.",
      }),
      score: 72 + totalSignalCount,
    });
  }

  const activityWallets = signals.filter((signal) => signal.activityRiskUpSignals >= 3);
  if (activityWallets.length > 0) {
    const totalSignalCount = activityWallets.reduce((sum, signal) => sum + signal.activityRiskUpSignals, 0);
    insights.push({
      ...buildInsight({
        id: "activity-pattern",
        type: "activity_pattern",
        title: "Higher-risk moves keep repeating",
        walletSignals: activityWallets,
        walletsAnalyzed,
        totalSignalCount,
        severity: "Medium",
        summary: "Activity often moves from calmer positions back into riskier ones.",
        supportingSignals: [
          `${totalSignalCount} recent higher-risk activity signal${totalSignalCount === 1 ? "" : "s"}.`,
          "This is based on explained recent wallet activity, not just the current portfolio mix.",
        ],
        recommendation: "Watch whether the same higher-risk move keeps repeating after calmer periods.",
      }),
      score: 60 + totalSignalCount,
    });
  }

  const sorted = insights
    .filter((insight) => insight.supportingSignals.length >= MIN_SUPPORTING_SIGNALS)
    .filter((insight) => !(walletsAnalyzed <= 1 && totalSnapshots <= 1 && totalHistoryEvents <= 1 && insight.confidence === "Low"))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_INSIGHTS)
    .map(({ score: _score, ...insight }) => insight);

  const coverageNote = walletsAnalyzed <= 1
    ? "We currently have enough recent history for one wallet only."
    : `Based on the recent history available across ${walletsAnalyzed} tracked wallets.`;

  return {
    scope,
    walletsAnalyzed,
    timeWindow: {
      start: timestamps.sort()[0],
      end: timestamps.sort().at(-1),
    },
    insights: sorted,
    helperSummary: scope === "multi_wallet"
      ? "Repeated patterns from your tracked wallets."
      : "Repeated patterns from this wallet.",
    coverageNote,
  };
}
