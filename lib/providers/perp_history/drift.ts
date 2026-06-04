import { fetchSolanaTransactions, type HeliusTx } from "../history/solana.ts";
import type { PerpDiscoveryCandidate } from "./types";

const DRIFT_PROGRAM_ID = "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsBNgYKgVQ7up";
const DRIFT_NAME_KEYWORDS = ["drift"];
const HELIUS_API_KEY = process.env.HELIUS_API_KEY ?? "";

function extractAccountKeys(tx: HeliusTx): string[] {
  const keys = tx.transaction?.message?.accountKeys ?? [];
  return keys
    .map((key) => typeof key === "string" ? key : key?.pubkey)
    .filter((key): key is string => typeof key === "string" && key.length > 0);
}

export function hasDriftSignal(tx: HeliusTx): boolean {
  const accountKeys = extractAccountKeys(tx);
  if (accountKeys.some((key) => key === DRIFT_PROGRAM_ID)) return true;

  const instructions = [
    ...(tx.transaction?.message?.instructions ?? []),
    ...(tx.meta?.innerInstructions ?? []).flatMap((group) => group.instructions),
  ];
  for (const instruction of instructions) {
    if (instruction.programId === DRIFT_PROGRAM_ID) return true;

    const program = typeof instruction.program === "string"
      ? instruction.program.toLowerCase()
      : "";
    if (DRIFT_NAME_KEYWORDS.some((keyword) => program.includes(keyword))) {
      return true;
    }
  }

  if ((tx.meta?.logMessages ?? []).some((message) => message.includes(DRIFT_PROGRAM_ID) || message.toLowerCase().includes("drift"))) {
    return true;
  }

  return false;
}

export async function discoverDriftHistory(address: string): Promise<PerpDiscoveryCandidate | null> {
  if (!HELIUS_API_KEY) return null;

  const { transactions } = await fetchSolanaTransactions(address, HELIUS_API_KEY, undefined, 150);
  const matches = transactions
    .filter((tx) => hasDriftSignal(tx))
    .sort((a, b) => a.blockTime - b.blockTime);

  if (matches.length === 0) {
    return {
      protocolId: "drift",
      protocolName: "Drift",
      chain: "Solana",
      addressKind: "solana",
      status: "not_detected",
      confidence: "low",
      evidence: ["No Drift program invocation was found in the most recent 150 wallet transactions."],
      notes: "Scanned top-level and inner Solana program instructions plus program logs. Exact Drift positions and older trade history are not yet queried.",
    };
  }

  return {
    protocolId: "drift",
    protocolName: "Drift",
    chain: "Solana",
    addressKind: "solana",
    status: "detected",
    confidence: "medium",
    evidence: [
      `${matches.length} Solana transaction${matches.length === 1 ? "" : "s"} touched the Drift program`,
      "Detected from Solana program instructions or logs",
    ],
    notes: "This detects recent Drift protocol activity. Exact current positions, fills, and cashflows still require a Drift account adapter.",
    firstSeen: matches[0]?.blockTime ? new Date(matches[0].blockTime * 1000).toISOString() : undefined,
    lastSeen: matches[matches.length - 1]?.blockTime
      ? new Date(matches[matches.length - 1].blockTime * 1000).toISOString()
      : undefined,
    interactionCount: matches.length,
  };
}
