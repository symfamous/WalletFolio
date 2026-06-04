import type { AggregatedHolding, HistoryEvent } from "@/types";

interface CostLot {
  quantity: number;
  costUsd: number;
}

export interface PnlLedgerAsset {
  symbol: string;
  currentValueUsd: number;
  trackedCostBasisUsd?: number;
  unrealizedPnlUsd?: number;
  realizedPnlUsd: number;
}

export interface PortfolioPnlLedger {
  assets: PnlLedgerAsset[];
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  incomeUsd: number;
  feesUsd: number;
  netTrackedPnlUsd: number;
  trackedCostBasisUsd: number;
  tradeCount: number;
  pricedEventCount: number;
  coverage: "tracked" | "partial" | "limited";
  note: string;
}

function normalizedSymbol(symbol: string | undefined): string | undefined {
  const value = symbol?.trim().toUpperCase();
  return value || undefined;
}

function addLot(lots: Map<string, CostLot[]>, symbol: string | undefined, quantity: number | undefined, costUsd: number | undefined) {
  const key = normalizedSymbol(symbol);
  if (!key || !quantity || quantity <= 0 || costUsd === undefined || costUsd < 0) return;
  const assetLots = lots.get(key) ?? [];
  assetLots.push({ quantity, costUsd });
  lots.set(key, assetLots);
}

function consumeLots(lots: Map<string, CostLot[]>, symbol: string | undefined, quantity: number | undefined): number | undefined {
  const key = normalizedSymbol(symbol);
  if (!key || !quantity || quantity <= 0) return undefined;
  const assetLots = lots.get(key);
  if (!assetLots?.length) return undefined;

  let remaining = quantity;
  let consumedCost = 0;
  let consumedQuantity = 0;
  while (remaining > 0 && assetLots.length > 0) {
    const lot = assetLots[0];
    const used = Math.min(remaining, lot.quantity);
    const cost = lot.quantity > 0 ? (lot.costUsd / lot.quantity) * used : 0;
    consumedCost += cost;
    consumedQuantity += used;
    lot.quantity -= used;
    lot.costUsd -= cost;
    remaining -= used;
    if (lot.quantity <= Number.EPSILON) assetLots.shift();
  }
  return consumedQuantity > 0 ? consumedCost : undefined;
}

export function buildPortfolioPnlLedger(
  holdings: AggregatedHolding[],
  events: HistoryEvent[]
): PortfolioPnlLedger {
  const lots = new Map<string, CostLot[]>();
  const realizedBySymbol = new Map<string, number>();
  let realizedPnlUsd = 0;
  let incomeUsd = 0;
  let feesUsd = 0;
  let tradeCount = 0;
  let pricedEventCount = 0;

  const chronologicalEvents = [...events].sort(
    (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
  );

  for (const event of chronologicalEvents) {
    if (typeof event.fee === "number" && event.fee > 0) feesUsd += event.fee;
    if (typeof event.usdValue === "number" && event.usdValue >= 0) pricedEventCount += 1;

    if (event.type === "receive") {
      addLot(lots, event.tokenSymbol, event.tokenAmount, event.usdValue);
      continue;
    }

    if (event.type === "claim") {
      if (event.usdValue !== undefined) incomeUsd += event.usdValue;
      continue;
    }

    if (event.type === "send") {
      consumeLots(lots, event.tokenSymbol, event.tokenAmount);
      continue;
    }

    if (event.type !== "swap") continue;
    tradeCount += 1;
    const soldSymbol = normalizedSymbol(event.tokenSymbol);
    const cost = consumeLots(lots, soldSymbol, event.tokenAmount);
    if (cost !== undefined && event.usdValue !== undefined) {
      const realized = event.usdValue - cost;
      realizedPnlUsd += realized;
      if (soldSymbol) realizedBySymbol.set(soldSymbol, (realizedBySymbol.get(soldSymbol) ?? 0) + realized);
    }
    addLot(lots, event.toTokenSymbol, event.toTokenAmount, event.usdValue);
  }

  const currentValueBySymbol = new Map<string, number>();
  for (const holding of holdings) {
    const key = normalizedSymbol(holding.symbol);
    if (!key) continue;
    currentValueBySymbol.set(key, (currentValueBySymbol.get(key) ?? 0) + holding.totalUsdValue);
  }

  let unrealizedPnlUsd = 0;
  let trackedCostBasisUsd = 0;
  const assets = [...currentValueBySymbol.entries()]
    .map(([symbol, currentValueUsd]) => {
      const remainingLots = lots.get(symbol) ?? [];
      const costBasis = remainingLots.reduce((total, lot) => total + lot.costUsd, 0);
      const hasBasis = costBasis > 0;
      const unrealized = hasBasis ? currentValueUsd - costBasis : undefined;
      if (unrealized !== undefined) unrealizedPnlUsd += unrealized;
      trackedCostBasisUsd += costBasis;
      return {
        symbol,
        currentValueUsd,
        trackedCostBasisUsd: hasBasis ? costBasis : undefined,
        unrealizedPnlUsd: unrealized,
        realizedPnlUsd: realizedBySymbol.get(symbol) ?? 0,
      };
    })
    .sort((left, right) => right.currentValueUsd - left.currentValueUsd);

  const assetsWithBasis = assets.filter((asset) => asset.trackedCostBasisUsd !== undefined).length;
  const coverage = events.length === 0 || pricedEventCount === 0
    ? "limited"
    : assetsWithBasis === assets.length && assets.length > 0
      ? "tracked"
      : "partial";
  const note = coverage === "tracked"
    ? "Calculated from loaded, priced activity using FIFO cost lots. Transfers retain observed incoming value as basis."
    : "Calculated only from loaded priced activity. Missing older trades or USD values can leave cost basis and P&L incomplete.";

  return {
    assets,
    realizedPnlUsd,
    unrealizedPnlUsd,
    incomeUsd,
    feesUsd,
    netTrackedPnlUsd: realizedPnlUsd + unrealizedPnlUsd + incomeUsd - feesUsd,
    trackedCostBasisUsd,
    tradeCount,
    pricedEventCount,
    coverage,
    note,
  };
}
