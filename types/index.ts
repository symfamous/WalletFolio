// ═══════════════════════════════════════════════════════════════════
// Zerion raw types — ONLY provider
// ═══════════════════════════════════════════════════════════════════

export interface ZerionFungibleInfo {
  name: string;
  symbol: string;
  description: string | null;
  icon: { url: string } | null;
  flags: { verified: boolean; is_trash: boolean };
  implementations: Array<{ chain_id: string; address: string | null; decimals: number }>;
}

export interface ZerionPositionAttributes {
  parent: string | null;
  // Zerion returns protocol as a string (e.g. "Morpho") in the positions endpoint
  protocol: string | { id: string; name: string } | null;
  name: string;
  position_type: "wallet" | "deposit" | "loan" | "reward" | "staked" | "locked" | "investment";
  quantity: { decimals: number; float: number; numeric: string };
  value: number | null;
  price: number | null;
  changes: { absolute_1d: number | null; percent_1d: number | null } | null;
  fungible_info: ZerionFungibleInfo;
  flags: { displayable: boolean; is_spam: boolean };
  updated_at: string;
  updated_at_block: number | null;
}

export interface ZerionPosition {
  type: "positions";
  id: string;
  attributes: ZerionPositionAttributes;
  relationships: {
    chain: { data: { type: "chains"; id: string } };
    fungible?: { data: { type: "fungibles"; id: string } };
  };
}

export interface ZerionChainAttributes {
  external_id: string;
  name: string;
  native_asset_id: string;
  flags: { supports_trading: boolean; supports_sending: boolean; supports_bridge: boolean };
  explorer: { name: string; home_url: string; tx_url: string; token_url: string } | null;
  icon: { url: string } | null;
}

export interface ZerionChain {
  type: "chains";
  id: string;
  attributes: ZerionChainAttributes;
}

export interface ZerionTransferFungible {
  name: string;
  symbol: string;
  icon: { url: string } | null;
  implementations: Array<{ chain_id: string; address: string | null; decimals: number }>;
}

export interface ZerionTransfer {
  fungible_info: ZerionTransferFungible;
  direction: "in" | "out" | "self";
  quantity: { float: number; decimals: number; numeric: string };
  value: number | null;
  price: number | null;
}

export interface ZerionTransaction {
  type: "transactions";
  id: string;
  attributes: {
    operation_type:
      | "trade" | "send" | "receive" | "approve"
      | "deposit" | "withdraw" | "borrow" | "repay"
      | "claim" | "bridge" | "stake" | "unstake"
      | "execute" | "cancel" | string;
    hash: string;
    mined_at: string;
    mined_at_block: number;
    sent_from: string;
    sent_to: string | null;
    status: "confirmed" | "failed" | "pending";
    nonce: number;
    fee: {
      fungible_info: ZerionTransferFungible;
      quantity: { float: number };
      value: number | null;
      price: number | null;
    } | null;
    transfers: ZerionTransfer[];
    approvals?: Array<{ fungible_info: ZerionTransferFungible; quantity: { float: number } }>;
  };
  relationships: { chain: { data: { id: string } } };
}

// ═══════════════════════════════════════════════════════════════════
// Normalized chain registry
// ═══════════════════════════════════════════════════════════════════

export interface ChainInfo {
  slug: string;
  numericId?: number;
  name: string;
  nativeAssetId: string;
  explorerUrl?: string;
  iconUrl?: string;
  color: string;
  emoji: string;
}

// ═══════════════════════════════════════════════════════════════════
// Normalized internal position
// ═══════════════════════════════════════════════════════════════════

export type PositionType =
  | "wallet" | "deposit" | "borrow" | "reward"
  | "staked" | "locked" | "lp";

export interface NormalizedPosition {
  id: string;
  symbol: string;
  name: string;
  logo?: string;
  contractAddress: string;
  decimals: number;
  fungibleId?: string;
  coingeckoId?: string;

  chainSlug: string;
  chainName: string;
  chainNumericId?: number;
  chainColor: string;
  chainEmoji: string;

  balance: number;
  rawBalance: string;

  price?: number;
  priceChange24h?: number;
  usdValue?: number;
  priceAvailable: boolean;

