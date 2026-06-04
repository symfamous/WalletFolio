/**
 * lib/history/merge.ts
 *
 * Merges HistoryEvents from Zerion + Etherscan into a single clean feed.
 *
 * Strategy:
 * 1. Zerion events are authoritative — preferred for display text and type
 * 2. Etherscan fills gaps for chains Zerion doesn't cover
 * 3. Deduplication key = chainSlug + txHash (normalized)
 * 4. Spam filter removes obvious dust transfers and junk events
 * 5. Sort newest-first after merge
 */

import type { HistoryEvent } from "@/types";

// ─── Spam detection ───────────────────────────────────────────────

// Known spam/scam token name patterns
const SPAM_NAME_PATTERNS = [
  /visit.*\.(com|io|net|xyz|org)/i,
  /claim.*reward/i,
  /airdrop/i,
  /\$\d+.*free/i,
  /www\./i,
  /http/i,
  /telegram\.me/i,
  /discord\.gg/i,
];

// Dust threshold — ignore token transfers below this USD value
const DUST_USD_THRESHOLD = 0.01;

// Known meaningless function names to classify as "other" quietly
const JUNK_FUNCTIONS = new Set([
  "multicall", "execute", "execute(bytes[])", "fallback",
  "0x", "", "receive",
]);

function isSpamEvent(event: HistoryEvent): boolean {
  // Skip zero-value approvals for unknown tokens
  if (event.type === "approve" && !event.tokenSymbol) return true;

  // Skip very tiny USD value receives (dust airdrops)
  if (
    event.type === "receive" &&
    event.usdValue !== undefined &&
    event.usdValue < DUST_USD_THRESHOLD
  ) return true;

  // Skip spam by description pattern
  for (const pattern of SPAM_NAME_PATTERNS) {
    if (pattern.test(event.description)) return true;
  }

  // Skip suspiciously long token symbols (spam tokens often have URLs in symbol)
  if (event.tokenSymbol && event.tokenSymbol.length > 20) return true;

  return false;
}

// ─── Deduplication ────────────────────────────────────────────────

/**
 * Normalize a tx hash for dedup — lowercase, strip 0x prefix for comparison.
 */
function normalizeHash(hash: string): string {
  return (hash ?? "").toLowerCase().replace(/^0x/, "");
}

/**
 * Merge Zerion and Etherscan events.
 *
 * Zerion events win when hashes overlap — they have better labels.
 * Etherscan events are added for chains/hashes not in Zerion.
 */
export function mergeHistoryEvents(
  zerionEvents:    HistoryEvent[],
  etherscanEvents: HistoryEvent[],
): HistoryEvent[] {
  // Index Zerion events by chainSlug+hash
  const zerionKeys = new Set<string>();
  for (const e of zerionEvents) {
    zerionKeys.add(`${e.chainSlug}:${normalizeHash(e.txHash)}`);
  }

  // Only add Etherscan events not already in Zerion
  const etherscanUnique = etherscanEvents.filter((e) => {
    const key = `${e.chainSlug}:${normalizeHash(e.txHash)}`;
    return !zerionKeys.has(key);
  });

  const merged = [...zerionEvents, ...etherscanUnique];

  // Final dedup pass (within each source, there may be internal dups)
  const seen   = new Set<string>();
  const deduped = merged.filter((e) => {
    const key = `${e.chainSlug}:${normalizeHash(e.txHash)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Filter spam
  const clean = deduped.filter((e) => !isSpamEvent(e));

  // Sort newest first
  clean.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return clean;
}

/**
 * Count unique chains that have at least one event.
 */
export function countChainsWithData(events: HistoryEvent[]): number {
  return new Set(events.map((e) => e.chainSlug)).size;
}