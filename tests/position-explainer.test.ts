import test from "node:test";
import assert from "node:assert/strict";
import { buildItemExplanation } from "../lib/positionExplainer.ts";
import type { NormalizedPosition, PortfolioBucketEntry } from "../types/index.ts";
import type { NormalizedPerpPosition } from "../lib/providers/perps/types.ts";

function makePosition(overrides: Partial<NormalizedPosition> = {}): NormalizedPosition {
  const usdValue = overrides.usdValue ?? 100;
  return {
    id: overrides.id ?? `pos-${Math.random().toString(36).slice(2)}`,
    symbol: overrides.symbol ?? "ETH",
    name: overrides.name ?? "Ether",
    logo: overrides.logo,
    contractAddress: overrides.contractAddress ?? "0xeth",
    decimals: overrides.decimals ?? 18,
    fungibleId: overrides.fungibleId,
    coingeckoId: overrides.coingeckoId,
    chainSlug: overrides.chainSlug ?? "ethereum",
    chainName: overrides.chainName ?? "Ethereum",
    chainNumericId: overrides.chainNumericId,
    chainColor: overrides.chainColor ?? "#627EEA",
    chainEmoji: overrides.chainEmoji ?? "⬡",
    balance: overrides.balance ?? usdValue,
    rawBalance: overrides.rawBalance ?? String(usdValue),
    price: overrides.price ?? 1,
    priceChange24h: overrides.priceChange24h,
    usdValue,
    priceAvailable: overrides.priceAvailable ?? true,
    source: overrides.source ?? "wallet",
    positionType: overrides.positionType ?? "wallet",
    isLiability: overrides.isLiability ?? false,
    isNative: overrides.isNative ?? false,
    isStablecoin: overrides.isStablecoin ?? false,
    isSpam: overrides.isSpam ?? false,
    isVerified: overrides.isVerified ?? true,
    dataSource: overrides.dataSource ?? "zerion",
    protocolId: overrides.protocolId,
    protocolName: overrides.protocolName,
    healthFactor: overrides.healthFactor,
    collateralRatio: overrides.collateralRatio,
    liquidationPrice: overrides.liquidationPrice,
    apy: overrides.apy,
  };
}

function makePerp(overrides: Partial<NormalizedPerpPosition> = {}): NormalizedPerpPosition {
  return {
    platform: overrides.platform ?? "Hyperliquid",
    chain: overrides.chain ?? "Hyperliquid",
    chainColor: overrides.chainColor ?? "#00FF7F",
    market: overrides.market ?? "BTC-PERP",
    coin: overrides.coin ?? "BTC",
    side: overrides.side ?? "long",
    size: overrides.size ?? 1,
    entryPrice: overrides.entryPrice ?? 100,
    markPrice: overrides.markPrice ?? 105,
    positionValue: overrides.positionValue ?? 500,
    unrealizedPnl: overrides.unrealizedPnl ?? 25,
    leverage: overrides.leverage ?? 4,
    leverageType: overrides.leverageType ?? "cross",
    liquidationPrice: overrides.liquidationPrice ?? 80,
    liqDistancePct: overrides.liqDistancePct ?? 20,
    marginUsed: overrides.marginUsed ?? 125,
    fundingSinceOpen: overrides.fundingSinceOpen ?? 1,
    returnOnEquity: overrides.returnOnEquity ?? 0.2,
    riskLevel: overrides.riskLevel ?? "warning",
    status: overrides.status ?? "open",
    isExact: overrides.isExact ?? true,
  };
}

function makeBucketEntry(overrides: Partial<PortfolioBucketEntry> = {}): PortfolioBucketEntry {
  return {
    id: overrides.id ?? "dust-1",
    bucketId: overrides.bucketId ?? "forgotten_dust",
    sourceKind: overrides.sourceKind ?? "wallet",
    sourceLabel: overrides.sourceLabel ?? "Wallet",
    name: overrides.name ?? "Arbitrum",
    symbol: overrides.symbol ?? "ARB",
    chainSlug: overrides.chainSlug ?? "arbitrum",
    chainName: overrides.chainName ?? "Arbitrum",
    chainColor: overrides.chainColor ?? "#28A0F0",
    chainEmoji: overrides.chainEmoji ?? "🔵",
    protocolName: overrides.protocolName,
    usdValue: overrides.usdValue ?? 3,
    reason: overrides.reason ?? "Small leftover balance.",
  };
}

test("Stablecoin spot asset gets Safe Cash style explanation", () => {
  const explanation = buildItemExplanation({
    kind: "position",
    item: makePosition({ symbol: "USDC", name: "USD Coin", isStablecoin: true, usdValue: 500 }),
  });

  assert.equal(explanation.bucketLabel, "Safe Cash");
  assert.equal(explanation.type, "stable");
  assert.equal(explanation.riskLevel, "Low");
  assert.match(explanation.quickSummary, /stablecoin/i);
});

