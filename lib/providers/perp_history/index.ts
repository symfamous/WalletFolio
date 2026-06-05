import { fetchAllPerps } from "@/lib/providers/perps";
import type { NormalizedPerpPlatform } from "@/lib/providers/perps/types";
import { discoverDriftHistory } from "./drift";
import { discoverExtendedHistory } from "./extended";
import { discoverGmxHistory } from "./gmx";
import { discoverLighterHistory } from "./lighter";
import { discoverOrderlyHistory } from "./orderly";
import { discoverParadexHistory } from "./paradex";
import type {
  PerpDiscoveryCandidate,
  PerpDiscoveryConfidence,
  PerpDiscoveryStatus,
  PerpDiscoveryMetrics,
  PerpHistoryAddressKind,
  PerpHistoryDiscoveryResponse,
} from "./types";

interface ProtocolCatalogEntry {
  protocolId: string;
  protocolName: string;
  chain: string;
  addressKind: "evm" | "solana" | "both";
  notes?: string;
}

const DISCOVERY_CATALOG: ProtocolCatalogEntry[] = [
  {
    protocolId: "hyperliquid",
    protocolName: "Hyperliquid",
    chain: "Hyperliquid L1",
    addressKind: "evm",
  },
  {
    protocolId: "dydx-v4",
    protocolName: "dYdX v4",
    chain: "dYdX Chain",
    addressKind: "evm",
  },
  {
    protocolId: "gmx-v2",
    protocolName: "GMX v2",
    chain: "Arbitrum / Avalanche",
    addressKind: "evm",
    notes: "Needs The Graph-backed or on-chain history adapter for deeper forensics.",
  },
  {
    protocolId: "lighter",
    protocolName: "Lighter",
    chain: "Ethereum / Lighter",
    addressKind: "evm",
    notes: "Public wallet-to-account lookup is wired. Stronger Lighter history requires an optional read-only token plus the wallet-linked account index.",
  },
  {
    protocolId: "orderly",
    protocolName: "Orderly",
    chain: "Omnichain",
    addressKind: "both",
    notes: "Public wallet rewards discovery is wired. Exact account-scoped trading history still needs to be added.",
  },
  {
    protocolId: "extended",
    protocolName: "Extended",
    chain: "Starknet / Extended",
    addressKind: "evm",
    notes: "Read-only Extended support is wired for authenticated sub-account history. Exact wallet-wide forensics may still require scanning multiple sub-accounts separately.",
  },
  {
    protocolId: "logx",
    protocolName: "LogX",
    chain: "Omnichain",
    addressKind: "both",
    notes: "Discovery scaffold only. Dedicated order/trade history adapter still needs to be added.",
  },
  {
    protocolId: "paradex",
    protocolName: "Paradex",
    chain: "Ethereum / Paradex",
    addressKind: "evm",
    notes: "Readonly-token Paradex support is wired with account, positions, fills, and orders history. Exact wallet-wide forensics still depends on the token being tied to the right wallet.",
  },
  {
    protocolId: "drift",
    protocolName: "Drift",
    chain: "Solana",
    addressKind: "solana",
    notes: "Recent transaction-level Drift discovery is wired. Exact trade and cashflow adapters still need to be added.",
  },
];

function platformToProtocolId(platformName: string): string {
  const normalized = platformName.toLowerCase();
  if (normalized.includes("hyperliquid")) return "hyperliquid";
  if (normalized.includes("dydx")) return "dydx-v4";
  if (normalized.includes("gmx")) return "gmx-v2";
  return normalized.replace(/[^a-z0-9]+/g, "-");
}

function shouldMarkDetected(platform: NormalizedPerpPlatform): boolean {
  return (
    platform.positions.length > 0 ||
    (platform.accountSummary?.accountValue ?? 0) > 0 ||
    platform.pnl.fillCount > 0 ||
    Math.abs(platform.pnl.realizedPnl) > 0 ||
    Math.abs(platform.pnl.unrealizedPnl) > 0 ||
    Math.abs(platform.pnl.netLifetime) > 0 ||
    Math.abs(platform.pnl.totalFees) > 0 ||
    Math.abs(platform.pnl.totalFunding) > 0
  );
}

function inferConfidence(platform: NormalizedPerpPlatform, detected: boolean): PerpDiscoveryConfidence {
  if (!detected) return "low";
  if (platform.positions.length > 0 || platform.pnl.fillCount > 0) return "high";
  if ((platform.accountSummary?.accountValue ?? 0) > 0 || Math.abs(platform.pnl.netLifetime) > 0) return "medium";
  return "low";
}

