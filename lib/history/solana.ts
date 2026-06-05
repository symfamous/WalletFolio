/**
 * lib/history/solana.ts
 *
 * Converts free Helius RPC transaction data → HistoryEvent[].
 *
 * Infers transaction type from token balance changes (pre vs post balances):
 * - Same token mint: check if balance increased (receive) or decreased (send)
 * - SOL native balance changes via fee vs other computation
 *
 * For DEX swaps both token mints change in opposite directions for same signer.
 */

import type { HistoryEvent, HistoryEventType } from "@/types";
import type { HeliusTx } from "@/lib/providers/history/solana";

const SOLANA_CHAIN_SLUG  = "solana";
const SOLANA_CHAIN_NAME  = "Solana";
const SOLANA_CHAIN_COLOR = "#9945FF";
const SOLANA_CHAIN_EMOJI = "◎";
const SOL_EXPLORER       = "https://solscan.io";
const LAMPORTS_PER_SOL   = 1_000_000_000;

// ─── Helpers ────────────────────────────────────────────────────────

function fmtSol(amount: number, symbol = "SOL"): string {
  if (!amount || !isFinite(amount)) return symbol;
  if (amount < 0.0001)   return `${amount.toExponential(2)} ${symbol}`;
  if (amount < 0.01)     return `${amount.toFixed(6).replace(/\.?0+$/, "")} ${symbol}`;
  if (amount < 1)        return `${amount.toFixed(4).replace(/\.?0+$/, "")} ${symbol}`;
  if (amount < 1000)     return `${amount.toPrecision(4).replace(/\.?0+$/, "")} ${symbol}`;
  return `${Math.round(amount).toLocaleString()} ${symbol}`;
}

function fmtToken(amount: number, symbol: string): string {
  if (!amount || !isFinite(amount)) return symbol;
  if (amount < 0.0001)   return `${amount.toExponential(2)} ${symbol}`;
  if (amount < 0.01)     return `${amount.toFixed(6).replace(/\.?0+$/, "")} ${symbol}`;
  if (amount < 1)        return `${amount.toFixed(4).replace(/\.?0+$/, "")} ${symbol}`;
  if (amount < 1000)     return `${amount.toPrecision(4).replace(/\.?0+$/, "")} ${symbol}`;
  return `${Math.round(amount).toLocaleString()} ${symbol}`;
}

function shortenAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ─── Type inference from token balances ─────────────────────────────

interface BalanceChange {
  mint: string;
  symbol: string;
  decimals: number;
  preAmount: number;
  postAmount: number;
  owner: string;
}

function getAccountKeys(tx: HeliusTx): string[] {
  return (tx.transaction?.message?.accountKeys ?? [])
    .map((key) => typeof key === "string" ? key : key?.pubkey)
    .filter((key): key is string => typeof key === "string" && key.length > 0);
}

function getNativeBalanceDelta(tx: HeliusTx, address: string): number {
  const accountKeys = getAccountKeys(tx);
  const addressIndex = accountKeys.findIndex((key) => key === address);
  if (addressIndex === -1) return 0;

  const preLamports = tx.meta?.preBalances?.[addressIndex] ?? 0;
  const postLamports = tx.meta?.postBalances?.[addressIndex] ?? 0;
  return (postLamports - preLamports) / LAMPORTS_PER_SOL;
}

function getNativeTransferDelta(tx: HeliusTx, address: string): number {
  const rawDelta = getNativeBalanceDelta(tx, address);
  const feeSol = (tx.meta?.fee ?? 0) / LAMPORTS_PER_SOL;
  const accountKeys = getAccountKeys(tx);
  const isFeePayer = accountKeys[0] === address;

  return rawDelta < 0 && isFeePayer
    ? rawDelta + feeSol
    : rawDelta;
}

function getInstructionType(ix: { parsed?: unknown }): string | undefined {
  if (!ix.parsed || typeof ix.parsed !== "object") return undefined;
  const parsed = ix.parsed as { type?: unknown };
  return typeof parsed.type === "string" ? parsed.type.toLowerCase() : undefined;
}

