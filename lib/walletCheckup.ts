import type {
  PerpsApiResponse,
  Portfolio,
  PortfolioBucketSummary,
  PortfolioGoal,
  WalletCheckupPriorityItem,
  WalletCheckupSummary,
} from "@/types";
import { buildPortfolioBuckets } from "./portfolioBuckets.ts";
import { buildUnifiedRiskSummary } from "./riskTruth.ts";
import { buildPortfolioStressSummary } from "./stressSummary.ts";
import { buildPortfolioGoalFitSummary } from "./goalFit.ts";

function getDominantBucket(buckets: PortfolioBucketSummary[]) {
  return [...buckets]
    .filter((bucket) => bucket.totalUsdValue > 0)
    .sort((a, b) => b.totalUsdValue - a.totalUsdValue)[0];
}

function buildWalletStyle(
  portfolio: Portfolio,
  buckets: PortfolioBucketSummary[],
  risk = buildUnifiedRiskSummary(portfolio),
  stress = buildPortfolioStressSummary(portfolio)
) {
  const shares = Object.fromEntries(buckets.map((bucket) => [bucket.bucketId, bucket.percentage])) as Record<PortfolioBucketSummary["bucketId"], number>;
  const safeCash = shares.safe_cash ?? 0;
  const longTerm = shares.long_term_holds ?? 0;
  const active = shares.active_trades ?? 0;
  const defi = shares.defi_earn ?? 0;
  const locked = shares.locked_funds ?? 0;
  const dust = shares.forgotten_dust ?? 0;
  const protocolCount = portfolio.summary.activeProtocolCount;
  const chainCount = portfolio.summary.activeChainCount;

  if (risk.leverage.isActive && active >= 20) {
    return {
      label: "Active Trader",
      explanation: "A meaningful share of this wallet is tied to active trading.",
    };
  }

  if (safeCash >= 55 && !risk.leverage.isActive) {
    return {
      label: "Defensive Cash",
      explanation: "Most of this wallet is sitting in stable or defensive cash.",
    };
  }

  if (defi + locked >= 45 && protocolCount >= 1 && !risk.leverage.isActive) {
    return {
      label: "DeFi-Focused",
      explanation: "A large share of this wallet is inside protocols.",
    };
  }

  if ((chainCount >= 4 && dust >= 2.5) || (portfolio.aggregated.length >= 10 && dust >= 3)) {
    return {
      label: "Fragmented Wallet",
      explanation: "This wallet is spread across many small pieces, chains, or experiments.",
    };
  }

  if (risk.leverage.isActive && (defi >= 20 || locked >= 10 || longTerm >= 25)) {
    return {
      label: "Aggressive Mix",
      explanation: "This wallet mixes regular holdings with more active risk.",
    };
  }

  if (longTerm >= 50 && active < 10 && defi < 20) {
    return {
      label: "Mostly Spot",
      explanation: "Most of the value here looks like regular wallet holdings.",
    };
  }

  return {
    label: "Mixed Use Wallet",
    explanation: "This wallet mixes a few uses without leaning too hard into one style.",
  };
}

function buildComplexity(portfolio: Portfolio, buckets: PortfolioBucketSummary[], risk = buildUnifiedRiskSummary(portfolio)) {
  const dust = buckets.find((bucket) => bucket.bucketId === "forgotten_dust")?.percentage ?? 0;
  const defi = buckets.find((bucket) => bucket.bucketId === "defi_earn")?.percentage ?? 0;
  const locked = buckets.find((bucket) => bucket.bucketId === "locked_funds")?.percentage ?? 0;
  let score = 0;

  score += portfolio.summary.activeChainCount >= 4 ? 2 : portfolio.summary.activeChainCount >= 2 ? 1 : 0;
  score += portfolio.summary.activeProtocolCount >= 3 ? 2 : portfolio.summary.activeProtocolCount >= 1 ? 1 : 0;
  score += portfolio.aggregated.length >= 10 ? 2 : portfolio.aggregated.length >= 5 ? 1 : 0;
  score += dust >= 3 ? 1 : 0;
  score += defi + locked >= 30 ? 1 : 0;
  score += risk.leverage.isActive ? 2 : 0;
  score += (defi > 0 && risk.leverage.isActive) ? 1 : 0;

  if (score <= 2) {
    return {
      level: "Low" as const,
      explanation: "This wallet is fairly simple to understand.",
    };
  }
  if (score <= 5) {
    return {
      level: "Medium" as const,
      explanation: "This wallet has a few moving parts, but it is still manageable.",
    };
  }
  return {
    level: "High" as const,
    explanation: "This wallet is fairly complex for a beginner because it mixes several assets, venues, or strategy types.",
  };
}

function buildDominantArea(buckets: PortfolioBucketSummary[]) {
  const dominant = getDominantBucket(buckets);
  if (!dominant) {
    return {
      label: "No clear dominant area",
      explanation: "No one part of the tracked portfolio stands out yet.",
    };
  }

  return {
    label: dominant.label,
    explanation:
      dominant.bucketId === "safe_cash"
        ? "Most of this wallet is currently defensive cash."
        : dominant.bucketId === "long_term_holds"
        ? "Most of this wallet is in long-term holdings."
        : dominant.bucketId === "active_trades"
        ? "A meaningful share of this wallet is active trading exposure."
        : dominant.bucketId === "defi_earn"
        ? "A large share of this wallet is tied up in DeFi."
        : dominant.bucketId === "locked_funds"
        ? "A large share of this wallet is slower to access."
        : "A noticeable share of this wallet is fragmented into small leftovers.",
  };
}