  source: "wallet" | "defi";
  positionType: PositionType;
  isLiability: boolean;
  isNative: boolean;
  isStablecoin: boolean;
  isSpam: boolean;
  isVerified: boolean;

  dataSource: "zerion" | "bitquery" | "projectx" | "covalent" | "zapper" | "moralis" | "hyperliquid" | "helius" | "jupiter" | "mobula";

  protocolId?: string;
  protocolName?: string;

  healthFactor?: number;
  collateralRatio?: number;
  liquidationPrice?: number;
  apy?: number;
}

// ═══════════════════════════════════════════════════════════════════
// Protocol positions
// ═══════════════════════════════════════════════════════════════════

export type ProtocolCategory =
  | "lending" | "borrowing" | "staking"
  | "liquidity" | "vault" | "reward" | "locked" | "dex" | "mixed";

export interface ProtocolPosition {
  id: string;
  protocolId: string;
  protocolName: string;
  protocolLogo?: string;
  dataSource: "zerion" | "bitquery" | "projectx" | "covalent" | "zapper" | "moralis" | "hyperliquid" | "helius" | "jupiter" | "mobula";

  chainSlug: string;
  chainName: string;
  chainColor: string;
  chainEmoji: string;

  category: ProtocolCategory;

  deposits: NormalizedPosition[];
  borrows: NormalizedPosition[];
  rewards: NormalizedPosition[];
  staked: NormalizedPosition[];
  locked: NormalizedPosition[];

  totalDepositUsd: number;
  totalBorrowUsd: number;
  totalRewardUsd: number;
  totalStakedUsd: number;
  netUsdValue: number;

  healthFactor?: number;
  collateralRatio?: number;
  liquidationPrice?: number;
  riskLevel?: "safe" | "moderate" | "risky" | "critical";
}

// ═══════════════════════════════════════════════════════════════════
// Aggregated holding
// ═══════════════════════════════════════════════════════════════════

export interface AggregatedHolding {
  aggregateKey: string;
  symbol: string;
  name: string;
  logo?: string;
  fungibleId?: string;
  coingeckoId?: string;

  price?: number;
  priceChange24h?: number;
  priceAvailable: boolean;

  totalBalance: number;
  totalUsdValue: number;
  walletBalance: number;
  walletUsdValue: number;
  defiBalance: number;
  defiUsdValue: number;

  isNative: boolean;
  isStablecoin: boolean;

  positions: NormalizedPosition[];
}

// ═══════════════════════════════════════════════════════════════════
// Allocations
// ═══════════════════════════════════════════════════════════════════

export interface ChainAllocation {
  chainSlug: string;
  chainName: string;
  chainColor: string;
  chainEmoji: string;
  totalUsdValue: number;
  percentage: number;
  tokenCount: number;
}

export interface ProtocolAllocation {
  protocolId: string;
  protocolName: string;
  netUsdValue: number;
  percentage: number;
  category: ProtocolCategory;
  chainSlug: string;
  chainName: string;
  chainColor: string;
}

// ═══════════════════════════════════════════════════════════════════
// Portfolio summary
// ═══════════════════════════════════════════════════════════════════

export interface PortfolioSummary {
  totalUsdValue: number;
  walletUsdValue: number;
  defiNetUsdValue: number;
  totalBorrowUsdValue: number;
  activeChainCount: number;
  activeProtocolCount: number;
  pricedAssetCount: number;
  totalAssetCount: number;
  change24h?: number;
  change24hAbsolute?: number;
  largestHolding?: AggregatedHolding;
}

export interface Portfolio {
  address: string;
  walletPositions: NormalizedPosition[];
  defiPositions: NormalizedPosition[];
  liabilities: NormalizedPosition[];
  protocols: ProtocolPosition[];
  aggregated: AggregatedHolding[];
  chainAllocations: ChainAllocation[];
  protocolAllocations: ProtocolAllocation[];
  summary: PortfolioSummary;
  lastUpdated: string;
}

// ═══════════════════════════════════════════════════════════════════
// Portfolio buckets
// ═══════════════════════════════════════════════════════════════════

