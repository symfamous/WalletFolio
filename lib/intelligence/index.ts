/**
 * lib/intelligence/index.ts
 *
 * Portfolio Intelligence — powered by Zerion data only.
 * Answers: Where is my money? What changed? Anything risky? Earn or lose?
 */

import type {
  Portfolio, PortfolioIntelligence, PortfolioChange,
  ProfitBreakdown, HiddenFund,
  AggregatedHolding, ProtocolPosition, AllocationView,
} from "@/types";
import { MIN_VISIBLE_USD } from "@/types";
import { buildUnifiedRiskSummary } from "@/lib/riskTruth";

const CHART_COLORS = [
  "#3B82F6","#8B5CF6","#10B981","#ffb4ab","#EF4444",
  "#06B6D4","#00f3ff","#84CC16","#F97316","#6366F1",
  "#14B8A6","#A78BFA","#FCD34D","#FB7185","#34D399",
];

// ─── 1. Allocation ────────────────────────────────────────────────

function buildAllocation(portfolio: Portfolio): AllocationView {
  const total = portfolio.summary.totalUsdValue;

  const byToken = portfolio.aggregated
    .filter((h) => h.totalUsdValue > MIN_VISIBLE_USD)
    .slice(0, 15)
    .map((h, i) => ({
      symbol:     h.symbol,
      name:       h.name,
      logo:       h.logo,
      usdValue:   h.totalUsdValue,
      percentage: total > 0 ? (h.totalUsdValue / total) * 100 : 0,
      color:      CHART_COLORS[i % CHART_COLORS.length],
    }));

  return {
    byToken,
    byChain:    portfolio.chainAllocations.filter((c) => c.totalUsdValue > MIN_VISIBLE_USD),
    byProtocol: portfolio.protocolAllocations.filter((p) => p.netUsdValue > MIN_VISIBLE_USD),
  };
}

// ─── 2. 24h change ───────────────────────────────────────────────

function build24hChange(portfolio: Portfolio): PortfolioChange {
  const priced = portfolio.aggregated.filter(
    (h) => h.priceAvailable && h.priceChange24h !== undefined && h.totalUsdValue > MIN_VISIBLE_USD
  );

  let priceMovementUsd = 0;
  const movers: Array<{ symbol: string; logo?: string; changeUsd: number; changePct: number }> = [];

  for (const h of priced) {
    const pct    = h.priceChange24h ?? 0;
    const prev   = h.totalUsdValue / (1 + pct / 100);
    const change = h.totalUsdValue - prev;
    priceMovementUsd += change;
    movers.push({ symbol: h.symbol, logo: h.logo, changeUsd: change, changePct: pct });
  }

  let yieldEarnedUsd = 0;
  for (const proto of portfolio.protocols) {
    for (const pos of [...proto.deposits, ...proto.staked]) {
      if (pos.apy && pos.usdValue) {
        yieldEarnedUsd += (pos.usdValue * pos.apy / 100) / 365;
      }
    }
  }

  const rewardsClaimedUsd = portfolio.protocols.reduce((s, p) => s + p.totalRewardUsd, 0);
  const totalChange24hUsd = priceMovementUsd + yieldEarnedUsd;
  const totalUsd          = portfolio.summary.totalUsdValue;

  movers.sort((a, b) => Math.abs(b.changeUsd) - Math.abs(a.changeUsd));

  return {
    totalChange24hUsd,
    totalChange24hPct: totalUsd > 0 ? (totalChange24hUsd / totalUsd) * 100 : 0,
    priceMovementUsd,
    yieldEarnedUsd,
    rewardsClaimedUsd,
    gasCostsUsd: 0,
    topGainers: movers.filter((m) => m.changeUsd > 0).slice(0, 5),
    topLosers:  movers.filter((m) => m.changeUsd < 0).slice(0, 5),
  };
}

// ─── 4. Profit ───────────────────────────────────────────────────

function buildProfit(portfolio: Portfolio): ProfitBreakdown {
  const unrealized = portfolio.aggregated.reduce((sum, h) => {
    if (h.priceChange24h === undefined || !h.totalUsdValue || h.totalUsdValue <= MIN_VISIBLE_USD) return sum;
    const prev = h.totalUsdValue / (1 + h.priceChange24h / 100);
    return sum + (h.totalUsdValue - prev);
  }, 0);

  const rewardsTotal = portfolio.protocols.reduce((s, p) => s + p.totalRewardUsd, 0);
  const netTotal     = unrealized + rewardsTotal;
  const totalValue   = portfolio.summary.totalUsdValue;
  const base         = totalValue - netTotal;

  return {
    realized:     0,
    unrealized,
    yieldTotal:   0,
    rewardsTotal,
    gasCosts:     0,
    netTotal,
    roi:          base > 0 ? (netTotal / base) * 100 : 0,
    dataSource:   "estimated",
  };
}

// ─── Hidden funds scanner ─────────────────────────────────────────

function scanHidden(portfolio: Portfolio): HiddenFund[] {
  const funds: HiddenFund[] = [];
  const visibleProtocolIds = new Set(
    portfolio.protocols
      .filter((proto) => proto.netUsdValue >= MIN_VISIBLE_USD || proto.totalBorrowUsd > 0)
      .map((proto) => proto.id)
  );

  // Unclaimed rewards
  for (const proto of portfolio.protocols) {
    if (visibleProtocolIds.has(proto.id)) continue;

    for (const reward of proto.rewards) {
      const usd = reward.usdValue ?? 0;
      if (usd < 1) continue;
      funds.push({
        type: "unclaimed_reward", symbol: reward.symbol, name: reward.name, logo: reward.logo,
        chainSlug: reward.chainSlug, chainName: reward.chainName,
        chainColor: reward.chainColor, chainEmoji: reward.chainEmoji,
        balance: reward.balance, usdValue: usd, protocolName: proto.protocolName,
        description: `Unclaimed ${reward.symbol} rewards from ${proto.protocolName}`,
        actionable: true,
      });
    }
  }

  const deduped = new Map<string, HiddenFund>();
  for (const fund of funds) {
    const key = [
      fund.type,
      fund.chainSlug,
      fund.protocolName ?? "",
      fund.symbol,
      fund.usdValue.toFixed(2),
    ].join("|");
    if (!deduped.has(key)) deduped.set(key, fund);
  }

  return [...deduped.values()].sort((a, b) => b.usdValue - a.usdValue);
}

// ─── Main builder ─────────────────────────────────────────────────

export function buildPortfolioIntelligence(
  portfolio:  Portfolio,
  _pnl: null  // kept for signature compatibility, not used (Zerion-only)
): PortfolioIntelligence {
  return {
    allocation:  buildAllocation(portfolio),
    change24h:   build24hChange(portfolio),
    risk:        buildUnifiedRiskSummary(portfolio, null),
    profit:      buildProfit(portfolio),
    hiddenFunds: scanHidden(portfolio),
  };
}