function detectInstructionHint(tx: HeliusTx): Extract<HistoryEventType, "stake" | "unstake" | "claim"> | undefined {
  const instructions = tx.transaction?.message?.instructions ?? [];

  for (const ix of instructions) {
    const program = String(ix.program ?? "").toLowerCase();
    const programId = String(ix.programId ?? "").toLowerCase();
    const parsedType = getInstructionType(ix);
    const looksLikeStakeProgram =
      program === "stake" ||
      programId.includes("stake111111111111111111111111111111111111111");

    if (looksLikeStakeProgram) {
      if (parsedType && /delegate|initialize/.test(parsedType)) return "stake";
      if (parsedType && /deactivate|withdraw/.test(parsedType)) return "unstake";
    }

    if (parsedType && /claim/.test(parsedType)) return "claim";
  }

  return undefined;
}

/**
 * Extract token balance changes for a given address.
 * Returns tokens where the address's balance changed.
 */
function getBalanceChanges(
  tx: HeliusTx,
  address: string,
): BalanceChange[] {
  const changes: BalanceChange[] = [];
  const preMap = new Map(
    (tx.meta?.preTokenBalances ?? []).map((b) => [`${b.mint}-${b.owner}`, b])
  );
  const postMap = new Map(
    (tx.meta?.postTokenBalances ?? []).map((b) => [`${b.mint}-${b.owner}`, b])
  );

  // Check union(pre, post) so fully-emptied token accounts still produce outflows.
  const allKeys = new Set([...preMap.keys(), ...postMap.keys()]);
  for (const key of allKeys) {
    const pre = preMap.get(key);
    const post = postMap.get(key);
    const owner = post?.owner ?? pre?.owner;
    if (owner !== address) continue;

    const mint = post?.mint ?? pre?.mint;
    if (!mint) continue;

    const preAmt = pre?.uiTokenAmount.uiAmount ?? 0;
    const postAmt = post?.uiTokenAmount.uiAmount ?? 0;
    if (postAmt !== preAmt) {
      changes.push({
        mint,
        symbol:    mint.slice(0, 6), // no symbol in RPC response — use mint prefix
        decimals:  post?.uiTokenAmount.decimals ?? pre?.uiTokenAmount.decimals ?? 0,
        preAmount: preAmt,
        postAmount: postAmt,
        owner,
      });
    }
  }

  return changes;
}

/**
 * Classify a transaction type based on balance changes for an address.
 */
function classifyTx(
  tx: HeliusTx,
  address: string,
): HistoryEventType {
  const changes = getBalanceChanges(tx, address);
  const nativeTransferDelta = getNativeTransferDelta(tx, address);
  const instructionHint = detectInstructionHint(tx);

  if (instructionHint) return instructionHint;

  if (changes.length === 0) {
    if (nativeTransferDelta > 0.0000001) return "receive";
    if (nativeTransferDelta < -0.0000001) return "send";
    return "other";
  }

  // Check for swap: 2 tokens with opposite direction changes
  if (changes.length >= 2) {
    const inc = changes.filter((c) => c.postAmount > c.preAmount);
    const dec = changes.filter((c) => c.postAmount < c.preAmount);
    if (inc.length >= 1 && dec.length >= 1) return "swap";
  }

  // Single token change
  const change = changes[0];
  if (change.postAmount > change.preAmount) return "receive";
  if (change.postAmount < change.preAmount) return "send";

  if (nativeTransferDelta > 0.0000001) return "receive";
  if (nativeTransferDelta < -0.0000001) return "send";

  return "other";
}

// ─── Description builder ────────────────────────────────────────────

