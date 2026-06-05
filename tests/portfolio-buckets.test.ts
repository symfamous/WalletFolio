import test from "node:test";
import assert from "node:assert/strict";
import {
  PORTFOLIO_BUCKET_DUST_THRESHOLD_USD,
  PORTFOLIO_BUCKET_TOTAL_TOLERANCE_USD,
  assertPortfolioBucketAccounting,
  buildPortfolioBuckets,
  checkPortfolioBucketAccounting,
  classifyBucket,
  getBucketablePortfolioEntries,
} from "../lib/portfolioBuckets.ts";
import type { BucketClassificationInput } from "../lib/portfolioBuckets.ts";
import type {
  NormalizedPosition,
  Portfolio,
  PortfolioSummary,
  ProtocolPosition,
} from "../types/index.ts";

function makeInput(overrides: Partial<BucketClassificationInput> = {}): BucketClassificationInput {
  return {
    id: "test-position",
    symbol: "ETH",
    name: "Ether",
    chainSlug: "ethereum",
    chainName: "Ethereum",
    chainColor: "#627EEA",
    chainEmoji: "⬡",
    usdValue: 100,
    sourceKind: "wallet",
    sourceLabel: "Wallet",
    isStablecoin: false,
    isLocked: false,
    isYieldPosition: false,
    isActiveTrade: false,
    isLiability: false,
    ...overrides,
  };
}

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

function makePortfolioSummary(totalUsdValue: number, totalBorrowUsdValue = 0): PortfolioSummary {
  return {
    totalUsdValue,
    walletUsdValue: totalUsdValue,
    defiNetUsdValue: 0,
    totalBorrowUsdValue,
    activeChainCount: 1,
    activeProtocolCount: 0,
    pricedAssetCount: 0,
    totalAssetCount: 0,
  };
}

function makePortfolio(
  walletPositions: NormalizedPosition[],
  defiPositions: NormalizedPosition[] = [],
  liabilities: NormalizedPosition[] = []
): Portfolio {
  const positivePositions = [...walletPositions, ...defiPositions];
  const totalUsdValue = positivePositions.reduce((sum, position) => sum + (position.usdValue ?? 0), 0);
  const totalBorrowUsdValue = liabilities.reduce((sum, position) => sum + (position.usdValue ?? 0), 0);

  return {
    address: "0xabc",
    walletPositions,
    defiPositions,
    liabilities,
    protocols: [] as ProtocolPosition[],
    aggregated: [],
    chainAllocations: [],
    protocolAllocations: [],
    summary: makePortfolioSummary(totalUsdValue, totalBorrowUsdValue),
    lastUpdated: new Date().toISOString(),
  };
}

test("stablecoin liquid balance goes to Safe Cash", () => {
  assert.equal(
    classifyBucket(makeInput({ symbol: "USDC", name: "USD Coin", isStablecoin: true })),
    "safe_cash"
  );
});

test("volatile spot asset goes to Long-Term Holds", () => {
  assert.equal(
    classifyBucket(makeInput({ symbol: "ETH", name: "Ether" })),
    "long_term_holds"
  );
});

test("yield position goes to DeFi Earn", () => {
  assert.equal(
    classifyBucket(makeInput({ sourceKind: "defi", protocolName: "Aave", isYieldPosition: true })),
    "defi_earn"
  );
});

test("locked DeFi position goes to Locked Funds", () => {
  assert.equal(
    classifyBucket(makeInput({ sourceKind: "defi", protocolName: "Lido", isLocked: true, isYieldPosition: true })),
    "locked_funds"
  );
});

test("tiny balance goes to Forgotten Dust", () => {
  assert.equal(
    classifyBucket(makeInput({ usdValue: PORTFOLIO_BUCKET_DUST_THRESHOLD_USD - 1 })),
    "forgotten_dust"
  );
});

test("Locked Funds priority overrides DeFi Earn", () => {
  assert.equal(
    classifyBucket(makeInput({ sourceKind: "defi", isLocked: true, isYieldPosition: true })),
    "locked_funds"
  );
});

test("Active Trades priority overrides normal asset classification", () => {
  assert.equal(
    classifyBucket(makeInput({
      symbol: "USDC",
      name: "Hyperliquid Perp Equity",
      isStablecoin: true,
      isActiveTrade: true,
    })),
    "active_trades"
  );
});

test("bucket totals equal tracked portfolio total", () => {
  const portfolio = makePortfolio([
    makePosition({ id: "cash", symbol: "USDC", name: "USD Coin", usdValue: 1000, isStablecoin: true }),
    makePosition({ id: "hold", symbol: "ETH", name: "Ether", usdValue: 2000 }),
    makePosition({
      id: "trade",
      symbol: "USDC",
      name: "Hyperliquid Perp Equity",
      usdValue: 500,
      protocolId: "hyperliquid-perps",
      protocolName: "Hyperliquid Perps",
      dataSource: "hyperliquid",
    }),
    makePosition({ id: "dust", symbol: "ARB", name: "Arbitrum", usdValue: 4 }),
  ], [
    makePosition({
      id: "earn",
      symbol: "stETH",
      name: "Lido Staked Ether",
      usdValue: 1500,
      source: "defi",
      positionType: "staked",
      protocolId: "lido",
      protocolName: "Lido",
    }),
    makePosition({
      id: "locked",
      symbol: "ETH",
      name: "ETH cooldown",
      usdValue: 700,
      source: "defi",
      positionType: "locked",
      protocolId: "rocket-pool",
      protocolName: "Rocket Pool",
    }),
  ]);

  const buckets = buildPortfolioBuckets(portfolio);
  const accounting = checkPortfolioBucketAccounting(
    getBucketablePortfolioEntries(portfolio),
    buckets,
    portfolio.summary.totalUsdValue
  );

  assert.equal(accounting.matches, true);
  assert.equal(accounting.canonicalEntryTotalUsd, portfolio.summary.totalUsdValue);
  assert.ok(Math.abs(accounting.differenceUsd) <= PORTFOLIO_BUCKET_TOTAL_TOLERANCE_USD);
});