test("Volatile spot asset gets Long-Term Holds style explanation", () => {
  const explanation = buildItemExplanation({
    kind: "position",
    item: makePosition({ symbol: "ETH", name: "Ether", usdValue: 1200 }),
  });

  assert.equal(explanation.bucketLabel, "Long-Term Holds");
  assert.equal(explanation.type, "spot");
  assert.match(explanation.bucketReason, /spot holding/i);
  assert.match(explanation.makesMoney[0], /price rises/i);
});

test("DeFi earn position explains yield and protocol risk", () => {
  const explanation = buildItemExplanation({
    kind: "position",
    item: makePosition({
      symbol: "stETH",
      name: "Lido Staked Ether",
      source: "defi",
      positionType: "staked",
      protocolName: "Lido",
      protocolId: "lido",
      usdValue: 900,
      apy: 3.2,
    }),
  });

  assert.equal(explanation.bucketLabel, "DeFi Earn");
  assert.equal(explanation.type, "defi");
  assert.match(explanation.quickSummary, /earn yield/i);
  assert.equal(explanation.losesMoney.some((line) => /protocol/i.test(line)), true);
});

test("Locked position explains limited exit and Locked difficulty", () => {
  const explanation = buildItemExplanation({
    kind: "position",
    item: makePosition({
      symbol: "ETH",
      name: "ETH cooldown",
      source: "defi",
      positionType: "locked",
      protocolName: "Rocket Pool",
      usdValue: 700,
    }),
  });

  assert.equal(explanation.bucketLabel, "Locked Funds");
  assert.equal(explanation.exitDifficulty, "Locked");
  assert.match(explanation.exitReason, /cannot freely move|limited exit/i);
});

test("Perp position explains leverage, amplified loss, and High risk", () => {
  const explanation = buildItemExplanation({
    kind: "perp",
    item: makePerp({ leverage: 5, riskLevel: "critical" }),
  });

  assert.equal(explanation.bucketLabel, "Active Trades");
  assert.equal(explanation.type, "perp");
  assert.equal(explanation.riskLevel, "High");
  assert.equal(explanation.losesMoney.some((line) => /Leverage/i.test(line)), true);
});

test("Dust balance explains it is tiny leftover value", () => {
  const explanation = buildItemExplanation({
    kind: "bucket_entry",
    item: makeBucketEntry(),
  });

  assert.equal(explanation.bucketLabel, "Forgotten Dust");
  assert.equal(explanation.type, "dust");
  assert.match(explanation.quickSummary, /tiny leftover balance/i);
});

test("Exit difficulty maps correctly by position type", () => {
  const wallet = buildItemExplanation({
    kind: "position",
    item: makePosition({ positionType: "wallet", source: "wallet" }),
  });
  const defi = buildItemExplanation({
    kind: "position",
    item: makePosition({ source: "defi", positionType: "deposit", protocolName: "Aave" }),
  });
  const lp = buildItemExplanation({
    kind: "position",
    item: makePosition({ source: "defi", positionType: "lp", protocolName: "Uniswap" }),
  });

  assert.equal(wallet.exitDifficulty, "Easy");
  assert.equal(defi.exitDifficulty, "Moderate");
  assert.equal(lp.exitDifficulty, "Hard");
});

test("Beginner warning exists for each supported type", () => {
  const explanations = [
    buildItemExplanation({ kind: "position", item: makePosition({ isStablecoin: true, symbol: "USDC", name: "USD Coin" }) }),
    buildItemExplanation({ kind: "position", item: makePosition({ symbol: "ETH", name: "Ether" }) }),
    buildItemExplanation({ kind: "position", item: makePosition({ source: "defi", positionType: "staked", protocolName: "Lido" }) }),
    buildItemExplanation({ kind: "position", item: makePosition({ source: "defi", positionType: "locked", protocolName: "Lido" }) }),
    buildItemExplanation({ kind: "perp", item: makePerp() }),
    buildItemExplanation({ kind: "bucket_entry", item: makeBucketEntry() }),
  ];

  assert.equal(explanations.every((item) => item.beginnerWarning.length > 0), true);
});

test("Bucket reason matches the current bucket classification", () => {
  const explanation = buildItemExplanation({
    kind: "position",
    item: makePosition({ symbol: "USDC", name: "USD Coin", isStablecoin: true, usdValue: 500 }),
  });

  assert.equal(explanation.bucketLabel, "Safe Cash");
  assert.equal(explanation.bucketReason, "Liquid stablecoin balance.");
});

test("Unsupported or minimal metadata still returns safe fallback text", () => {
  const explanation = buildItemExplanation({
    kind: "position",
    item: makePosition({
      symbol: "TKN",
      name: "Unknown Token",
      chainName: "Base",
      chainSlug: "base",
      chainColor: "#0052FF",
      chainEmoji: "🔵",
      usdValue: 25,
      price: undefined,
      priceAvailable: false,
      protocolName: undefined,
      source: "wallet",
    }),
  });

  assert.ok(explanation.quickSummary.length > 0);
  assert.ok(explanation.riskReason.length > 0);
  assert.ok(explanation.beginnerWarning.length > 0);
});
