import test from "node:test";
import assert from "node:assert/strict";
import { buildPortfolioPnlLedger } from "../lib/pnlLedger.ts";
import type { AggregatedHolding, HistoryEvent } from "../types/index.ts";

function holding(symbol: string, totalUsdValue: number): AggregatedHolding {
  return {
    aggregateKey: symbol,
    symbol,
    name: symbol,
    priceAvailable: true,
    totalBalance: 1,
    totalUsdValue,
    walletBalance: 1,
    walletUsdValue: totalUsdValue,
    defiBalance: 0,
    defiUsdValue: 0,
    isNative: false,
    isStablecoin: false,
    positions: [],
  };
}

function event(overrides: Partial<HistoryEvent>): HistoryEvent {
  return {
    id: overrides.id ?? "event",
    type: overrides.type ?? "receive",
    description: "",
    chainSlug: "ethereum",
    chainName: "Ethereum",
    chainColor: "#000",
    chainEmoji: "",
    txHash: overrides.txHash ?? "hash",
    timestamp: overrides.timestamp ?? "2026-01-01T00:00:00.000Z",
    status: overrides.status ?? "confirmed",
    dataSource: "zerion",
    ...overrides,
  };
}

test("portfolio ledger realizes FIFO trade P&L and retains new lot basis", () => {
  const ledger = buildPortfolioPnlLedger([holding("ETH", 150), holding("USDC", 130)], [
    event({ id: "buy", tokenSymbol: "ETH", tokenAmount: 1, usdValue: 100 }),
    event({
      id: "swap",
      type: "swap",
      tokenSymbol: "ETH",
      tokenAmount: 1,
      toTokenSymbol: "USDC",
      toTokenAmount: 130,
      usdValue: 130,
      fee: 2,
      timestamp: "2026-02-01T00:00:00.000Z",
    }),
  ]);

  assert.equal(ledger.realizedPnlUsd, 30);
  assert.equal(ledger.feesUsd, 2);
  assert.equal(ledger.assets.find((asset) => asset.symbol === "USDC")?.trackedCostBasisUsd, 130);
  assert.equal(ledger.netTrackedPnlUsd, 28);
});

test("portfolio ledger labels unpriced activity as limited coverage", () => {
  const ledger = buildPortfolioPnlLedger([holding("SOL", 200)], [
    event({ tokenSymbol: "SOL", tokenAmount: 2, usdValue: undefined, dataSource: "helius" }),
  ]);

  assert.equal(ledger.coverage, "limited");
  assert.equal(ledger.assets[0].unrealizedPnlUsd, undefined);
});