test("perp leverage exposure goes to Active Trades without double-counting", () => {
  const portfolio = makePortfolio([
    makePosition({
      id: "trade",
      symbol: "USDC",
      name: "Hyperliquid Perp Equity",
      usdValue: 500,
      protocolId: "hyperliquid-perps",
      protocolName: "Hyperliquid Perps",
      dataSource: "hyperliquid",
      isStablecoin: true,
    }),
  ]);

  const buckets = buildPortfolioBuckets(portfolio);
  const activeTrades = buckets.find((bucket) => bucket.bucketId === "active_trades");
  const safeCash = buckets.find((bucket) => bucket.bucketId === "safe_cash");

  assert.equal(activeTrades?.totalUsdValue, 500);
  assert.equal(safeCash?.totalUsdValue, 0);
  assert.equal(checkPortfolioBucketAccounting(
    getBucketablePortfolioEntries(portfolio),
    buckets,
    portfolio.summary.totalUsdValue
  ).bucketTotalUsd, 500
  );
});

test("bucket totals must never exceed tracked portfolio total", () => {
  const portfolio = makePortfolio([
    makePosition({ id: "cash", symbol: "USDC", name: "USD Coin", usdValue: 1000, isStablecoin: true }),
    makePosition({ id: "hold", symbol: "ETH", name: "Ether", usdValue: 2000 }),
  ]);

  const accounting = checkPortfolioBucketAccounting(
    getBucketablePortfolioEntries(portfolio),
    buildPortfolioBuckets(portfolio),
    portfolio.summary.totalUsdValue
  );

  assert.equal(accounting.exceeds, false);
  assert.ok(accounting.bucketTotalUsd <= portfolio.summary.totalUsdValue + PORTFOLIO_BUCKET_TOTAL_TOLERANCE_USD);
});

test("borrow or liability values do not inflate positive bucket totals", () => {
  const portfolio = makePortfolio(
    [makePosition({ id: "cash", symbol: "USDC", name: "USD Coin", usdValue: 1000, isStablecoin: true })],
    [],
    [makePosition({ id: "borrow", symbol: "USDC", name: "Borrowed USDC", usdValue: 800, isLiability: true, source: "defi", positionType: "borrow" })]
  );

  const buckets = buildPortfolioBuckets(portfolio);
  const accounting = checkPortfolioBucketAccounting(
    getBucketablePortfolioEntries(portfolio),
    buckets,
    portfolio.summary.totalUsdValue
  );

  assert.equal(accounting.bucketTotalUsd, 1000);
  assert.equal(accounting.matches, true);
});

test("rounding behavior does not create visible mismatch with portfolio total", () => {
  const portfolio = makePortfolio([
    makePosition({ id: "a", symbol: "USDC", name: "USD Coin", usdValue: 100.005, isStablecoin: true }),
    makePosition({ id: "b", symbol: "ETH", name: "Ether", usdValue: 199.995 }),
  ]);

  const accounting = checkPortfolioBucketAccounting(
    getBucketablePortfolioEntries(portfolio),
    buildPortfolioBuckets(portfolio),
    portfolio.summary.totalUsdValue
  );

  assert.ok(Math.abs(accounting.differenceUsd) <= PORTFOLIO_BUCKET_TOTAL_TOLERANCE_USD);
});

test("hidden fund dust is not part of bucket accounting when represented separately", () => {
  const portfolio = makePortfolio([
    makePosition({ id: "dust", symbol: "ARB", name: "Arbitrum", usdValue: 4 }),
  ]);

  const buckets = buildPortfolioBuckets(portfolio);
  const dustBucket = buckets.find((bucket) => bucket.bucketId === "forgotten_dust");

  assert.equal(dustBucket?.totalUsdValue, 4);
  assert.equal(checkPortfolioBucketAccounting(getBucketablePortfolioEntries(portfolio), buckets, 4).matches, true);
});

test("hidden funds and separate perp feeds are not extra bucket sources", () => {
  const portfolio = makePortfolio([
    makePosition({
      id: "trade",
      symbol: "USDC",
      name: "Hyperliquid Perp Equity",
      usdValue: 500,
      protocolId: "hyperliquid-perps",
      protocolName: "Hyperliquid Perps",
      dataSource: "hyperliquid",
    }),
    makePosition({ id: "dust", symbol: "ARB", name: "Arbitrum", usdValue: 4 }),
  ], [
    makePosition({
      id: "defi-earn",
      symbol: "wstETH",
      name: "Wrapped stETH",
      usdValue: 300,
      source: "defi",
      positionType: "deposit",
      protocolId: "aave",
      protocolName: "Aave",
    }),
  ]);

  const entries = getBucketablePortfolioEntries(portfolio);
  const accounting = checkPortfolioBucketAccounting(entries, buildPortfolioBuckets(portfolio), portfolio.summary.totalUsdValue);

  assert.equal(entries.length, 3);
  assert.equal(accounting.canonicalEntryTotalUsd, 804);
  assert.equal(accounting.bucketTotalUsd, 804);
});

test("accounting invariant helper throws on mismatched bucket totals", () => {
  assert.throws(() => {
    assertPortfolioBucketAccounting({
      expectedTotalUsd: 100,
      canonicalEntryTotalUsd: 100,
      bucketTotalUsd: 120,
      differenceUsd: 20,
      exceeds: true,
      matches: false,
    });
  });
});
