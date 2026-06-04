/**
 * lib/normalize/history.ts — Zerion only.
 * Every field is null-safe. "Cannot read properties of undefined" is impossible here.
 */

import type {
  ZerionTransaction, ZerionTransfer,
  HistoryEvent, HistoryEventType,
} from "@/types";
import { getChainInfo } from "@/lib/chains/registry";

function shortenAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Safe symbol read — never throws */
function sym(transfer: ZerionTransfer | null | undefined): string {
  return transfer?.fungible_info?.symbol ?? "";
}

/** Safe logo read — never throws */
function logo(transfer: ZerionTransfer | null | undefined): string | undefined {
  return transfer?.fungible_info?.icon?.url ?? undefined;
}

/** Safe quantity read */
function qty(transfer: ZerionTransfer | null | undefined): number {
  return transfer?.quantity?.float ?? 0;
}

function byDir(
  transfers: ZerionTransfer[] | null | undefined,
  dir: "in" | "out"
): ZerionTransfer[] {
  if (!Array.isArray(transfers)) return [];
  return transfers.filter((t) => t?.direction === dir);
}

function primary(transfers: ZerionTransfer[]): ZerionTransfer | null {
  if (!transfers.length) return null;
  return transfers.reduce(
    (b, t) => (t?.value ?? 0) > (b?.value ?? 0) ? t : b,
    transfers[0]
  );
}

function opToType(op: string | null | undefined): HistoryEventType {
  switch (op ?? "") {
    case "trade":    return "swap";
    case "send":     return "send";
    case "receive":  return "receive";
    case "approve":  return "approve";
    case "deposit":  return "deposit";
    case "withdraw": return "withdraw";
    case "borrow":   return "borrow";
    case "repay":    return "repay";
    case "claim":    return "claim";
    case "bridge":   return "bridge";
    case "stake":    return "stake";
    case "unstake":  return "unstake";
    default:         return "other";
  }
}

function fmtAmt(n: number, s: string): string {
  if (!s) return "";
  if (!n || !isFinite(n)) return s;
  const str = n < 0.001 ? n.toExponential(2) : n.toPrecision(4).replace(/\.?0+$/, "");
  return `${str} ${s}`;
}

function buildDescription(
  type: HistoryEventType,
  transfers: ZerionTransfer[] | null | undefined,
  approvals: ZerionTransaction["attributes"]["approvals"]
): string {
  const safeTransfers = Array.isArray(transfers) ? transfers : [];
  const outTs  = byDir(safeTransfers, "out");
  const inTs   = byDir(safeTransfers, "in");
  const pOut   = primary(outTs);
  const pIn    = primary(inTs);
  const oSym   = sym(pOut);
  const iSym   = sym(pIn);
  const oQty   = qty(pOut);
  const iQty   = qty(pIn);

  switch (type) {
    case "swap":
      return oSym && iSym
        ? `Swapped ${fmtAmt(oQty, oSym)} for ${fmtAmt(iQty, iSym)}`
        : "Token swap";
    case "send":
      return oSym ? `Sent ${fmtAmt(oQty, oSym)}` : "Sent funds";
    case "receive":
      return iSym ? `Received ${fmtAmt(iQty, iSym)}` : "Received funds";
    case "approve": {
      const appSym = approvals?.[0]?.fungible_info?.symbol ?? oSym ?? "token";
      return `Approved ${appSym}`;
    }
    case "deposit":
      return oSym ? `Deposited ${fmtAmt(oQty, oSym)}` : "Deposited into protocol";
    case "withdraw":
      return iSym ? `Withdrew ${fmtAmt(iQty, iSym)}` : "Withdrew from protocol";
    case "borrow":
      return iSym ? `Borrowed ${fmtAmt(iQty, iSym)}` : "Borrowed from protocol";
    case "repay":
      return oSym ? `Repaid ${fmtAmt(oQty, oSym)}` : "Repaid loan";
    case "claim":
      return iSym ? `Claimed ${fmtAmt(iQty, iSym)} rewards` : "Claimed rewards";
    case "bridge":
      return oSym ? `Bridged ${fmtAmt(oQty, oSym)}` : "Bridged funds";
    case "stake":
      return oSym ? `Staked ${fmtAmt(oQty, oSym)}` : "Staked tokens";
    case "unstake":
      return iSym ? `Unstaked ${fmtAmt(iQty, iSym)}` : "Unstaked tokens";
    default:
      return "Transaction";
  }
}

export function normalizeZerionHistory(
  transactions: ZerionTransaction[] | null | undefined
): HistoryEvent[] {
  if (!Array.isArray(transactions)) return [];

  const events: HistoryEvent[] = [];

  for (let idx = 0; idx < transactions.length; idx++) {
    const tx = transactions[idx];

    // Full null-safety on the entire tx object
    if (!tx) continue;
    const attrs = tx.attributes;
    if (!attrs) continue;

    // Skip failed
    if (attrs.status === "failed") continue;

    const chainSlug = tx.relationships?.chain?.data?.id ?? "ethereum";
    const chain     = getChainInfo(chainSlug);
    const type      = opToType(attrs.operation_type);

    const safeTransfers = Array.isArray(attrs.transfers) ? attrs.transfers : [];
    const outTs = byDir(safeTransfers, "out");
    const inTs  = byDir(safeTransfers, "in");
    const pOut  = primary(outTs);
    const pIn   = primary(inTs);

    const explorerUrl = chain.explorerUrl
      ? `${chain.explorerUrl.replace(/\/$/, "")}/tx/${attrs.hash ?? ""}`
      : undefined;

    events.push({
      id:           `zerion-${tx.id ?? idx}-${chainSlug}`,
      type,
      description:  buildDescription(type, attrs.transfers, attrs.approvals),
      chainSlug,
      chainName:    chain.name,
      chainColor:   chain.color,
      chainEmoji:   chain.emoji,

      tokenSymbol:  sym(pOut) || sym(pIn) || undefined,
      tokenLogo:    logo(pOut) ?? logo(pIn),
      tokenAmount:  qty(pOut) || qty(pIn) || undefined,

      toTokenSymbol: type === "swap" ? sym(pIn)  || undefined : undefined,
      toTokenLogo:   type === "swap" ? logo(pIn) : undefined,
      toTokenAmount: type === "swap" ? qty(pIn)  || undefined : undefined,

      usdValue:     (pOut?.value ?? pIn?.value) ?? undefined,
      counterparty: attrs.sent_to ? shortenAddr(attrs.sent_to) : undefined,

      txHash:       attrs.hash ?? "",
      explorerUrl,
      timestamp:    attrs.mined_at ?? new Date().toISOString(),
      status:       attrs.status ?? "confirmed",
      fee:          attrs.fee?.value ?? undefined,
      dataSource:   "zerion",
    });
  }

  return events;
}