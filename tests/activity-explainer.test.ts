import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITY_NOISE_THRESHOLD_USD,
  explainHistoryEvent,
  explainHistoryEvents,
  summarizeExplainedActivity,
} from "../lib/activityExplainer.ts";
import type { HistoryEvent } from "../types/index.ts";

function makeEvent(overrides: Partial<HistoryEvent> = {}): HistoryEvent {
  return {
    id: overrides.id ?? `evt-${Math.random().toString(36).slice(2)}`,
    type: overrides.type ?? "swap",
    description: overrides.description ?? "Swapped USDC for HYPE",
    chainSlug: overrides.chainSlug ?? "ethereum",
    chainName: overrides.chainName ?? "Ethereum",
    chainColor: overrides.chainColor ?? "#627EEA",
    chainEmoji: overrides.chainEmoji ?? "⬡",
    tokenSymbol: overrides.tokenSymbol,
    tokenLogo: overrides.tokenLogo,
    tokenAmount: overrides.tokenAmount,
    toTokenSymbol: overrides.toTokenSymbol,
    toTokenLogo: overrides.toTokenLogo,
    toTokenAmount: overrides.toTokenAmount,
    usdValue: overrides.usdValue,
    counterparty: overrides.counterparty,
    txHash: overrides.txHash ?? "0x123",
    explorerUrl: overrides.explorerUrl,
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    status: overrides.status ?? "confirmed",
    fee: overrides.fee,
    dataSource: overrides.dataSource ?? "zerion",
  };
}

test("Stable-to-volatile swap gives plain-English swap and Higher risk", () => {
  const explained = explainHistoryEvent(makeEvent({
    type: "swap",
    tokenSymbol: "USDC",
    toTokenSymbol: "HYPE",
    usdValue: 400,
  }));

  assert.equal(explained.type, "swap");
  assert.equal(explained.riskImpact, "Higher");
  assert.match(explained.plainEnglish, /swapped USDC for HYPE/i);
});

test("Volatile-to-stable swap gives Lower risk", () => {
  const explained = explainHistoryEvent(makeEvent({
    type: "swap",
    tokenSymbol: "ETH",
    toTokenSymbol: "USDC",
    usdValue: 550,
  }));

  assert.equal(explained.riskImpact, "Lower");
});

test("DeFi deposit explains moved into protocol to earn yield", () => {
  const explained = explainHistoryEvent(makeEvent({
    type: "deposit",
    description: "Deposited ETH into Morpho",
    tokenSymbol: "ETH",
    usdValue: 800,
  }));

  assert.equal(explained.type, "deposit");
  assert.match(explained.plainEnglish, /into Morpho to earn yield/i);
  assert.equal(explained.riskImpact, "Higher");
});

test("DeFi withdrawal explains removed from protocol back to wallet", () => {
  const explained = explainHistoryEvent(makeEvent({
    type: "withdraw",
    description: "Withdrew USDC from Morpho",
    tokenSymbol: "USDC",
    usdValue: 600,
  }));

  assert.match(explained.plainEnglish, /from Morpho back to your wallet/i);
  assert.equal(explained.riskImpact, "Lower");
});

test("Perp increase gives higher risk", () => {
  const explained = explainHistoryEvent(makeEvent({
    type: "other",
    description: "Increased perp leverage on BTC-PERP",
    usdValue: 250,
  }));

  assert.equal(explained.type, "trade");
  assert.equal(explained.riskImpact, "Higher");
});

test("Perp reduction gives lower risk", () => {
  const explained = explainHistoryEvent(makeEvent({
    type: "other",
    description: "Reduced perp leverage on BTC-PERP",
    usdValue: 250,
  }));

  assert.equal(explained.type, "trade");
  assert.equal(explained.riskImpact, "Lower");
});

test("Bridge explains chain move with target when available", () => {
  const explained = explainHistoryEvent(makeEvent({
    type: "bridge",
    description: "Bridged USDC to Arbitrum",
    tokenSymbol: "USDC",
    usdValue: 300,
  }));

  assert.match(explained.plainEnglish, /to Arbitrum/i);
  assert.equal(explained.riskImpact, "Unchanged");
});

test("Reward claim explains rewards with unchanged risk", () => {
  const explained = explainHistoryEvent(makeEvent({
    type: "claim",
    description: "Claimed OP rewards",
    tokenSymbol: "OP",
    usdValue: 45,
  }));

  assert.equal(explained.type, "reward");
  assert.equal(explained.riskImpact, "Unchanged");
  assert.match(explained.plainEnglish, /claimed rewards|claimed OP/i);
});

test("Tiny receive is marked as low-importance noise", () => {
  const explained = explainHistoryEvent(makeEvent({
    type: "receive",
    description: "Received DUST",
    tokenSymbol: "DUST",
    usdValue: ACTIVITY_NOISE_THRESHOLD_USD,
  }));

  assert.equal(explained.isNoise, true);
  assert.equal(explained.isMeaningful, false);
});

test("Tiny stablecoin receive is not hidden as noise", () => {
  const explained = explainHistoryEvent(makeEvent({
    type: "receive",
    description: "Received USDC",
    tokenSymbol: "USDC",
    usdValue: ACTIVITY_NOISE_THRESHOLD_USD,
  }));

  assert.equal(explained.isNoise, false);
});

test("Borrow gives higher risk", () => {
  const explained = explainHistoryEvent(makeEvent({
    type: "borrow",
    description: "Borrowed USDC from Aave",
    tokenSymbol: "USDC",
    usdValue: 900,
  }));

  assert.equal(explained.riskImpact, "Higher");
});

test("Repay gives lower risk", () => {
  const explained = explainHistoryEvent(makeEvent({
    type: "repay",
    description: "Repaid USDC to Aave",
    tokenSymbol: "USDC",
    usdValue: 900,
  }));

  assert.equal(explained.riskImpact, "Lower");
});

test("Unknown or minimal metadata returns safe fallback explanation", () => {
  const explained = explainHistoryEvent(makeEvent({
    type: "other",
    description: "",
    tokenSymbol: undefined,
    usdValue: undefined,
  }));

  assert.equal(explained.type, "unknown");
  assert.ok(explained.plainEnglish.length > 0);
  assert.equal(explained.riskImpact, "Unknown");
});

test("Summary derives a sensible overall direction from recent actions", () => {
  const summary = summarizeExplainedActivity(explainHistoryEvents([
    makeEvent({ type: "swap", tokenSymbol: "USDC", toTokenSymbol: "ETH", usdValue: 400 }),
    makeEvent({ type: "deposit", description: "Deposited ETH into Morpho", tokenSymbol: "ETH", usdValue: 500 }),
    makeEvent({ type: "receive", tokenSymbol: "DUST", usdValue: 1 }),
  ]));

  assert.equal(summary.overallRiskDirection, "Higher");
  assert.ok(summary.summaryLine.length > 0);
  assert.ok(summary.biggestAction.length > 0);
});
