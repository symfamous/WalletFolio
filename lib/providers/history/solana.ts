/**
 * lib/providers/history/solana.ts
 *
 * Solana transaction history via free Helius RPC API.
 *
 * Uses:
 *   1. getSignaturesForAddress — list of tx signatures + metadata (all tiers)
 *   2. getTransaction           — full tx with parsed token balances
 *
 * Docs: https://docs.solana.com/api/rpc
 *       https://docs.helius.xyz
 *
 * NOTE: This implementation intentionally stays on the free RPC path.
 * Token transfers are extracted from getTransaction meta.postTokenBalances.
 */

const HELIUS_BASE = "https://mainnet.helius-rpc.com";

// ─── Types ──────────────────────────────────────────────────────────

export interface HeliusTx {
  signature: string;
  slot: number;
  blockTime: number;
  fee: number;  // extracted from meta.fee for convenience
  err?: unknown;
  memo?: string;
  // Token balance changes — in meta
  meta?: {
    fee: number;
    preBalances?: number[];
    postBalances?: number[];
    postTokenBalances?: Array<{
      accountIndex: number;
      mint: string;
      owner: string;
      uiTokenAmount: {
        amount: string;
        decimals: number;
        uiAmount: number;
        uiAmountString: string;
      };
    }>;
    preTokenBalances?: Array<{
      accountIndex: number;
      mint: string;
      owner: string;
      uiTokenAmount: {
        amount: string;
        decimals: number;
        uiAmount: number;
        uiAmountString: string;
      };
    }>;
    innerInstructions?: Array<{
      index: number;
      instructions: Array<{
        parsed?: unknown;
        programId?: string;
        program?: string;
      }>;
    }>;
    logMessages?: string[];
  };
  transaction?: {
    message?: {
      accountKeys?: Array<string | {
        pubkey?: string;
        signer?: boolean;
        writable?: boolean;
      }>;
      instructions?: Array<{
        parsed?: {
          type?: string;
          info?: Record<string, unknown>;
        } | unknown;
        programId?: string;
        program?: string;
        args?: unknown;
      }>;
    };
  };
}

export interface HeliusTxResult {
  transactions: HeliusTx[];
  cursor?: string;
}

// ─── RPC helpers ────────────────────────────────────────────────────

async function heliusPost<T>(
  apiKey: string,
  body: object,
  timeoutMs = 30_000,
): Promise<T> {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${HELIUS_BASE}/?api-key=${apiKey}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
      signal:  ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Helius ${res.status}: ${text}`);
    }
    const json = await res.json();
    if (json?.error) throw new Error(`RPC error: ${JSON.stringify(json.error)}`);
    return json as T;
  } finally {
    clearTimeout(tid);
  }
}

/**
 * Get transaction signatures for an address.
 * Uses before cursor for pagination (gets older txs).
 */
async function getSignaturesForAddress(
  address: string,
  apiKey: string,
  limit = 100,
  before?: string,
): Promise<Array<{ signature: string; slot: number; blockTime: number; err?: unknown }>> {
  const params: Record<string, unknown> = { limit };
  if (before) params.before = before;

  const data = await heliusPost<{
    jsonrpc: string;
    id: string;
    result: Array<{
      signature: string;
      slot: number;
      blockTime: number;
      err?: unknown;
      memo?: string;
    }>;
  }>(apiKey, {
    jsonrpc: "2.0",
    id:      "sig",
    method:  "getSignaturesForAddress",
    params:  [address, params],
  });

  return data.result ?? [];
}

/**
 * Fetch a single parsed transaction by signature.
 */
async function getOneTransaction(
  sig: string,
  apiKey: string,
): Promise<HeliusTx | null> {
  try {
    const data = await heliusPost<{
      jsonrpc: string;
      id: string;
      result: HeliusTx | null;
    }>(apiKey, {
      jsonrpc: "2.0",
      id:      "tx",
      method:  "getTransaction",
      params:  [
        sig,
        {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
          encoding: "jsonParsed",
        },
      ],
    });
    if (!data.result) return null;
    const r = data.result;
    // Solana RPC getTransaction does NOT return signature at top level.
    // The signature comes from getSignaturesForAddress — pass it through via sig param.
    return {
      signature:   sig,
      slot:        r.slot,
      blockTime:   r.blockTime,
      fee:         r.meta?.fee ?? 0,
      err:         r.err,
      memo:        r.memo,
      meta:        r.meta,
      transaction: r.transaction,
    };
  } catch {
    return null;
  }
}

// ─── Main fetcher ───────────────────────────────────────────────────

/**
 * Fetch parsed transaction history for a Solana address.
 * Uses getSignaturesForAddress + getTransaction (jsonParsed) via Helius RPC.
 */
export async function fetchSolanaTransactions(
  address: string,
  apiKey: string,
  cursor?: string,
  limit = 100,
): Promise<HeliusTxResult> {
  // Step 1: get signatures (with optional before cursor for pagination)
  const signatures = await getSignaturesForAddress(address, apiKey, limit, cursor);
  console.info(`[history:solana] getSignaturesForAddress returned ${signatures.length} signatures for ${address.slice(0, 8)}...`);

  if (signatures.length === 0) {
    return { transactions: [] };
  }

  // Step 2: fetch full parsed txs in parallel batches of 15
  const txs: HeliusTx[] = [];
  for (let i = 0; i < signatures.length; i += 15) {
    const batch = signatures.slice(i, i + 15);
    const results = await Promise.all(
      batch.map((s) => getOneTransaction(s.signature, apiKey))
    );
    for (const tx of results) {
      if (tx) txs.push(tx);
    }
  }

  // Next cursor = oldest signature in this batch (for "before" pagination)
  const nextCursor = signatures.length === limit
    ? signatures[signatures.length - 1].signature
    : undefined;

  return { transactions: txs, cursor: nextCursor };
}
