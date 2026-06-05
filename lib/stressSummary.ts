import type {
  PerpsApiResponse,
  Portfolio,
  PortfolioBucketEntry,
  PortfolioStressSummary,
  StressDangerSummary,
  StressFactorSummary,
  StressRankedItem,
  StressUrgentAction,
  UnifiedRiskFactor,
} from "../types/index.ts";
import { getBucketablePortfolioEntries } from "./portfolioBuckets.ts";
import { buildUnifiedRiskSummary } from "./riskTruth.ts";
import { getPositionExitProfile } from "./positionExplainer.ts";

const STRESS_ENTRY_MIN_USD = 25;

function formatUsd(value?: number): string {
  if (value === undefined || value <= 0) return "$0";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function buildHeadline(overallState: PortfolioStressSummary["overallState"], topReason: string): string {
  return `${overallState} — ${topReason}`;
}

function formatHeadlineReason(topReason: string): string {
  return topReason.replace(/\.$/, "");
}

function toStressFactor(factor: UnifiedRiskFactor): StressFactorSummary {
  return {
    id: factor.id,
    label: factor.label,
    state: factor.state,
    explanation: factor.explanation,
  };
}

function buildBiggestDanger(
  portfolio: Portfolio,
  perps: PerpsApiResponse | null | undefined,
  topFactor: UnifiedRiskFactor | undefined,
  lockedTotalUsd: number
): StressDangerSummary {
  if (!topFactor) {
    return {
      label: "No major danger detected",
      explanation: "Your portfolio does not show an urgent stress point right now.",
      type: "other",
    };
  }

  switch (topFactor.id) {
    case "perp_leverage": {
      const topPerp = perps?.allPositions
        ?.slice()
        .sort((a, b) => (b.leverage * b.marginUsed) - (a.leverage * a.marginUsed))[0];
      return {
        label: topPerp ? `${topPerp.market}` : "Leveraged trading exposure",
        explanation: topPerp
          ? `${topPerp.market} has the most leverage, so it can move against you fastest.`
          : "Leverage is your main source of stress right now.",
        type: "leverage",
        sourceId: topPerp?.market,
        sourceType: "perp",
      };
    }
    case "perp_liquidation_pressure": {
      const topPerp = perps?.allPositions
        ?.filter((position) => typeof position.liqDistancePct === "number")
        .slice()
        .sort((a, b) => (a.liqDistancePct ?? Infinity) - (b.liqDistancePct ?? Infinity))[0];
      return {
        label: topPerp ? topPerp.market : "Perp liquidation pressure",
        explanation: topPerp
          ? `${topPerp.market} is the closest leveraged position to liquidation.`
          : "A leveraged position is getting closer to liquidation.",
        type: "leverage",
        sourceId: topPerp?.market,
        sourceType: "perp",
      };
    }
    case "protocol_concentration": {
      const protocol = portfolio.protocolAllocations[0];
      return {
        label: protocol ? protocol.protocolName : "Protocol concentration",
        explanation: protocol
          ? `${protocol.protocolName} holds most of your protocol exposure right now.`
          : "One protocol holds a large share of your portfolio.",
        type: "protocol",
        sourceId: protocol?.protocolId,
        sourceType: "protocol",
      };
    }
    case "top_holding": {
      const holding = portfolio.aggregated[0];
      return {
        label: holding ? holding.symbol : "Top holding concentration",
        explanation: holding
          ? `${holding.symbol} is your largest single holding right now.`
          : "One holding makes up a large share of your portfolio.",
        type: "concentration",
        sourceId: holding?.aggregateKey,
        sourceType: "holding",
      };
    }
    case "stablecoin_ratio": {
      const stableTooLow = (topFactor.value ?? 0) < 5;
      return {
        label: stableTooLow ? "Low liquid buffer" : "Large stablecoin tilt",
        explanation: stableTooLow
          ? "You do not have much defensive cash right now."
          : "A large share of your portfolio is already in stable assets.",
        type: "liquidity",
      };
    }
    case "chain_concentration": {
      const chain = portfolio.chainAllocations[0];
      return {
        label: chain ? chain.chainName : "Chain concentration",
        explanation: chain
          ? `${chain.chainName} holds a large share of your portfolio.`
          : "One chain holds a large share of your portfolio.",
        type: "concentration",
        sourceId: chain?.chainSlug,
        sourceType: "chain",
      };
    }
    case "borrow_exposure":
    case "liquidation_risk":
      return {
        label: topFactor.label,
        explanation: topFactor.explanation,
        type: "leverage",
      };
    default:
      if (lockedTotalUsd > 0 && topFactor.state !== "Safe") {
        return {
          label: "Locked or slower money",
          explanation: `${formatUsd(lockedTotalUsd)} may take extra steps to access.`,
          type: "locked",
        };
      }
      return {
        label: topFactor.label,
        explanation: topFactor.explanation,
        type: "other",
      };
  }
}

function toLiquidItem(entry: PortfolioBucketEntry): StressRankedItem {
  return {
    label: entry.protocolName ? `${entry.symbol} in wallet on ${entry.chainName}` : `${entry.symbol} on ${entry.chainName}`,
    valueUsd: entry.usdValue,
    reason: "Defensive cash already in your wallet.",
    exitDifficulty: "Easy",
  };
}

function toQuickSellItem(entry: PortfolioBucketEntry): StressRankedItem {
  return {
    label: `${entry.symbol} on ${entry.chainName}`,
    valueUsd: entry.usdValue,
    reason: "Quick to sell, but still volatile.",
    exitDifficulty: "Easy",
  };
}

function toLimitedItem(entry: PortfolioBucketEntry): PortfolioStressSummary["limitedAccess"]["topItems"][number] {
  const difficulty = entry.bucketId === "locked_funds"
    ? "Locked"
    : "Moderate";
  return {
    label: entry.protocolName ? `${entry.name} in ${entry.protocolName}` : `${entry.name} on ${entry.chainName}`,
    valueUsd: entry.usdValue,
    reason: entry.bucketId === "locked_funds"
      ? "Locked or on a limited exit."
      : "Needs a withdrawal step first.",
    exitDifficulty: difficulty,
  };
}

function uniqueActions(actions: StressUrgentAction[]): StressUrgentAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    if (seen.has(action.id)) return false;
    seen.add(action.id);
    return true;
  }).slice(0, 3);
}