export type PortfolioBucketId =
  | "safe_cash"
  | "long_term_holds"
  | "active_trades"
  | "defi_earn"
  | "locked_funds"
  | "forgotten_dust";

export type PortfolioBucketSourceKind =
  | "wallet"
  | "defi"
  | "perp"
  | "hidden_fund";

export interface PortfolioBucketEntry {
  id: string;
  bucketId: PortfolioBucketId;
  sourceKind: PortfolioBucketSourceKind;
  sourceLabel?: string;
  name: string;
  symbol: string;
  chainSlug: string;
  chainName: string;
  chainColor: string;
  chainEmoji: string;
  protocolName?: string;
  usdValue: number;
  reason: string;
}

export interface PortfolioBucketSummary {
  bucketId: PortfolioBucketId;
  label: string;
  description: string;
  totalUsdValue: number;
  percentage: number;
  itemCount: number;
  items: PortfolioBucketEntry[];
}

export type PositionExplanationType =
  | "spot"
  | "stable"
  | "defi"
  | "locked"
  | "perp"
  | "dust"
  | "other";

export type PositionRiskLevel = "Low" | "Medium" | "High";
export type PositionExitDifficulty = "Easy" | "Moderate" | "Hard" | "Locked";

export interface PositionExplanationMetadata {
  valueUsd?: number;
  change24hPct?: number;
  chain?: string;
  protocol?: string;
  leverage?: string;
  sourceType?: string;
  isStable?: boolean;
  isLocked?: boolean;
}

export interface PositionExplanation {
  title: string;
  subtitle?: string;
  type: PositionExplanationType;
  quickSummary: string;
  bucketLabel: string;
  bucketReason: string;
  riskLevel: PositionRiskLevel;
  riskReason: string;
  makesMoney: string[];
  losesMoney: string[];
  exitDifficulty: PositionExitDifficulty;
  exitReason: string;
  beginnerWarning: string;
  badges: string[];
  metadata?: PositionExplanationMetadata;
}

// ═══════════════════════════════════════════════════════════════════
// Portfolio Intelligence
// ═══════════════════════════════════════════════════════════════════

export interface PortfolioChange {
  totalChange24hUsd: number;
  totalChange24hPct: number;
  priceMovementUsd: number;
  yieldEarnedUsd: number;
  rewardsClaimedUsd: number;
  gasCostsUsd: number;
  topGainers: Array<{ symbol: string; logo?: string; changeUsd: number; changePct: number }>;
  topLosers:  Array<{ symbol: string; logo?: string; changeUsd: number; changePct: number }>;
}

export interface RiskAlert {
  id: string;
  severity: "info" | "warning" | "critical";
  protocolName: string;
  chainName: string;
  chainColor: string;
  chainEmoji: string;
  message: string;
  metricLabel?: string;
  metricValue?: string;
  riskScore: number;
}

export type UnifiedRiskState = "Safe" | "Watch" | "Risky" | "Critical";

export interface UnifiedRiskFactor {
  id: string;
  label: string;
  state: UnifiedRiskState;
  value?: number;
  score?: number;
  displayValue?: string;
  explanation: string;
  recommendation?: string;
  progressPct?: number;
}

export interface PortfolioRiskSummary {
  overallState: UnifiedRiskState;
  topReason: string;
  topRiskId?: string;
  topRiskLabel?: string;
  topRiskExplanation?: string;
  secondaryReasons: string[];
  summaryCopy: string;
  triggeredFactors: UnifiedRiskFactor[];
  safeFactors: UnifiedRiskFactor[];
  rankedFactors: UnifiedRiskFactor[];
  hasAlerts: boolean;
  leverage: {
    isActive: boolean;
    openPositions: number;
    accountValueUsd?: number;
    exposureUsd?: number;
    severity: "None" | "Watch" | "Risky" | "Critical";
    label: string;
    explanation: string;
    hasLiquidationPressure?: boolean;
    liquidationExplanation?: string;
    impliedLeverage?: number;
  };
}

export interface ProfitBreakdown {
  realized: number;
  unrealized: number;
  yieldTotal: number;
  rewardsTotal: number;
  gasCosts: number;
  netTotal: number;
  roi: number;
  dataSource: "zerion" | "estimated";
}

