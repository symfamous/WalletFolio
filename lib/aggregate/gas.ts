import type { HistoryEvent } from "../../types/index.ts";

export interface GasByChain {
  chainSlug: string;
  chainName: string;
  chainColor: string;
  chainEmoji: string;
  feeUsd: number;
  txCount: number;
}

export interface GasSummary {
  totalFeeUsd: number;
  /** Number of transactions that carried a recorded fee. */
  feeTxCount: number;
  avgFeeUsd: number;
  maxFeeUsd: number;
  last30dFeeUsd: number;
  byChain: GasByChain[];
  /** True when no fee data was present in the loaded history. */
  empty: boolean;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Summarize gas/network fees from loaded history events. Fees are USD values
 * supplied by the history provider (Zerion `fee.value`, Solana lamport→USD, etc.).
 */
export function buildGasSummary(events: HistoryEvent[]): GasSummary {
  const byChainMap = new Map<string, GasByChain>();
  let totalFeeUsd = 0;
  let feeTxCount = 0;
  let maxFeeUsd = 0;
  let last30dFeeUsd = 0;
  const cutoff = Date.now() - THIRTY_DAYS_MS;

  for (const event of events) {
    const fee = typeof event.fee === "number" ? event.fee : 0;
    if (fee <= 0) continue;

    totalFeeUsd += fee;
    feeTxCount += 1;
    if (fee > maxFeeUsd) maxFeeUsd = fee;

    const ts = new Date(event.timestamp).getTime();
    if (!Number.isNaN(ts) && ts >= cutoff) last30dFeeUsd += fee;

    const existing = byChainMap.get(event.chainSlug);
    if (existing) {
      existing.feeUsd += fee;
      existing.txCount += 1;
    } else {
      byChainMap.set(event.chainSlug, {
        chainSlug: event.chainSlug,
        chainName: event.chainName,
        chainColor: event.chainColor,
        chainEmoji: event.chainEmoji,
        feeUsd: fee,
        txCount: 1,
      });
    }
  }

  const byChain = [...byChainMap.values()].sort((a, b) => b.feeUsd - a.feeUsd);

  return {
    totalFeeUsd,
    feeTxCount,
    avgFeeUsd: feeTxCount > 0 ? totalFeeUsd / feeTxCount : 0,
    maxFeeUsd,
    last30dFeeUsd,
    byChain,
    empty: feeTxCount === 0,
  };
}
