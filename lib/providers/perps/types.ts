/**
 * lib/providers/perps/types.ts
 *
 * Shared normalized types for all perp platform adapters.
 *
 * Every field has an `isExact` flag at the platform level indicating
 * whether the PnL figures are computed from complete on-chain data
 * or are estimated/partial.
 */

export interface NormalizedPerpPosition {
  platform:         string;
  chain:            string;
  chainColor:       string;
  market:           string;
  coin:             string;

  side:             "long" | "short";
  size:             number;
  entryPrice:       number;
  markPrice:        number;
  positionValue:    number;   // current notional value USD
  unrealizedPnl:    number;   // mark - entry * size
  leverage:         number;
  leverageType:     "isolated" | "cross" | "unknown";

  liquidationPrice: number | null;
  liqDistancePct:   number | null;  // % distance from mark to liquidation
  marginUsed:       number;
  fundingSinceOpen: number;
  returnOnEquity:   number;

  riskLevel:        "safe" | "warning" | "critical";
  status:           "open" | "closed";
  isExact:          boolean;  // are these figures exactly computed?
}

export interface PerpPlatformPnl {
  realizedPnl:   number;
  unrealizedPnl: number;
  totalFunding:  number;
  totalFees:     number;
  netLifetime:   number;
  pnlByMarket:   Array<{ coin: string; pnl: number }>;
  fillCount:     number;
  isExact:       boolean;
  dataNote:      string;   // human-readable accuracy note
}

export interface PerpAccountSummaryNorm {
  accountValue:    number;
  totalMarginUsed: number;
  totalNtlPos:     number;
  withdrawable:    number;
}

export interface NormalizedPerpPlatform {
  platform:       string;
  chain:          string;
  chainColor:     string;
  positions:      NormalizedPerpPosition[];
  accountSummary: PerpAccountSummaryNorm | null;
  pnl:            PerpPlatformPnl;
  error?:         string;  // set if fetch partially failed
}