function buildUrgentActions(
  overallState: PortfolioStressSummary["overallState"],
  factors: UnifiedRiskFactor[],
  liquidTotalUsd: number,
  limitedTotalUsd: number
): StressUrgentAction[] {
  const actions: StressUrgentAction[] = [];
  const ids = new Set(factors.map((factor) => factor.id));

  if (ids.has("perp_leverage")) {
    actions.push({ id: "review-leverage", text: "Review leveraged positions first.", priority: "High" });
  }
  if (ids.has("stablecoin_ratio")) {
    actions.push({ id: "check-defensive-funds", text: "Know how much of your money is truly defensive cash.", priority: "Medium" });
  }
  if (ids.has("protocol_concentration")) {
    actions.push({ id: "protocol-withdrawal-steps", text: "Know the exit steps for your biggest protocol.", priority: "Medium" });
  }
  if (limitedTotalUsd > 0) {
    actions.push({ id: "locked-not-cash", text: "Do not count locked balances as ready cash.", priority: "Medium" });
  }
  if (liquidTotalUsd <= 0 && overallState !== "Safe") {
    actions.push({ id: "check-liquid-funds", text: "Know which funds you can move quickly.", priority: "High" });
  }
  if (actions.length === 0) {
    actions.push({
      id: "keep-eye-on-concentration",
      text: overallState === "Safe"
        ? "Things look fairly steady right now. Keep an eye on concentration."
        : "Review your biggest risk and keep liquid funds easy to reach.",
      priority: "Low",
    });
  }

  return uniqueActions(actions);
}

