import type { PerpDiscoveryCandidate } from "./types";

const ORDERLY_PUBLIC_API = "https://api.orderly.org/v1/public/trading_rewards/wallet_rewards_history";

interface OrderlyWalletRewardsRow {
  epoch_id?: number;
  reward_status?: string;
  epoch_token?: string;
  r_wallet?: number | string;
}

interface OrderlyWalletRewardsResponse {
  success?: boolean;
  data?: {
    wallet_lifetime_trading_rewards_order?: number | string;
    wallet_lifetime_trading_rewards_escrow?: number | string;
    rows?: OrderlyWalletRewardsRow[];
  };
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function discoverOrderlyHistory(
  address: string,
  addressKind: "evm" | "solana",
): Promise<PerpDiscoveryCandidate | null> {
  const chainType = addressKind === "solana" ? "SOL" : "EVM";
  const url = `${ORDERLY_PUBLIC_API}?address=${encodeURIComponent(address)}&chain_type=${chainType}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) return null;

  const body = await res.json() as OrderlyWalletRewardsResponse;
  if (body.success === false) return null;
  const rows = Array.isArray(body?.data?.rows) ? body.data.rows : [];
  const lifetimeOrder = toNumber(body?.data?.wallet_lifetime_trading_rewards_order);
  const lifetimeEscrow = toNumber(body?.data?.wallet_lifetime_trading_rewards_escrow);
  const rewardedRows = rows.filter((row) => toNumber(row.r_wallet) > 0);
  const detected = rewardedRows.length > 0 || lifetimeOrder > 0 || lifetimeEscrow > 0;

  if (!detected) {
    return {
      protocolId: "orderly",
      protocolName: "Orderly",
      chain: "Omnichain",
      addressKind: "both",
      status: "not_detected",
      confidence: "low",
      evidence: [`No positive public Orderly wallet rewards were found for this ${chainType} address.`],
      notes: "Scanned only Orderly's public wallet rewards history. Exact trade, volume, and PnL history still needs signed account-level Orderly access.",
    };
  }

  return {
    protocolId: "orderly",
    protocolName: "Orderly",
    chain: "Omnichain",
    addressKind: "both",
    status: "detected",
    confidence: rewardedRows.length > 0 ? "medium" : "low",
    evidence: [
      rewardedRows.length > 0
        ? `${rewardedRows.length} public Orderly reward epoch record${rewardedRows.length === 1 ? "" : "s"} with positive rewards found`
        : "Public Orderly wallet rewards indicate historical trading activity",
      `Detected using Orderly public wallet rewards history (${chainType})`,
    ],
    notes: "This is a public-wallet discovery signal. Exact trade, volume, and PnL history still needs signed account-level Orderly access.",
    interactionCount: rewardedRows.length || undefined,
  };
}
