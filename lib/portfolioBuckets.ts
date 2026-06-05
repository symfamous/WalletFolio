import type {
  NormalizedPosition,
  Portfolio,
  PortfolioBucketEntry,
  PortfolioBucketId,
  PortfolioBucketSummary,
} from "../types";

const LOCKED_KEYWORDS = /\b(lock|locked|vesting|vested|cooldown|unlock|unbond|bonded)\b/i;
const ACTIVE_TRADE_KEYWORDS = /\b(perp|perps|perpetual|futures|margin|leveraged|leverage)\b/i;
const YIELD_POSITION_TYPES = new Set<NormalizedPosition["positionType"]>([
  "deposit",
  "staked",
  "reward",
  "lp",
]);

export const PORTFOLIO_BUCKET_DUST_THRESHOLD_USD = 10;
export const PORTFOLIO_BUCKET_TOTAL_TOLERANCE_USD = 0.01;

const BUCKET_ORDER: PortfolioBucketId[] = [
  "safe_cash",
  "long_term_holds",
  "active_trades",
  "defi_earn",
  "locked_funds",
  "forgotten_dust",
];

const BUCKET_META: Record<PortfolioBucketId, { label: string; description: string }> = {
  safe_cash: {
    label: "Safe Cash",
    description: "Lower-volatility money you can usually move quickly.",
  },
  long_term_holds: {
    label: "Long-Term Holds",
    description: "Regular assets you are mainly holding for the long run.",
  },
  active_trades: {
    label: "Active Trades",
    description: "Higher-risk money tied to active trading.",
  },
  defi_earn: {
    label: "DeFi Earn",
    description: "Money placed into protocols to earn yield.",
  },
  locked_funds: {
    label: "Locked Funds",
    description: "Money that may not be instantly withdrawable.",
  },
  forgotten_dust: {
    label: "Forgotten Dust",
    description: "Small leftover balances that do not matter much on their own.",
  },
};

export function getPortfolioBucketMeta(bucketId: PortfolioBucketId) {
  return BUCKET_META[bucketId];
}

export interface BucketClassificationInput {
  id: string;
  symbol: string;
  name: string;
  chainSlug: string;
  chainName: string;
  chainColor: string;
  chainEmoji: string;
  usdValue: number;
  protocolName?: string;
  sourceKind: PortfolioBucketEntry["sourceKind"];
  sourceLabel?: string;
  isStablecoin?: boolean;
  isLocked?: boolean;
  isYieldPosition?: boolean;
  isActiveTrade?: boolean;
  isLiability?: boolean;
}

export interface BuildPortfolioBucketsOptions {
  dustThresholdUsd?: number;
  toleranceUsd?: number;
}

export interface PortfolioBucketAccounting {
  expectedTotalUsd: number;
  canonicalEntryTotalUsd: number;
  bucketTotalUsd: number;
  differenceUsd: number;
  exceeds: boolean;
  matches: boolean;
}

function normalizeUsd(value: number | undefined): number {
  if (!isFinite(value ?? NaN)) return 0;
  return Math.max(0, value ?? 0);
}

function looksLocked(input: Pick<BucketClassificationInput, "name" | "protocolName" | "symbol">): boolean {
  return LOCKED_KEYWORDS.test([input.name, input.protocolName, input.symbol].filter(Boolean).join(" "));
}

function looksActiveTrade(input: Pick<BucketClassificationInput, "name" | "protocolName" | "symbol">): boolean {
  return ACTIVE_TRADE_KEYWORDS.test([input.name, input.protocolName, input.symbol].filter(Boolean).join(" "));
}

function inferPositionLocked(position: NormalizedPosition): boolean {
  return position.positionType === "locked" || looksLocked(position);
}

function inferPositionYield(position: NormalizedPosition): boolean {
  if (position.source !== "defi") return false;
  if (position.positionType === "locked") return false;
  return YIELD_POSITION_TYPES.has(position.positionType);
}

function inferPositionActiveTrade(position: NormalizedPosition): boolean {
  if (position.protocolId === "hyperliquid-perps") return true;
  return looksActiveTrade(position);
}

function inferSourceLabel(position: NormalizedPosition): string {
  if (inferPositionActiveTrade(position)) return "Trading";
  if (position.source === "defi") return "DeFi";
  return "Wallet";
}

function buildReason(input: BucketClassificationInput, bucketId: PortfolioBucketId): string {
  switch (bucketId) {
    case "safe_cash":
      return "Liquid stablecoin balance.";
    case "long_term_holds":
      return "Regular spot holding.";
    case "active_trades":
      return "Leveraged or actively traded exposure.";
    case "defi_earn":
      return "Yield position in a protocol.";
    case "locked_funds":
      return "Locked balance with a limited exit.";
    case "forgotten_dust":
      return "Small leftover balance.";
  }
}

export function getPortfolioBucketReason(
  input: BucketClassificationInput,
  bucketId: PortfolioBucketId
): string {
  return buildReason(input, bucketId);
}

export function classifyBucket(
  input: BucketClassificationInput,
  options: BuildPortfolioBucketsOptions = {}
): PortfolioBucketId | null {
  if (input.isLiability) return null;

  const usdValue = normalizeUsd(input.usdValue);
  const dustThresholdUsd = options.dustThresholdUsd ?? PORTFOLIO_BUCKET_DUST_THRESHOLD_USD;

  if (usdValue <= 0) return null;
  if (input.isLocked || looksLocked(input)) return "locked_funds";
  if (input.isActiveTrade || looksActiveTrade(input)) return "active_trades";
  if (usdValue <= dustThresholdUsd) return "forgotten_dust";
  if (input.isYieldPosition) return "defi_earn";
  if (input.isStablecoin) return "safe_cash";
  return "long_term_holds";
}