export interface HiddenFund {
  type: "unclaimed_reward" | "idle_balance" | "dust" | "abandoned_position";
  symbol: string;
  name: string;
  logo?: string;
  chainSlug: string;
  chainName: string;
  chainColor: string;
  chainEmoji: string;
  balance: number;
  usdValue: number;
  protocolName?: string;
  description: string;
  actionable: boolean;
}

export interface AllocationView {
  byToken: Array<{ symbol: string; name: string; logo?: string; usdValue: number; percentage: number; color: string }>;
  byChain: ChainAllocation[];
  byProtocol: ProtocolAllocation[];
}

export interface PortfolioIntelligence {
  allocation: AllocationView;
  change24h: PortfolioChange;
  risk: PortfolioRiskSummary;
  profit: ProfitBreakdown;
  hiddenFunds: HiddenFund[];
}

// ═══════════════════════════════════════════════════════════════════
// Wallet history
// ═══════════════════════════════════════════════════════════════════

export type HistoryEventType =
  | "send" | "receive" | "swap" | "approve"
  | "deposit" | "withdraw" | "borrow" | "repay"
  | "claim" | "bridge" | "stake" | "unstake" | "other";

export interface HistoryEvent {
  id: string;
  type: HistoryEventType;
  description: string;
  chainSlug: string;
  chainName: string;
  chainColor: string;
  chainEmoji: string;

  tokenSymbol?: string;
  tokenLogo?: string;
  tokenAmount?: number;
  toTokenSymbol?: string;
  toTokenLogo?: string;
  toTokenAmount?: number;

  usdValue?: number;
  counterparty?: string;

  txHash: string;
  explorerUrl?: string;
  timestamp: string;
  status: "confirmed" | "failed" | "pending";
  fee?: number;
  dataSource: "zerion" | "helius";
}

export interface HistoryApiResponse {
  events:    HistoryEvent[];
  hasMore:   boolean;
  cursor?:   string;
  page?:     number;
  nextPage?: number;
  provider?: "etherscan" | "zerion" | "helius";
  // Chain coverage metadata
  chainsQueried?:   number;
  chainsWithData?:  number;
  chainsAvailable?: number;
  freeTierNote?:    string;
  // Extended dual-provider metadata
  providerLabel?:    string;   // e.g. "Zerion + Etherscan"
  zerionEventCount?: number;
  escanEventCount?:  number;
  totalMerged?:      number;
}

export type ExplainedActivityType =
  | "swap"
  | "deposit"
  | "withdraw"
  | "bridge"
  | "trade"
  | "reward"
  | "send"
  | "receive"
  | "borrow"
  | "repay"
  | "approve"
  | "unknown";

export type ActivityRiskImpact = "Higher" | "Lower" | "Unchanged" | "Unknown";

export interface ExplainedActivity {
  id: string;
  title: string;
  subtitle?: string;
  type: ExplainedActivityType;
  plainEnglish: string;
  shortReason?: string;
  protocol?: string;
  chain?: string;
  tokenSymbols?: string[];
  usdValue?: number;
  isMeaningful: boolean;
  isNoise: boolean;
  riskImpact: ActivityRiskImpact;
  riskReason?: string;
  bucketImpact?: string;
  beginnerNote?: string;
  timestamp: string;
  rawEvent: HistoryEvent;
}

export interface ActivityFeedSummary {
  biggestAction: string;
  totalMeaningfulVolumeUsd?: number;
  newProtocol?: string;
  overallRiskDirection: "Higher" | "Lower" | "Mixed" | "Unchanged" | "Unknown";
  summaryLine: string;
}

export interface StressRankedItem {
  label: string;
  valueUsd?: number;
  reason: string;
  exitDifficulty: "Easy" | "Moderate" | "Hard" | "Locked";
}

export interface StressUrgentAction {
  id: string;
  text: string;
  priority: "High" | "Medium" | "Low";
}

export interface StressDangerSummary {
  label: string;
  explanation: string;
  type: "leverage" | "concentration" | "locked" | "liquidity" | "protocol" | "volatility" | "other";
  sourceId?: string;
  sourceType?: string;
}

