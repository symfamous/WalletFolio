import type { HistoryEvent, PerpsApiResponse, Portfolio } from "../../types/index.ts";

export interface ActivityFactor {
  label: string;
  detail: string;
  points: number;
  max: number;
}

export interface ActivityScore {
  score: number;          // 0–100
  tier: "Dormant" | "Casual" | "Active" | "Power user" | "Whale-grade";
  factors: ActivityFactor[];
  signals: string[];      // qualitative airdrop-eligibility signals
  coverage: "live" | "partial";
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const DEFI_TYPES = new Set(["deposit", "withdraw", "borrow", "repay", "stake", "unstake", "claim"]);

function tierFor(score: number): ActivityScore["tier"] {
  if (score >= 80) return "Whale-grade";
  if (score >= 60) return "Power user";
  if (score >= 38) return "Active";
  if (score >= 18) return "Casual";
  return "Dormant";
}

/**
 * Heuristic onchain-activity / airdrop-readiness score from the wallet's own
 * holdings + loaded history. This is an *indicator* of breadth of activity that
 * tends to correlate with airdrop eligibility — not a guarantee of any drop.
 */
export function buildActivityScore(
  portfolio: Portfolio,
  events: HistoryEvent[],
  perps?: PerpsApiResponse | null
): ActivityScore {
  // ── Chain diversity (holdings + activity) ──────────────────────
  const chains = new Set<string>();
  for (const c of portfolio.chainAllocations) if (c.totalUsdValue > 0) chains.add(c.chainSlug);
  for (const e of events) chains.add(e.chainSlug);
  const chainCount = chains.size;
  const chainPoints = Math.min(chainCount * 5, 25);

  // ── Protocol usage ─────────────────────────────────────────────
  const protocols = new Set(portfolio.protocols.map((p) => p.protocolId));
  const protocolCount = protocols.size;
  const protocolPoints = Math.min(protocolCount * 5, 20);

  // ── Activity volume ────────────────────────────────────────────
  const txCount = events.length;
  const volumePoints = Math.min(Math.round(txCount / 5), 20);

  // ── Recency (last 30d) ─────────────────────────────────────────
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  const recentTx = events.filter((e) => {
    const t = new Date(e.timestamp).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  }).length;
  const recencyPoints = Math.min(recentTx * 2, 15);

  // ── Bridging (cross-chain) ─────────────────────────────────────
  const bridgeCount = events.filter((e) => e.type === "bridge").length;
  const bridgePoints = bridgeCount > 0 ? 10 : 0;

  // ── DeFi depth + perps trading ─────────────────────────────────
  const defiTxCount = events.filter((e) => DEFI_TYPES.has(e.type)).length;
  const tradedPerps = (perps?.allPositions?.length ?? 0) > 0;
  const depthPoints = Math.min((defiTxCount > 0 ? 5 : 0) + (tradedPerps ? 5 : 0), 10);

  const score = Math.min(
    100,
    chainPoints + protocolPoints + volumePoints + recencyPoints + bridgePoints + depthPoints
  );

  const factors: ActivityFactor[] = [
    { label: "Chain diversity", detail: `${chainCount} network${chainCount === 1 ? "" : "s"} touched`, points: chainPoints, max: 25 },
    { label: "Protocol usage", detail: `${protocolCount} DeFi protocol${protocolCount === 1 ? "" : "s"}`, points: protocolPoints, max: 20 },
    { label: "Activity volume", detail: `${txCount} loaded transaction${txCount === 1 ? "" : "s"}`, points: volumePoints, max: 20 },
    { label: "Recent activity", detail: `${recentTx} tx in last 30 days`, points: recencyPoints, max: 15 },
    { label: "Cross-chain bridging", detail: bridgeCount > 0 ? `${bridgeCount} bridge event${bridgeCount === 1 ? "" : "s"}` : "No bridging seen", points: bridgePoints, max: 10 },
    { label: "DeFi / trading depth", detail: `${defiTxCount} DeFi tx${tradedPerps ? " · perps active" : ""}`, points: depthPoints, max: 10 },
  ];

  // ── Qualitative signals ────────────────────────────────────────
  const signals: string[] = [];
  if (chainCount >= 4) signals.push(`Active on ${chainCount} chains — broad surface for L2 / ecosystem incentive programs.`);
  else if (chainCount >= 2) signals.push(`Active on ${chainCount} chains — some multi-chain airdrop exposure.`);
  if (protocolCount >= 3) signals.push(`Used ${protocolCount} DeFi protocols — protocol-level drops often reward this.`);
  if (bridgeCount > 0) signals.push(`Bridged across chains — bridges (e.g. cross-chain campaigns) frequently retro-reward usage.`);
  if (tradedPerps) signals.push(`Active perp trader — several DEX perps run trader incentive points.`);
  if (recentTx === 0 && txCount > 0) signals.push(`No activity in the last 30 days — many programs weight recent activity, so consider staying active.`);
  if (signals.length === 0) signals.push(`Limited tracked activity so far — broaden across chains and protocols to build airdrop eligibility.`);

  return {
    score,
    tier: tierFor(score),
    factors,
    signals,
    coverage: events.length > 0 ? "live" : "partial",
  };
}