function positionToBucketInput(position: NormalizedPosition): BucketClassificationInput {
  return {
    id: position.id,
    symbol: position.symbol,
    name: position.name,
    chainSlug: position.chainSlug,
    chainName: position.chainName,
    chainColor: position.chainColor,
    chainEmoji: position.chainEmoji,
    usdValue: normalizeUsd(position.usdValue),
    protocolName: position.protocolName,
    sourceKind: position.source,
    sourceLabel: inferSourceLabel(position),
    isStablecoin: position.isStablecoin && position.source === "wallet" && !inferPositionActiveTrade(position),
    isLocked: inferPositionLocked(position),
    isYieldPosition: inferPositionYield(position),
    isActiveTrade: inferPositionActiveTrade(position),
    isLiability: position.isLiability,
  };
}

export function getBucketForPosition(
  position: NormalizedPosition,
  options: BuildPortfolioBucketsOptions = {}
): {
  bucketId: PortfolioBucketId;
  label: string;
  description: string;
  reason: string;
  input: BucketClassificationInput;
} | null {
  const input = positionToBucketInput(position);
  const bucketId = classifyBucket(input, options);
  if (!bucketId) return null;

  return {
    bucketId,
    label: BUCKET_META[bucketId].label,
    description: BUCKET_META[bucketId].description,
    reason: buildReason(input, bucketId),
    input,
  };
}

export function getBucketablePortfolioEntries(
  portfolio: Portfolio,
  options: BuildPortfolioBucketsOptions = {}
): PortfolioBucketEntry[] {
  const positions = [...portfolio.walletPositions, ...portfolio.defiPositions];

  return positions.flatMap((position) => {
    const input = positionToBucketInput(position);
    const bucketId = classifyBucket(input, options);
    if (!bucketId) return [];

    const entry: PortfolioBucketEntry = {
      id: input.id,
      bucketId,
      sourceKind: input.sourceKind,
      sourceLabel: input.sourceLabel,
      name: input.name,
      symbol: input.symbol,
      chainSlug: input.chainSlug,
      chainName: input.chainName,
      chainColor: input.chainColor,
      chainEmoji: input.chainEmoji,
      protocolName: input.protocolName,
      usdValue: input.usdValue,
      reason: buildReason(input, bucketId),
    };

    return [entry];
  });
}

export function checkPortfolioBucketAccounting(
  entries: PortfolioBucketEntry[],
  buckets: PortfolioBucketSummary[],
  expectedTotalUsd: number,
  toleranceUsd = PORTFOLIO_BUCKET_TOTAL_TOLERANCE_USD
): PortfolioBucketAccounting {
  const canonicalEntryTotalUsd = entries.reduce((sum, entry) => sum + entry.usdValue, 0);
  const bucketTotalUsd = buckets.reduce((sum, bucket) => sum + bucket.totalUsdValue, 0);
  const differenceUsd = bucketTotalUsd - expectedTotalUsd;

  return {
    expectedTotalUsd,
    canonicalEntryTotalUsd,
    bucketTotalUsd,
    differenceUsd,
    exceeds: bucketTotalUsd - expectedTotalUsd > toleranceUsd,
    matches: Math.abs(differenceUsd) <= toleranceUsd,
  };
}

export function assertPortfolioBucketAccounting(
  accounting: PortfolioBucketAccounting,
  context = "portfolio-buckets"
) {
  if (!accounting.matches) {
    throw new Error(
      `[${context}] bucket totals mismatch: canonical=$${accounting.canonicalEntryTotalUsd.toFixed(2)} buckets=$${accounting.bucketTotalUsd.toFixed(2)} portfolio=$${accounting.expectedTotalUsd.toFixed(2)} diff=$${accounting.differenceUsd.toFixed(4)}`
    );
  }
}

export function buildPortfolioBuckets(
  portfolio: Portfolio,
  options: BuildPortfolioBucketsOptions = {}
): PortfolioBucketSummary[] {
  const entries = getBucketablePortfolioEntries(portfolio, options);
  const expectedTotalUsd = portfolio.summary.totalUsdValue;

  const buckets = BUCKET_ORDER.map((bucketId) => {
    const items = entries
      .filter((entry) => entry.bucketId === bucketId)
      .sort((a, b) => b.usdValue - a.usdValue);

    const totalUsdValue = items.reduce((sum, entry) => sum + entry.usdValue, 0);
    const meta = BUCKET_META[bucketId];

    return {
      bucketId,
      label: meta.label,
      description: meta.description,
      totalUsdValue,
      percentage: expectedTotalUsd > 0 ? (totalUsdValue / expectedTotalUsd) * 100 : 0,
      itemCount: items.length,
      items,
    };
  });

  const accounting = checkPortfolioBucketAccounting(
    entries,
    buckets,
    expectedTotalUsd,
    options.toleranceUsd ?? PORTFOLIO_BUCKET_TOTAL_TOLERANCE_USD
  );

  if (!accounting.matches) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        `[portfolio-buckets] bucket totals mismatch: canonical=$${accounting.canonicalEntryTotalUsd.toFixed(2)} buckets=$${accounting.bucketTotalUsd.toFixed(2)} portfolio=$${accounting.expectedTotalUsd.toFixed(2)} diff=$${accounting.differenceUsd.toFixed(4)}`
      );
    } else {
      assertPortfolioBucketAccounting(accounting);
    }
  }

  return buckets;
}