export interface StressFactorSummary {
  id: string;
  label: string;
  state: "Safe" | "Watch" | "Risky" | "Critical";
  explanation: string;
}

export interface PortfolioStressSummary {
  overallState: "Safe" | "Watch" | "Risky" | "Critical";
  headline: string;
  biggestDanger: StressDangerSummary;
  defensiveCash: {
    totalUsd?: number;
    topItems: StressRankedItem[];
  };
  quickToSell: {
    totalUsd?: number;
    topItems: StressRankedItem[];
  };
  liquidAccess: {
    totalLiquidUsd?: number;
    topItems: StressRankedItem[];
  };
  limitedAccess: {
    totalLimitedUsd?: number;
    topItems: Array<Omit<StressRankedItem, "exitDifficulty"> & { exitDifficulty: "Moderate" | "Hard" | "Locked" }>;
  };
  urgentActions: StressUrgentAction[];
  stressFactors: StressFactorSummary[];
}

export type PortfolioGoal =
  | "Mostly Safe"
  | "Long-Term Growth"
  | "Active Trader"
  | "Learn Slowly"
  | "Balanced";

export type GoalFitState = "Strong Fit" | "Mostly Fits" | "Mixed" | "Poor Fit";
export type GoalFitLevel = "Good" | "Okay" | "Weak";

export interface GoalFitAreaSummary {
  label: string;
  explanation: string;
}

export interface GoalFitRecommendation {
  id: string;
  text: string;
  priority: "High" | "Medium" | "Low";
}

export interface GoalFitFactor {
  id: string;
  label: string;
  fit: GoalFitLevel;
  explanation: string;
}

export interface PortfolioGoalFitSummary {
  selectedGoal: PortfolioGoal;
  overallFitState: GoalFitState;
  fitScore?: number;
  headline: string;
  topMismatch: GoalFitAreaSummary;
  topAlignedArea: GoalFitAreaSummary;
  recommendations: GoalFitRecommendation[];
  factorBreakdown: GoalFitFactor[];
}

export interface WalletCheckupPriorityItem {
  id: string;
  text: string;
  priority: "First" | "Next" | "Keep in Mind";
}

export interface WalletCheckupAreaSummary {
  label: string;
  explanation: string;
}

export interface WalletCheckupComplexity {
  level: "Low" | "Medium" | "High";
  explanation: string;
}

export interface WalletCheckupConfidence {
  level: "High" | "Medium" | "Low";
  explanation: string;
}

export interface WalletCheckupSummary {
  walletStyle: WalletCheckupAreaSummary;
  complexity: WalletCheckupComplexity;
  biggestRisk: WalletCheckupAreaSummary;
  dominantArea: WalletCheckupAreaSummary;
  goalFit: {
    goal: PortfolioGoal;
    fitState: GoalFitState;
    explanation: string;
  };
  firstThingsToUnderstand: WalletCheckupPriorityItem[];
  helperNotes?: string[];
  dataConfidence?: WalletCheckupConfidence;
}

export type DashboardViewMode = "simple" | "full";

export type PortfolioScenarioId = string;

export type PortfolioScenarioType =
  | "asset_drop"
  | "close_leverage"
  | "reduce_risk"
  | "exit_protocol"
  | "increase_stables"
  | "unlock_liquidity"
  | "custom";

export interface PortfolioScenarioDefinition {
  id: PortfolioScenarioId;
  type: PortfolioScenarioType;
  title: string;
  description: string;
  priority: number;
  reasonGenerated: string;
}

export interface PortfolioScenarioBucketDelta {
  bucket: string;
  deltaUsd: number;
  deltaPctPoints?: number;
}

export interface PortfolioScenarioRiskDelta {
  before: UnifiedRiskState;
  after: UnifiedRiskState;
  summary: string;
}

export interface PortfolioScenarioGoalFitDelta {
  goal: PortfolioGoal;
  before: GoalFitState;
  after: GoalFitState;
  summary: string;
}

