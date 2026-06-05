/**
 * lib/history/normalize.ts
 *
 * Converts Etherscan V2 raw transactions into clean, beginner-friendly HistoryEvents.
 *
 * Key behaviors:
 * - One tx hash = one event in the main list (token transfers merged in)
 * - Token-only hashes (no matching normal tx) produce their own events
 * - Swap detection: outgoing + incoming token transfers on same hash
 * - Description is human-readable plain English
 * - Protocol name extracted from known contract function signatures
 * - Failed txs are skipped
 */

import type { HistoryEvent, HistoryEventType } from "@/types";
import type { EtherscanTx, EtherscanTokenTx } from "@/lib/providers/etherscan";

// ─── Helpers ──────────────────────────────────────────────────────

function shortenAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function weiToEth(wei: string): number {
  if (!wei || wei === "0") return 0;
  try { return parseInt(wei, 10) / 1e18; } catch { return 0; }
}

function rawToToken(raw: string, decimals: number | string): number {
  if (!raw || raw === "0") return 0;
  try {
    const d = Math.min(typeof decimals === "string" ? parseInt(decimals, 10) : decimals, 18);
    const padded  = raw.padStart(d + 1, "0");
    const intPart = padded.slice(0, padded.length - d) || "0";
    const frac    = padded.slice(padded.length - d);
    return parseFloat(`${intPart}.${frac}`);
  } catch { return 0; }
}

function fmtAmt(n: number, sym: string): string {
  if (!n || !isFinite(n)) return sym;
  let s: string;
  if (n < 0.0001)       s = n.toExponential(2);
  else if (n < 0.01)    s = n.toFixed(6).replace(/\.?0+$/, "");
  else if (n < 1)       s = n.toFixed(4).replace(/\.?0+$/, "");
  else if (n < 1000)    s = n.toPrecision(4).replace(/\.?0+$/, "");
  else                  s = Math.round(n).toLocaleString();
  return `${s} ${sym}`;
}

function fmtEth(v: number, sym = "ETH"): string {
  if (!v || !isFinite(v)) return sym;
  const s = v < 0.0001 ? v.toExponential(2) : v.toPrecision(4).replace(/\.?0+$/, "");
  return `${s} ${sym}`;
}

// ─── Protocol name extraction from function name ──────────────────

const PROTOCOL_HINTS: Array<[RegExp, string]> = [
  [/morpho/i,           "Morpho"],
  [/aave/i,             "Aave"],
  [/compound/i,         "Compound"],
  [/uniswap|uni_v/i,    "Uniswap"],
  [/sushiswap|sushi/i,  "SushiSwap"],
  [/curve/i,            "Curve"],
  [/balancer/i,         "Balancer"],
  [/lido/i,             "Lido"],
  [/starkgate|stargate/i,"Stargate"],
  [/across/i,           "Across"],
  [/hop/i,              "Hop"],
  [/synapse/i,          "Synapse"],
  [/1inch/i,            "1inch"],
  [/paraswap/i,         "ParaSwap"],
  [/cowswap|settlement/i,"CoW Swap"],
];

function extractProtocol(fnName: string): string | undefined {
  if (!fnName) return undefined;
  for (const [re, name] of PROTOCOL_HINTS) {
    if (re.test(fnName)) return name;
  }
  return undefined;
}

// ─── Event type detection ─────────────────────────────────────────

function guessType(
  tx:       EtherscanTx,
  addr:     string,
  tokensIn: EtherscanTokenTx[],   // transfers TO the address
  tokensOut: EtherscanTokenTx[],  // transfers FROM the address
): HistoryEventType {
  const fn      = (tx.functionName ?? "").toLowerCase();
  const isFrom  = tx.from?.toLowerCase() === addr;
  const isTo    = tx.to?.toLowerCase()   === addr;
  const hasIn   = tokensIn.length  > 0;
  const hasOut  = tokensOut.length > 0;
  const ethVal  = weiToEth(tx.value ?? "0");

  // Function-name based (most reliable when available)
  if (/\bswap\b|exchange|exactInput|exactOutput|swapExact/i.test(fn)) return "swap";
  if (/deposit|supply|provide|addLiquidity/i.test(fn))                return "deposit";
  if (/withdraw|redeem|removeLiquidity/i.test(fn))                    return "withdraw";
  if (/borrow/i.test(fn))                                              return "borrow";
  if (/repay|payback/i.test(fn))                                       return "repay";
  if (/claim|harvest|getReward/i.test(fn))                             return "claim";
  if (/bridge|teleport|sendTo|deposit.*bridge/i.test(fn))              return "bridge";
  if (/stake|lock\b/i.test(fn))                                        return "stake";
  if (/unstake|unlock\b|exit\b/i.test(fn))                             return "unstake";
  if (/approve/i.test(fn))                                             return "approve";

  // Token-transfer based heuristics
  if (hasIn && hasOut) return "swap";

  // Pure ETH transfer
  if (ethVal > 0 && !hasIn && !hasOut) {
    if (isFrom && !isTo) return "send";
    if (isTo && !isFrom) return "receive";
  }

  // Single token direction
  if (hasOut && !hasIn && isFrom)  return "send";
  if (hasIn  && !hasOut && !isFrom) return "receive";

  // Generic contract interaction we can't label
  return "other";
}