function buildEvidence(platform: NormalizedPerpPlatform, detected: boolean): string[] {
  const evidence: string[] = [];

  if (platform.positions.length > 0) {
    evidence.push(`${platform.positions.length} open position${platform.positions.length === 1 ? "" : "s"} found`);
  }
  if (platform.pnl.fillCount > 0) {
    evidence.push(`${platform.pnl.fillCount} fills in adapter history`);
  }
  if ((platform.accountSummary?.accountValue ?? 0) > 0) {
    evidence.push(`Current account value ${platform.accountSummary?.accountValue?.toFixed(2)}`);
  }
  if (Math.abs(platform.pnl.netLifetime) > 0) {
    evidence.push(`Net lifetime PnL ${platform.pnl.netLifetime.toFixed(2)}`);
  }
  if (Math.abs(platform.pnl.totalFees) > 0) {
    evidence.push(`Fees tracked ${platform.pnl.totalFees.toFixed(2)}`);
  }
  if (Math.abs(platform.pnl.totalFunding) > 0) {
    evidence.push(`Funding tracked ${platform.pnl.totalFunding.toFixed(2)}`);
  }

  if (!detected && platform.pnl.dataNote) {
    evidence.push(platform.pnl.dataNote);
  }

  return evidence;
}

function buildMetrics(platform: NormalizedPerpPlatform): PerpDiscoveryMetrics | undefined {
  const metrics: PerpDiscoveryMetrics = {
    openPositionCount: platform.positions.length,
    currentAccountValue: platform.accountSummary?.accountValue,
    realizedPnl: platform.pnl.realizedPnl,
    unrealizedPnl: platform.pnl.unrealizedPnl,
    netLifetimePnl: platform.pnl.netLifetime,
    totalFees: platform.pnl.totalFees,
    totalFunding: platform.pnl.totalFunding,
    fillCount: platform.pnl.fillCount,
  };

  return Object.values(metrics).some((value) => value !== undefined && value !== 0)
    ? metrics
    : undefined;
}

function inferStatus(platform: NormalizedPerpPlatform, detected: boolean): PerpDiscoveryStatus {
  if (detected) return "detected";
  if (
    platform.error === "no-public-api" ||
    platform.error === "no-api-key" ||
    platform.error === "fetch-failed"
  ) {
    return "unscanned";
  }
  return "not_detected";
}

function buildDetectedCandidate(platform: NormalizedPerpPlatform): PerpDiscoveryCandidate {
  const detected = shouldMarkDetected(platform);
  const protocolId = platformToProtocolId(platform.platform);
  const status = inferStatus(platform, detected);

  return {
    protocolId,
    protocolName: platform.platform,
    chain: platform.chain,
    addressKind: "evm",
    status,
    confidence: inferConfidence(platform, detected),
    evidence: buildEvidence(platform, detected),
    notes: platform.error ?? (status !== "detected" ? platform.pnl.dataNote : undefined),
    metrics: buildMetrics(platform),
  };
}

function statusRank(status: PerpDiscoveryStatus): number {
  switch (status) {
    case "detected": return 0;
    case "unscanned": return 1;
    case "not_detected": return 2;
    case "unsupported": return 3;
  }
}

function confidenceRank(confidence: PerpDiscoveryConfidence): number {
  switch (confidence) {
    case "high": return 0;
    case "medium": return 1;
    case "low": return 2;
  }
}

function mergeCandidates(
  base: PerpDiscoveryCandidate,
  incoming: PerpDiscoveryCandidate,
): PerpDiscoveryCandidate {
  const preferred = statusRank(incoming.status) < statusRank(base.status)
    ? incoming
    : base;
  const strongerConfidence = confidenceRank(incoming.confidence) < confidenceRank(base.confidence)
    ? incoming.confidence
    : base.confidence;
  const mergedEvidence = [...new Set([...base.evidence, ...incoming.evidence])];
  const firstSeenCandidates = [base.firstSeen, incoming.firstSeen].filter((value): value is string => Boolean(value));
  const lastSeenCandidates = [base.lastSeen, incoming.lastSeen].filter((value): value is string => Boolean(value));

  return {
    ...preferred,
    confidence: strongerConfidence,
    evidence: mergedEvidence,
    notes: [base.notes, incoming.notes].filter(Boolean).join(" ").trim() || undefined,
    metrics: incoming.metrics ?? base.metrics,
    firstSeen: firstSeenCandidates.length > 0 ? firstSeenCandidates.sort()[0] : undefined,
    lastSeen: lastSeenCandidates.length > 0 ? lastSeenCandidates.sort().slice(-1)[0] : undefined,
    interactionCount: Math.max(base.interactionCount ?? 0, incoming.interactionCount ?? 0) || undefined,
  };
}