export interface PortfolioScenarioLiquidityDelta {
  defensiveCashDeltaUsd?: number;
  quickExitDeltaUsd?: number;
  slowerAccessDeltaUsd?: number;
  summary: string;
}

export interface PortfolioScenarioResult {
  scenarioId: PortfolioScenarioId;
  type: PortfolioScenarioType;
  title: string;
  description: string;
  priority: number;
  reasonGenerated: string;
  estimatedValueDeltaUsd?: number;
  estimatedValueDeltaPct?: number;
  bucketDeltas: PortfolioScenarioBucketDelta[];
  riskDelta: PortfolioScenarioRiskDelta;
  goalFitDelta?: PortfolioScenarioGoalFitDelta;
  liquidityDelta?: PortfolioScenarioLiquidityDelta;
  takeaway: string;
  assumptions: string[];
}

export type BehaviorInsightType =
  | "leverage"
  | "concentration"
  | "defensive_cash"
  | "fragmentation"
  | "protocol_dependence"
  | "goal_drift"
  | "liquidity"
  | "activity_pattern"
  | "other";

export type BehaviorInsightSeverity = "Low" | "Medium" | "High";
export type BehaviorInsightFrequency = "Occasional" | "Recurring" | "Frequent";
export type BehaviorInsightScope = "one_wallet" | "multiple_wallets" | "all_tracked_wallets";
export type BehaviorInsightConfidence = "Low" | "Medium" | "High";

export interface BehaviorInsight {
  id: string;
  type: BehaviorInsightType;
  title: string;
  summary: string;
  severity: BehaviorInsightSeverity;
  frequency: BehaviorInsightFrequency;
  appliesTo: BehaviorInsightScope;
  walletLabels?: string[];
  supportingSignals: string[];
  recommendation?: string;
  confidence: BehaviorInsightConfidence;
}

export interface BehaviorInsightsSummary {
  scope: "single_wallet" | "multi_wallet";
  walletsAnalyzed: number;
  timeWindow: {
    start?: string;
    end?: string;
  };
  insights: BehaviorInsight[];
  helperSummary?: string;
  coverageNote?: string;
}

export interface DashboardViewSections {
  checkup: boolean;
  goalMode: boolean;
  buckets: boolean;
  riskMonitor: boolean;
  behaviorInsights: boolean;
  portfolioIntelligence: boolean;
  stressEntry: boolean;
  activityFeed: boolean;
  detailedHoldings: boolean;
  detailedDefi: boolean;
  detailedPerps: boolean;
  alerts: boolean;
  hiddenFunds: boolean;
  timeline: boolean;
  targetCalculator: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// Hyperliquid perp types
// ═══════════════════════════════════════════════════════════════════

// Re-export from the perps provider for client-side use
export type {
  NormalizedPerpPosition as PerpPosition,
  NormalizedPerpPlatform,
} from "@/lib/providers/perps/types";

export interface PerpsApiResponse {
  platforms:          import("@/lib/providers/perps/types").NormalizedPerpPlatform[];
  allPositions:       import("@/lib/providers/perps/types").NormalizedPerpPosition[];
  totalUnrealizedPnl: number;
  totalRealizedPnl:   number;
  totalFunding:       number;
  totalFees:          number;
  netLifetimePnl:     number;
  totalAccountValue:  number;
  openPositionCount:  number;
  hasAnyPositions:    boolean;
  isPartialData:      boolean;
}

// ═══════════════════════════════════════════════════════════════════
// FX / Currency
// ═══════════════════════════════════════════════════════════════════

export interface FxRates {
  base: "USD";
  rates: Record<string, number>;
  updatedAt: string;
}

export type SupportedCurrency =
  | "USD" | "INR" | "EUR" | "GBP" | "AED"
  | "SGD" | "JPY" | "TRY" | "IDR" | "CAD"
  | "AUD" | "CHF" | "SAR" | "HKD" | "NPR";

export const CURRENCY_LABELS: Record<SupportedCurrency, string> = {
  USD: "US Dollar",   INR: "Indian Rupee",   EUR: "Euro",
  GBP: "British Pound", AED: "UAE Dirham",   SGD: "Singapore Dollar",
  JPY: "Japanese Yen",  TRY: "Turkish Lira", IDR: "Indonesian Rupiah",
  CAD: "Canadian Dollar", AUD: "Australian Dollar", CHF: "Swiss Franc",
  SAR: "Saudi Riyal",   HKD: "Hong Kong Dollar", NPR: "Nepali Rupee",
};

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  USD: "$", INR: "₹", EUR: "€", GBP: "£", AED: "د.إ",
  SGD: "S$", JPY: "¥", TRY: "₺", IDR: "Rp", CAD: "CA$",
  AUD: "A$", CHF: "Fr", SAR: "﷼", HKD: "HK$", NPR: "Rs",
};