export function buildPortfolioStressSummary(
  portfolio: Portfolio,
  perps?: PerpsApiResponse | null
): PortfolioStressSummary {
  const risk = buildUnifiedRiskSummary(portfolio, perps);
  const bucketEntries = getBucketablePortfolioEntries(portfolio);

  const topFactor = risk.triggeredFactors[0];
  const safeCashEntries = bucketEntries.filter((entry) => entry.bucketId === "safe_cash");
  const easyWalletEntries = bucketEntries.filter((entry) => entry.bucketId === "long_term_holds" && entry.sourceKind === "wallet");
  const defensiveCashEntries = safeCashEntries
    .filter((entry) => entry.usdValue >= STRESS_ENTRY_MIN_USD)
    .sort((a, b) => b.usdValue - a.usdValue);
  const quickSellEntries = easyWalletEntries
    .filter((entry) => entry.usdValue >= STRESS_ENTRY_MIN_USD)
    .sort((a, b) => b.usdValue - a.usdValue);
  const liquidCandidates = [...defensiveCashEntries, ...quickSellEntries];

  const limitedEntries = bucketEntries
    .filter((entry) => entry.bucketId === "locked_funds" || entry.bucketId === "defi_earn")
    .filter((entry) => entry.usdValue >= STRESS_ENTRY_MIN_USD)
    .sort((a, b) => b.usdValue - a.usdValue);

  const lockedTotalUsd = bucketEntries
    .filter((entry) => entry.bucketId === "locked_funds")
    .reduce((sum, entry) => sum + entry.usdValue, 0);
  const defensiveCashTotalUsd = defensiveCashEntries.reduce((sum, entry) => sum + entry.usdValue, 0);
  const quickSellTotalUsd = quickSellEntries.reduce((sum, entry) => sum + entry.usdValue, 0);
  const liquidTotalUsd = defensiveCashTotalUsd + quickSellTotalUsd;
  const limitedTotalUsd = limitedEntries.reduce((sum, entry) => sum + entry.usdValue, 0);

  const defensiveCashItems = defensiveCashEntries.slice(0, 4).map(toLiquidItem);
  const quickToSellItems = quickSellEntries.slice(0, 4).map(toQuickSellItem);
  const liquidAccessItems = [...defensiveCashItems, ...quickToSellItems].slice(0, 4);
  const limitedAccessItems = limitedEntries.slice(0, 4).map(toLimitedItem);

  if (defensiveCashItems.length === 0 && quickToSellItems.length === 0) {
    const fallbackWallet = portfolio.walletPositions
      .filter((position) => (position.usdValue ?? 0) > 0 && !position.isLiability)
      .sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0))[0];
    if (fallbackWallet) {
      const exit = getPositionExitProfile(fallbackWallet);
      quickToSellItems.push({
        label: `${fallbackWallet.symbol} on ${fallbackWallet.chainName}`,
        valueUsd: fallbackWallet.usdValue,
        reason: fallbackWallet.isStablecoin ? "Defensive cash already in your wallet." : "Quick to sell, but still volatile.",
        exitDifficulty: exit.level === "Easy" ? "Easy" : "Moderate",
      });
    }
  }

  if (limitedAccessItems.length === 0) {
    const fallbackDefi = portfolio.defiPositions
      .filter((position) => (position.usdValue ?? 0) > 0 && !position.isLiability)
      .sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0))[0];
    if (fallbackDefi) {
      const exit = getPositionExitProfile(fallbackDefi);
      if (exit.level !== "Easy") {
        limitedAccessItems.push({
          label: fallbackDefi.protocolName ? `${fallbackDefi.name} in ${fallbackDefi.protocolName}` : fallbackDefi.name,
          valueUsd: fallbackDefi.usdValue,
          reason: exit.reason,
          exitDifficulty: exit.level,
        });
      }
    }
  }

  return {
    overallState: risk.overallState,
    headline: buildHeadline(risk.overallState, formatHeadlineReason(risk.topReason)),
    biggestDanger: buildBiggestDanger(portfolio, perps, topFactor, lockedTotalUsd),
    defensiveCash: {
      totalUsd: defensiveCashTotalUsd > 0 ? defensiveCashTotalUsd : undefined,
      topItems: defensiveCashItems,
    },
    quickToSell: {
      totalUsd: quickSellTotalUsd > 0 ? quickSellTotalUsd : undefined,
      topItems: quickToSellItems,
    },
    liquidAccess: {
      totalLiquidUsd: liquidTotalUsd > 0 ? liquidTotalUsd : undefined,
      topItems: liquidAccessItems.length > 0 ? liquidAccessItems : [...defensiveCashItems, ...quickToSellItems],
    },
    limitedAccess: {
      totalLimitedUsd: limitedTotalUsd > 0 ? limitedTotalUsd : undefined,
      topItems: limitedAccessItems,
    },
    urgentActions: buildUrgentActions(risk.overallState, risk.triggeredFactors, liquidTotalUsd, limitedTotalUsd),
    stressFactors: risk.triggeredFactors.slice(0, 5).map(toStressFactor),
  };
}