function buildCatalogFallback(
  entry: ProtocolCatalogEntry,
  addressKind: PerpHistoryAddressKind,
  existingIds: Set<string>,
): PerpDiscoveryCandidate | null {
  if (existingIds.has(entry.protocolId)) return null;

  const compatible =
    entry.addressKind === "both" ||
    entry.addressKind === addressKind;

  if (!compatible) {
    return {
      protocolId: entry.protocolId,
      protocolName: entry.protocolName,
      chain: entry.chain,
      addressKind: entry.addressKind,
      status: "unsupported",
      confidence: "low",
      evidence: [`${entry.protocolName} does not use this wallet address format.`],
      notes: entry.notes,
    };
  }

  return {
    protocolId: entry.protocolId,
    protocolName: entry.protocolName,
    chain: entry.chain,
    addressKind: entry.addressKind,
    status: "unscanned",
    confidence: "low",
    evidence: ["No dedicated discovery result was produced for this protocol in the isolated perp-history lane."],
    notes: entry.notes,
  };
}

function buildSummary(candidates: PerpDiscoveryCandidate[]) {
  const detected = candidates.filter((candidate) => candidate.status === "detected");
  const unscanned = candidates.filter((candidate) => candidate.status === "unscanned");
  const unsupported = candidates.filter((candidate) => candidate.status === "unsupported");

  const notes = [
    "This lane is discovery-only for now and does not affect the live dashboard build.",
    "Use detected protocols first when adding exact cashflow and fill-history adapters.",
  ];

  if (unscanned.length > 0) {
    notes.push("Some protocols remain placeholders until dedicated history adapters are implemented.");
  }

  return {
    detectedCount: detected.length,
    unscannedCount: unscanned.length,
    unsupportedCount: unsupported.length,
    likelyProtocols: detected.map((candidate) => candidate.protocolName),
    notes,
  };
}

export async function discoverPerpHistory(
  address: string,
  addressKind: PerpHistoryAddressKind,
  rawAddress?: string,
): Promise<PerpHistoryDiscoveryResponse> {
  let detectedCandidates: PerpDiscoveryCandidate[] = [];
  let historyCandidates: PerpDiscoveryCandidate[] = [];

  if (addressKind === "evm") {
    const currentPerps = await fetchAllPerps(address);
    detectedCandidates = currentPerps.platforms.map((platform) => buildDetectedCandidate(platform));
    const [gmxHistory, orderlyHistory, lighterHistory, paradexHistory] = await Promise.all([
      discoverGmxHistory(address).catch(() => null),
      discoverOrderlyHistory(address, addressKind).catch(() => null),
      discoverLighterHistory(rawAddress ?? address).catch(() => null),
      discoverParadexHistory(rawAddress ?? address).catch(() => null),
    ]);
    const extendedProfile = await discoverExtendedHistory(rawAddress ?? address).catch(() => null);

    if (gmxHistory) historyCandidates.push(gmxHistory);
    if (orderlyHistory) historyCandidates.push(orderlyHistory);
    if (lighterHistory) historyCandidates.push(lighterHistory);
    if (paradexHistory) historyCandidates.push(paradexHistory);
    if (extendedProfile) historyCandidates.push(extendedProfile);
  } else {
    const [driftHistory, orderlyHistory] = await Promise.all([
      discoverDriftHistory(address).catch(() => null),
      discoverOrderlyHistory(address, addressKind).catch(() => null),
    ]);

    if (driftHistory) historyCandidates.push(driftHistory);
    if (orderlyHistory) historyCandidates.push(orderlyHistory);
  }

  const mergedDetectedMap = new Map<string, PerpDiscoveryCandidate>();
  for (const candidate of [...detectedCandidates, ...historyCandidates]) {
    const existing = mergedDetectedMap.get(candidate.protocolId);
    mergedDetectedMap.set(
      candidate.protocolId,
      existing ? mergeCandidates(existing, candidate) : candidate,
    );
  }

  const mergedDetected = [...mergedDetectedMap.values()];
  const existingIds = new Set(mergedDetected.map((candidate) => candidate.protocolId));
  const catalogCandidates = DISCOVERY_CATALOG
    .map((entry) => buildCatalogFallback(entry, addressKind, existingIds))
    .filter((candidate): candidate is PerpDiscoveryCandidate => candidate !== null);

  const candidates = [...mergedDetected, ...catalogCandidates]
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.protocolName.localeCompare(b.protocolName));

  return {
    address,
    addressKind,
    stage: "discovery_only",
    candidates,
    summary: buildSummary(candidates),
    timestamp: new Date().toISOString(),
  };
}

export type { PerpHistoryDiscoveryResponse } from "./types";