// ─── Description builder ──────────────────────────────────────────

function buildDescription(
  type:      HistoryEventType,
  tx:        EtherscanTx,
  addr:      string,
  tokensIn:  EtherscanTokenTx[],
  tokensOut: EtherscanTokenTx[],
): string {
  const ethVal  = weiToEth(tx.value ?? "0");
  const nativeSym = "ETH"; // all chains use ETH label for native (good enough)

  // Best token representatives
  const primaryOut = tokensOut[0];
  const primaryIn  = tokensIn[0];

  const outStr = primaryOut
    ? fmtAmt(rawToToken(primaryOut.value, primaryOut.tokenDecimal ?? "18"), primaryOut.tokenSymbol || "?")
    : ethVal > 0 ? fmtEth(ethVal, nativeSym) : null;

  const inStr = primaryIn
    ? fmtAmt(rawToToken(primaryIn.value, primaryIn.tokenDecimal ?? "18"), primaryIn.tokenSymbol || "?")
    : null;

  const protocol = extractProtocol(tx.functionName ?? "");

  switch (type) {
    case "swap":
      if (outStr && inStr)  return `Swapped ${outStr} for ${inStr}`;
      if (outStr)           return `Swapped ${outStr}`;
      return "Token swap";

    case "send":
      if (outStr)           return `Sent ${outStr}`;
      return "Sent funds";

    case "receive":
      if (inStr)            return `Received ${inStr}`;
      if (ethVal > 0)       return `Received ${fmtEth(ethVal, nativeSym)}`;
      return "Received funds";

    case "deposit":
      if (outStr && protocol) return `Deposited ${outStr} into ${protocol}`;
      if (outStr)             return `Deposited ${outStr}`;
      return protocol ? `Deposited into ${protocol}` : "Deposited into protocol";

    case "withdraw":
      if (inStr && protocol)  return `Withdrew ${inStr} from ${protocol}`;
      if (inStr)              return `Withdrew ${inStr}`;
      return protocol ? `Withdrew from ${protocol}` : "Withdrew from protocol";

    case "borrow":
      if (inStr && protocol)  return `Borrowed ${inStr} from ${protocol}`;
      if (inStr)              return `Borrowed ${inStr}`;
      return "Borrowed from protocol";

    case "repay":
      if (outStr && protocol) return `Repaid ${outStr} to ${protocol}`;
      if (outStr)             return `Repaid ${outStr}`;
      return "Repaid loan";

    case "claim":
      if (inStr)              return `Claimed ${inStr} rewards`;
      return "Claimed rewards";

    case "bridge":
      if (outStr)             return `Bridged ${outStr}`;
      return "Bridged funds";

    case "stake":
      if (outStr && protocol) return `Staked ${outStr} on ${protocol}`;
      if (outStr)             return `Staked ${outStr}`;
      return "Staked tokens";

    case "unstake":
      if (inStr && protocol)  return `Unstaked ${inStr} from ${protocol}`;
      if (inStr)              return `Unstaked ${inStr}`;
      return "Unstaked tokens";

    case "approve": {
      const sym = primaryOut?.tokenSymbol ?? primaryIn?.tokenSymbol;
      return sym
        ? `Approved ${sym}${protocol ? ` for ${protocol}` : ""}`
        : "Approved token";
    }

    default: {
      // Try to make "other" more readable from function name
      const fn = (tx.functionName ?? "").split("(")[0].trim();
      if (fn) {
        // camelCase → words: "executeMetaTransaction" → "Execute Meta Transaction"
        const words = fn
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (s) => s.toUpperCase())
          .trim();
        return words;
      }
      return "Contract interaction";
    }
  }
}

// ─── Main export ──────────────────────────────────────────────────