function buildFirstThings(
  portfolio: Portfolio,
  selectedGoal: PortfolioGoal,
  buckets: PortfolioBucketSummary[],
  risk = buildUnifiedRiskSummary(portfolio),
  stress = buildPortfolioStressSummary(portfolio),
  goalFit = buildPortfolioGoalFitSummary(portfolio, selectedGoal)
): WalletCheckupPriorityItem[] {
  const items: WalletCheckupPriorityItem[] = [];
  const dominant = getDominantBucket(buckets);
  const dust = buckets.find((bucket) => bucket.bucketId === "forgotten_dust")?.percentage ?? 0;
  const safeCash = buckets.find((bucket) => bucket.bucketId === "safe_cash")?.percentage ?? 0;
  const locked = buckets.find((bucket) => bucket.bucketId === "locked_funds")?.percentage ?? 0;
  const defi = buckets.find((bucket) => bucket.bucketId === "defi_earn")?.percentage ?? 0;
  const topProtocol = portfolio.protocolAllocations[0]?.protocolName;
  const topHolding = portfolio.aggregated[0]?.symbol;

  if (risk.leverage.isActive) {
    items.push({
      id: "review-leverage",
      text: "Understand the leveraged position before anything else.",
      priority: "First",
    });
  }

  if (risk.topRiskId === "protocol_concentration") {
    items.push({
      id: "largest-protocol",
      text: topProtocol ? `Learn the withdrawal steps for ${topProtocol}.` : "Learn the withdrawal steps for your largest protocol position.",
      priority: items.length === 0 ? "First" : "Next",
    });
  }

  if (risk.topRiskId === "top_holding" || dominant?.bucketId === "long_term_holds") {
    items.push({
      id: "dominant-holding",
      text: topHolding ? `Know how much of this wallet depends on ${topHolding}.` : "Know which single holding matters most to this wallet.",
      priority: items.length === 0 ? "First" : "Next",
    });
  }

  if (safeCash < 10 && risk.overallState !== "Safe") {
    items.push({
      id: "defensive-cash",
      text: "Know how much of your money is truly defensive cash.",
      priority: items.length === 0 ? "First" : "Next",
    });
  }

  if ((stress.limitedAccess.totalLimitedUsd ?? 0) > 0 || locked > 5 || defi > 20) {
    items.push({
      id: "slow-money",
      text: "Separate quick exits from funds that need extra steps.",
      priority: items.length === 0 ? "First" : "Next",
    });
  }

  if (goalFit.overallFitState === "Poor Fit" || goalFit.overallFitState === "Mixed") {
    items.push({
      id: "goal-mismatch",
      text: `This wallet leans away from your ${selectedGoal.toLowerCase()} goal.`,
      priority: "Keep in Mind",
    });
  }

  if (dust >= 3 || portfolio.summary.activeChainCount >= 4) {
    items.push({
      id: "fragmentation",
      text: "This wallet is spread across many small pieces and chains.",
      priority: "Keep in Mind",
    });
  }

  const unique = new Set<string>();
  return items.filter((item) => {
    if (unique.has(item.id)) return false;
    unique.add(item.id);
    return true;
  }).slice(0, 4);
}

function buildDataConfidence(portfolio: Portfolio): WalletCheckupSummary["dataConfidence"] {
  if (portfolio.summary.pricedAssetCount === portfolio.summary.totalAssetCount) {
    return {
      level: "High",
      explanation: "Most tracked assets are priced and included here.",
    };
  }

  if (portfolio.summary.pricedAssetCount > 0) {
    return {
      level: "Medium",
      explanation: "Most of the wallet is visible, but some assets may still be partial.",
    };
  }

  return {
    level: "Low",
    explanation: "This checkup is based on limited priced data, so treat it as directional.",
  };
}

export function buildFirstWalletCheckup(
  portfolio: Portfolio,
  selectedGoal: PortfolioGoal,
  perps?: PerpsApiResponse | null
): WalletCheckupSummary {
  const buckets = buildPortfolioBuckets(portfolio);
  const risk = buildUnifiedRiskSummary(portfolio, perps);
  const stress = buildPortfolioStressSummary(portfolio, perps);
  const goalFit = buildPortfolioGoalFitSummary(portfolio, selectedGoal, perps);
  const walletStyle = buildWalletStyle(portfolio, buckets, risk, stress);
  const complexity = buildComplexity(portfolio, buckets, risk);
  const dominantArea = buildDominantArea(buckets);
  const biggestRisk = {
    label: risk.topRiskLabel ?? (risk.overallState === "Safe" ? "No major risk" : "Portfolio risk"),
    explanation: risk.topRiskExplanation ?? risk.topReason,
  };

  const firstThingsToUnderstand = buildFirstThings(portfolio, selectedGoal, buckets, risk, stress, goalFit);

  return {
    walletStyle,
    complexity,
    biggestRisk,
    dominantArea,
    goalFit: {
      goal: selectedGoal,
      fitState: goalFit.overallFitState,
      explanation: goalFit.headline,
    },
    firstThingsToUnderstand: firstThingsToUnderstand.length > 0 ? firstThingsToUnderstand : [{
      id: "keep-checking",
      text: "Keep an eye on your largest positions and your easiest-to-access cash.",
      priority: "Keep in Mind",
    }],
    helperNotes: portfolio.summary.totalBorrowUsdValue > 0
      ? ["Borrowed positions add extra pressure during stress."]
      : undefined,
    dataConfidence: buildDataConfidence(portfolio),
  };
}