function buildDescription(
  type: HistoryEventType,
  tx: HeliusTx,
  address: string,
): string {
  const changes = getBalanceChanges(tx, address);
  const nativeTransferDelta = getNativeTransferDelta(tx, address);
  const protocol = detectProtocol(tx);

  // Changes where this address is the owner
  const myChanges = changes.filter((c) => c.owner === address);
  const inc = myChanges.filter((c) => c.postAmount > c.preAmount);
  const dec = myChanges.filter((c) => c.postAmount < c.preAmount);

  switch (type) {
    case "swap": {
      const out = dec[0];
      const inn = inc[0];
      if (out && inn) {
        const outStr = fmtToken(out.preAmount - out.postAmount, out.symbol);
        const inStr  = fmtToken(inn.postAmount - inn.preAmount, inn.symbol);
        return `Swapped ${outStr} for ${inStr}`;
      }
      if (out) return "Swap";
      return "Token swap";
    }

    case "stake": {
      const amount = tokenAmountFromChanges(dec[0], nativeTransferDelta, "out");
      return protocol && amount
        ? `Staked ${amount} via ${protocol}`
        : amount
        ? `Staked ${amount}`
        : protocol
        ? `${protocol} staking`
        : "Staked SOL";
    }

    case "unstake": {
      const amount = tokenAmountFromChanges(inc[0], nativeTransferDelta, "in");
      return protocol && amount
        ? `Unstaked ${amount} from ${protocol}`
        : amount
        ? `Unstaked ${amount}`
        : protocol
        ? `${protocol} unstake`
        : "Unstaked SOL";
    }

    case "claim": {
      const reward = inc[0];
      if (reward) {
        const amt = fmtToken(reward.postAmount - reward.preAmount, reward.symbol);
        return protocol ? `Claimed ${amt} from ${protocol}` : `Claimed ${amt}`;
      }
      return protocol ? `Claimed rewards from ${protocol}` : "Claimed rewards";
    }

    case "send": {
      const c = dec[0];
      if (c) {
        const amt  = fmtToken(c.preAmount - c.postAmount, c.symbol);
        return `Sent ${amt}`;
      }
      if (nativeTransferDelta < -0.0000001) {
        return `Sent ${fmtSol(Math.abs(nativeTransferDelta))}`;
      }
      return "Sent funds";
    }

    case "receive": {
      const c = inc[0];
      if (c) {
        const amt = fmtToken(c.postAmount - c.preAmount, c.symbol);
        return `Received ${amt}`;
      }
      if (nativeTransferDelta > 0.0000001) {
        return `Received ${fmtSol(nativeTransferDelta)}`;
      }
      return "Received funds";
    }

    default: {
      if (myChanges.length > 0) {
        const c = myChanges[0];
        const delta = c.postAmount - c.preAmount;
        if (delta > 0) return `Received ${fmtToken(delta, c.symbol)}`;
        if (delta < 0) return `Sent ${fmtToken(-delta, c.symbol)}`;
      }
      if (nativeTransferDelta > 0.0000001) return `Received ${fmtSol(nativeTransferDelta)}`;
      if (nativeTransferDelta < -0.0000001) return `Sent ${fmtSol(Math.abs(nativeTransferDelta))}`;
      if (protocol) return `${protocol} interaction`;
      return "Solana transaction";
    }
  }
}

function tokenAmountFromChanges(
  change: BalanceChange | undefined,
  nativeTransferDelta: number,
  direction: "in" | "out",
): string | undefined {
  if (change) {
    const amount = direction === "out"
      ? change.preAmount - change.postAmount
      : change.postAmount - change.preAmount;
    return fmtToken(Math.abs(amount), change.symbol);
  }
  if (direction === "out" && nativeTransferDelta < -0.0000001) {
    return fmtSol(Math.abs(nativeTransferDelta));
  }
  if (direction === "in" && nativeTransferDelta > 0.0000001) {
    return fmtSol(nativeTransferDelta);
  }
  return undefined;
}

// ─── Protocol detection from program IDs ───────────────────────────

const KNOWN_PROGRAMS: Record<string, string> = {
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZUiH3HqD3tN": "Jupiter",
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUtFPp": "Raydium",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc": "Orca",
  "MarBmssgkxLRH7K55oEtw4hVpYfadHynSXMZsWhniaSr": "Marinade",
  "Stake11111111111111111111111111111111111111112": "Stake",
  "StakeProgram1111111111111111111111111111111": "Stake",
  "Vote111111111111111111111111111111111111111": "Vote",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLnJAkfr": "Token Program",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA": "Token Program",
  "ComputeBudget111111111111111111111111111": "Compute Budget",
};