export function normalizeEtherscanHistory(
  txs:        EtherscanTx[],
  tokenTxs:   EtherscanTokenTx[],
  address:    string,
  chainSlug:  string,
  chainName:  string,
  chainColor: string,
  chainEmoji: string,
  explorer:   string,
): HistoryEvent[] {
  const addr = address.toLowerCase();
  const events: HistoryEvent[] = [];

  // ── Group token transfers by hash ─────────────────────────────
  const tokenByHash = new Map<string, EtherscanTokenTx[]>();
  for (const t of tokenTxs) {
    if (!t?.hash) continue;
    const arr = tokenByHash.get(t.hash) ?? [];
    arr.push(t);
    tokenByHash.set(t.hash, arr);
  }

  const normalHashSet = new Set(txs.map((t) => t?.hash).filter(Boolean));

  // ── Process normal transactions ───────────────────────────────
  for (const tx of txs) {
    if (!tx?.hash) continue;
    if (tx.isError === "1") continue; // skip failed

    const allToks  = tokenByHash.get(tx.hash) ?? [];
    const toksIn   = allToks.filter((t) => t.to?.toLowerCase()   === addr);
    const toksOut  = allToks.filter((t) => t.from?.toLowerCase() === addr);
    const type     = guessType(tx, addr, toksIn, toksOut);
    const ts       = new Date(parseInt(tx.timeStamp ?? "0", 10) * 1000).toISOString();
    const gasEth   = weiToEth(tx.gasPrice ?? "0") * parseInt(tx.gasUsed ?? "0", 10);

    // Counterparty
    let counterparty: string | undefined;
    if (type === "send")    counterparty = shortenAddr(tx.to ?? "");
    if (type === "receive") counterparty = shortenAddr(tx.from ?? "");

    events.push({
      id:          `escan-${chainSlug}-${tx.hash}`,
      type,
      description: buildDescription(type, tx, addr, toksIn, toksOut),
      chainSlug,
      chainName,
      chainColor,
      chainEmoji,

      tokenSymbol:  (toksOut[0] ?? toksIn[0])?.tokenSymbol || undefined,
      tokenAmount:  toksOut[0]
        ? rawToToken(toksOut[0].value, toksOut[0].tokenDecimal ?? "18")
        : toksIn[0]
        ? rawToToken(toksIn[0].value, toksIn[0].tokenDecimal ?? "18")
        : undefined,

      toTokenSymbol:  type === "swap" && toksIn[0] ? toksIn[0].tokenSymbol : undefined,
      toTokenAmount:  type === "swap" && toksIn[0]
        ? rawToToken(toksIn[0].value, toksIn[0].tokenDecimal ?? "18")
        : undefined,

      usdValue:     undefined,
      counterparty,

      txHash:      tx.hash,
      explorerUrl: `${explorer}/tx/${tx.hash}`,
      timestamp:   ts,
      status:      "confirmed",
      // Gas in USD — rough estimate at $2500 / ETH
      fee:         gasEth > 0.000001 ? gasEth * 2500 : undefined,
      dataSource:  "zerion",
    });
  }

  // ── Token-only hashes (no matching normal tx) ─────────────────
  // These appear e.g. for internal transfers on some chains
  for (const [hash, toks] of tokenByHash.entries()) {
    if (normalHashSet.has(hash)) continue; // already handled above
    if (!toks.length) continue;

    const firstTok = toks[0];
    if (!firstTok?.timeStamp) continue;

    const toksIn  = toks.filter((t) => t.to?.toLowerCase()   === addr);
    const toksOut = toks.filter((t) => t.from?.toLowerCase() === addr);

    let type: HistoryEventType;
    if (toksIn.length > 0 && toksOut.length > 0) type = "swap";
    else if (toksOut.length > 0)                  type = "send";
    else if (toksIn.length > 0)                   type = "receive";
    else                                           type = "other";

    const fakeTx: EtherscanTx = {
      hash,
      from:         firstTok.from ?? "",
      to:           firstTok.to   ?? "",
      value:        "0",
      functionName: "",
      isError:      "0",
      timeStamp:    firstTok.timeStamp,
      gas:          "0",
      gasPrice:     "0",
      gasUsed:      "0",
      blockNumber:  firstTok.blockNumber ?? "",
      contractAddress: "",
      input:        "",
      methodId:     "",
      confirmations: "",
      txreceipt_status: "1",
    };

    events.push({
      id:          `escan-tok-${chainSlug}-${hash}`,
      type,
      description: buildDescription(type, fakeTx, addr, toksIn, toksOut),
      chainSlug,
      chainName,
      chainColor,
      chainEmoji,

      tokenSymbol:  toksOut[0]?.tokenSymbol ?? toksIn[0]?.tokenSymbol,
      tokenAmount:  toksOut[0]
        ? rawToToken(toksOut[0].value, toksOut[0].tokenDecimal ?? "18")
        : toksIn[0]
          ? rawToToken(toksIn[0].value, toksIn[0].tokenDecimal ?? "18")
          : undefined,

      toTokenSymbol: type === "swap" && toksIn[0] ? toksIn[0].tokenSymbol : undefined,
      toTokenAmount: type === "swap" && toksIn[0]
        ? rawToToken(toksIn[0].value, toksIn[0].tokenDecimal ?? "18")
        : undefined,

      usdValue:    undefined,
      counterparty: type === "send"
        ? shortenAddr(toksOut[0]?.to ?? "")
        : type === "receive"
        ? shortenAddr(toksIn[0]?.from ?? "")
        : undefined,

      txHash:      hash,
      explorerUrl: `${explorer}/tx/${hash}`,
      timestamp:   new Date(parseInt(firstTok.timeStamp, 10) * 1000).toISOString(),
      status:      "confirmed",
      dataSource:  "zerion",
    });
  }

  // Sort newest first
  return events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}