// ═══════════════════════════════════════════════════════════════════
// API responses
// ═══════════════════════════════════════════════════════════════════

export interface PortfolioApiResponse {
  portfolio: Portfolio;
  intelligence: PortfolioIntelligence;
  /** Hyperliquid spot balances (normalized) + perp positions (separate from DeFi) */
  hyperliquidSpot?: {
    /** Normalized spot positions — USDC withdrawable + token balances with USD values */
    balances: NormalizedPosition[];
    withdrawable: number;
    perpPositions?: unknown[]; // NormalizedPerpPosition[] — avoid circular import
    perpPlatform?: string;
    perpUnrealizedPnl?: number;
    perpNetLifetime?: number;
  };
  providerStatus: {
    zerion?: "ok" | "error" | "partial" | "skipped";
    helius?: "ok" | "error" | "skipped";
    hyperliquid?: "ok" | "error" | "skipped";
    morpho?: "ok" | "error" | "skipped" | "partial";
    covalent?: "ok" | "error" | "skipped";
    zapper?: "ok" | "error" | "skipped";
    moralis?: "ok" | "error" | "skipped";
    bitquery?: "ok" | "error" | "skipped";
    jupiter?: "ok" | "error" | "skipped";
    mobula?: "ok" | "error" | "skipped";
    solanaRpc?: "ok" | "error" | "skipped";
    projectx?: "ok" | "error" | "skipped";
    fallbackUsed?: boolean;
    fallbackSource?: "zapper" | "moralis" | "covalent";
    fallbackReason?:
      | "timeout"
      | "rate_limit"
      | "network"
      | "server_error"
      | "http_error"
      | "disabled"
      | "circuit_open"
      | "unknown";
    fallbackCoverage?: "good" | "partial" | "minimal";
    error?: string;
  };
  timestamp: string;
}

export interface FxApiResponse {
  rates: Record<string, number>;
  updatedAt: string;
}

export interface NftHolding {
  id: string;
  identifier: string;
  name: string;
  collectionName: string;
  collectionSlug: string;
  imageUrl: string;
  openseaUrl: string;
  contract: string;
  chain: string;
  floorPrice: number;
  floorPriceSymbol: string;
  estimatedValueUsd: number;
  safelistStatus: "verified" | "unverified";
}

export interface NftApiResponse {
  nfts: NftHolding[];
  source: "opensea";
  scannedCount: number;
  collectionsScanned: number;
  filteredCount: number;
  candidateCollectionCount: number;
  collectionOffset: number;
  nextCollectionCursor?: number;
  incompleteCoverage: boolean;
  minValueUsd: number;
  configured: boolean;
  accessMode?: "configured" | "instant-free";
  note?: string;
}

// ═══════════════════════════════════════════════════════════════════
// Dust threshold & UI types
// ═══════════════════════════════════════════════════════════════════

/** Assets/positions with USD value <= this are hidden from the UI */
export const MIN_VISIBLE_USD = 6;

export type SortField = "value" | "balance" | "price" | "change" | "symbol";
export type SortDir = "asc" | "desc";
export type HoldingsView = "aggregated" | "wallet" | "defi";
export type ProviderStatus = "ok" | "error" | "partial";

export interface CalculatorResult {
  totalBalance: number;
  currentTokenValue: number;
  projectedTokenValue: number;
  tokenGainLoss: number;
  tokenGainLossPct: number;
  currentPortfolioValue: number;
  projectedPortfolioValue: number;
  portfolioGainLoss: number;
  portfolioGainLossPct: number;
}
