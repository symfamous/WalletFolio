import type { AggregatedHolding, HistoryEvent } from "@/types";

export type HoldingAcquisitionInsight = {
  firstAcquiredAt: string;
  firstAcquiredLabel: "First buy" | "First seen";
  costBasisUsd?: number;
  pnlUsd?: number;
  pnlPct?: number;
  confidence: "estimated" | "limited";
};

type AcquisitionLot = {
  timestamp: string;
  amount?: number;
  costUsd?: number;
  isBuy: boolean;
};

function normalizeSymbol(symbol?: string) {
  return symbol?.trim().toUpperCase() ?? "";
}

function getAcquisitionLot(event: HistoryEvent, symbol: string): AcquisitionLot | null {
  const tokenSymbol = normalizeSymbol(event.tokenSymbol);
  const toTokenSymbol = normalizeSymbol(event.toTokenSymbol);

  if (event.type === "swap" && toTokenSymbol === symbol) {
    return {
      timestamp: event.timestamp,
      amount: event.toTokenAmount,
      costUsd: event.usdValue,
      isBuy: true,
    };
  }

  if (["receive", "claim", "withdraw", "unstake", "borrow"].includes(event.type) && tokenSymbol === symbol) {
    return {
      timestamp: event.timestamp,
      amount: event.tokenAmount,
      costUsd: event.type === "receive" ? event.usdValue : undefined,
      isBuy: false,
    };
  }

  return null;
}

export function buildHoldingAcquisitionInsights(
  holdings: AggregatedHolding[],
  events: HistoryEvent[],
): Record<string, HoldingAcquisitionInsight> {
  const lotsBySymbol = new Map<string, AcquisitionLot[]>();

  for (const event of events) {
    const symbols = [event.tokenSymbol, event.toTokenSymbol].map(normalizeSymbol).filter(Boolean);
    for (const symbol of new Set(symbols)) {
      const lot = getAcquisitionLot(event, symbol);
      if (!lot) continue;
      const lots = lotsBySymbol.get(symbol) ?? [];
      lots.push(lot);
      lotsBySymbol.set(symbol, lots);
    }
  }

  const insights: Record<string, HoldingAcquisitionInsight> = {};

  for (const holding of holdings) {
    if (!holding.priceAvailable || holding.totalUsdValue <= 0) continue;

    const symbol = normalizeSymbol(holding.symbol);
    const lots = (lotsBySymbol.get(symbol) ?? [])
      .slice()
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (lots.length === 0) continue;

    const firstLot = lots[0];
    const costedLots = lots.filter((lot) => lot.costUsd !== undefined && lot.costUsd > 0);
    const acquiredAmount = costedLots.reduce((sum, lot) => sum + (lot.amount ?? 0), 0);
    const totalCostUsd = costedLots.reduce((sum, lot) => sum + (lot.costUsd ?? 0), 0);

    let costBasisUsd: number | undefined;
    if (totalCostUsd > 0) {
      costBasisUsd = acquiredAmount > 0
        ? (totalCostUsd / acquiredAmount) * Math.min(holding.totalBalance, acquiredAmount)
        : totalCostUsd;
    }

    const pnlUsd = costBasisUsd !== undefined ? holding.totalUsdValue - costBasisUsd : undefined;
    const pnlPct = costBasisUsd && costBasisUsd > 0 ? (pnlUsd! / costBasisUsd) * 100 : undefined;

    insights[holding.aggregateKey] = {
      firstAcquiredAt: firstLot.timestamp,
      firstAcquiredLabel: costedLots.some((lot) => lot.isBuy) ? "First buy" : "First seen",
      costBasisUsd,
      pnlUsd,
      pnlPct,
      confidence: costBasisUsd !== undefined ? "estimated" : "limited",
    };
  }

  return insights;
}