function detectProtocol(tx: HeliusTx): string | undefined {
  const instructions = tx.transaction?.message?.instructions ?? [];
  for (const ix of instructions) {
    const pid = ix.programId ?? ix.program;
    if (pid && KNOWN_PROGRAMS[pid]) {
      return KNOWN_PROGRAMS[pid];
    }
  }
  return undefined;
}

// ─── Main export ─────────────────────────────────────────────────────

export function normalizeSolanaHistory(
  txs: HeliusTx[],
  address: string,
): HistoryEvent[] {
  const events: HistoryEvent[] = [];

  for (const tx of txs) {
    if (!tx.signature || !tx.blockTime) continue;

    // Skip failed transactions
    if (tx.err) {
      console.info(`[history:solana] Skipping failed tx: ${tx.signature?.slice(0, 8)}, err=${JSON.stringify(tx.err)?.slice(0, 60)}`);
      continue;
    }

    const type        = classifyTx(tx, address);
    const desc        = buildDescription(type, tx, address);
    const protocol    = detectProtocol(tx);
    const feeLamports = tx.meta?.fee ?? 0;
    const feeSol      = feeLamports / LAMPORTS_PER_SOL;
    const nativeTransferDelta = getNativeTransferDelta(tx, address);

    const changes   = getBalanceChanges(tx, address);
    const myChanges = changes.filter((c) => c.owner === address);
    const inc = myChanges.filter((c) => c.postAmount > c.preAmount);
    const dec = myChanges.filter((c) => c.postAmount < c.preAmount);

    // Primary token
    const tokenOut = dec[0];
    const tokenIn  = inc[0];

    // Counterparty — for send/receive, find the other account involved
    let counterparty: string | undefined;
    if (type === "send" && tokenOut) {
      const others = (tx.meta?.postTokenBalances ?? [])
        .filter((b) => b.mint === tokenOut.mint && b.owner !== address);
      if (others.length > 0) counterparty = shortenAddr(others[0].owner);
    } else if (type === "receive" && tokenIn) {
      const others = (tx.meta?.postTokenBalances ?? [])
        .filter((b) => b.mint === tokenIn.mint && b.owner !== address);
      if (others.length > 0) counterparty = shortenAddr(others[0].owner);
    }

    events.push({
      id:          `solana-${tx.signature}`,
      type,
      description: protocol && type === "other"
        ? `${protocol} interaction`
        : desc,
      chainSlug:   SOLANA_CHAIN_SLUG,
      chainName:   SOLANA_CHAIN_NAME,
      chainColor:  SOLANA_CHAIN_COLOR,
      chainEmoji:  SOLANA_CHAIN_EMOJI,

      tokenSymbol: tokenOut?.symbol ?? tokenIn?.symbol ?? (Math.abs(nativeTransferDelta) > 0.0000001 ? "SOL" : undefined),

      tokenAmount: tokenOut
        ? tokenOut.preAmount - tokenOut.postAmount
        : tokenIn
        ? tokenIn.postAmount - tokenIn.preAmount
        : Math.abs(nativeTransferDelta) > 0.0000001
        ? Math.abs(nativeTransferDelta)
        : undefined,

      toTokenSymbol: type === "swap" ? (tokenIn?.symbol ?? "SOL") : undefined,
      toTokenAmount: type === "swap" && tokenIn
        ? tokenIn.postAmount - tokenIn.preAmount
        : undefined,

      usdValue:    undefined,
      counterparty,

      txHash:      tx.signature,
      explorerUrl: `${SOL_EXPLORER}/tx/${tx.signature}`,
      timestamp:   new Date(tx.blockTime * 1000).toISOString(),
      status:      "confirmed",
      fee:         feeSol > 0.000001 ? feeSol * 2500 : undefined,
      dataSource:  "helius",
    });
  }

  if (txs.length > 0 && events.length === 0) {
    console.info(`[history:solana] All ${txs.length} txs produced no events — check balances or type inference`);
  }

  return events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
