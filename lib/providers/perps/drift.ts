/**
 * lib/providers/perps/drift.ts
 *
 * Drift Protocol adapter (Solana).
 *
 * Drift is a perp DEX on Solana. It exposes historical data via an
 * S3-backed data API and a DLOB server.
 *
 * Current coverage:
 *   - Drift uses Solana addresses (base58), not EVM addresses
 *   - Recent activity is detected from Solana transaction program invocations
 *   - Exact open positions and PnL still require a Drift account/data adapter
 *
 * Official data endpoint: https://data.api.drift.trade/
 * Docs: https://docs.drift.trade/api/historical-data-api
 *
 * Exact position coverage can be extended using:
 *   GET https://data.api.drift.trade/userActivity?userPubkey={solana_address}
 */

import { discoverDriftHistory } from "@/lib/providers/perp_history/drift";
import type { NormalizedPerpPlatform } from "./types";

export async function fetchDriftPerps(address: string): Promise<NormalizedPerpPlatform> {
  const activity = await discoverDriftHistory(address);
  const detected = activity?.status === "detected";
  const interactions = activity?.interactionCount ?? 0;
  return {
    platform:       "Drift",
    chain:          "Solana",
    chainColor:     "#9945FF",
    positions:      [],
    accountSummary: null,
    pnl: {
      realizedPnl: 0, unrealizedPnl: 0, totalFunding: 0,
      totalFees: 0, netLifetime: 0, pnlByMarket: [],
      fillCount: interactions, isExact: false,
      dataNote: detected
        ? `${interactions} recent Drift interaction${interactions === 1 ? "" : "s"} detected. Exact open positions and P&L are not available until a Drift account adapter is connected.`
        : activity?.notes ?? "Drift activity scan is unavailable because Solana history is not configured.",
    },
    error: detected ? "activity-only" : "no-activity-detected",
  };
}
