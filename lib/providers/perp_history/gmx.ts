import { SUBGRAPHS, querySubgraph } from "@/lib/providers/graph";
import type { PerpDiscoveryCandidate } from "./types";

interface GmxDiscoveryPosition {
  id: string;
  timestamp?: number;
  size?: string;
  realizedPnl?: string;
}

interface GmxDiscoveryAccount {
  id: string;
  positions: GmxDiscoveryPosition[];
}

const GMX_DISCOVERY_QUERY = `
  query GmxDiscovery($address: String!) {
    accounts(where: { id: $address }, first: 1) {
      id
      positions {
        id
        timestamp
        size
        realizedPnl
      }
    }
  }
`;

const GMX_DISCOVERY_CHAINS = [
  {
    chain: "Arbitrum",
    subgraph: SUBGRAPHS["gmx-v2-arbitrum"],
  },
  {
    chain: "Avalanche",
    subgraph: SUBGRAPHS["gmx-v2-avalanche"],
  },
] as const;
const THEGRAPH_API_KEY = process.env.THEGRAPH_API_KEY ?? "";

function toUsd(value: string | undefined): number {
  const parsed = Number(value ?? "0");
  return Number.isFinite(parsed) ? parsed / 1e30 : 0;
}

export async function discoverGmxHistory(address: string): Promise<PerpDiscoveryCandidate | null> {
  if (!THEGRAPH_API_KEY) return null;

  const results = await Promise.all(
    GMX_DISCOVERY_CHAINS.map(async ({ chain, subgraph }) => {
      const data = await querySubgraph<{ accounts?: GmxDiscoveryAccount[] }>(
        subgraph,
        GMX_DISCOVERY_QUERY,
        { address: address.toLowerCase() },
        THEGRAPH_API_KEY,
      );

      if (!data) return { chain, ok: false as const };

      const account = data.accounts?.[0];
      if (!account || account.positions.length === 0) {
        return { chain, ok: true as const, found: false as const };
      }

      const timestamps = account.positions
        .map((position) => position.timestamp)
        .filter((timestamp): timestamp is number => typeof timestamp === "number" && timestamp > 0)
        .sort((a, b) => a - b);

      const realizedPnl = account.positions.reduce(
        (sum, position) => sum + toUsd(position.realizedPnl),
        0,
      );

      return {
        ok: true as const,
        found: true as const,
        chain,
        positionCount: account.positions.length,
        firstSeen: timestamps[0],
        lastSeen: timestamps[timestamps.length - 1],
        realizedPnl,
      };
    }),
  );

  const successfulScans = results.filter((result) => result.ok);
  const matches = results.filter(
    (result): result is Extract<(typeof results)[number], { ok: true; found: true }> =>
      result.ok && result.found,
  );

  if (matches.length === 0) {
    if (successfulScans.length === 0) return null;

    return {
      protocolId: "gmx-v2",
      protocolName: "GMX v2",
      chain: "Arbitrum / Avalanche",
      addressKind: "evm",
      status: "not_detected",
      confidence: "low",
      evidence: ["No GMX v2 account position records were found in the public indexed scan."],
      notes: "Scanned GMX public indexed account data only. Exact cashflow reconstruction still needs a dedicated adapter.",
    };
  }

  const positionCount = matches.reduce((sum, match) => sum + match.positionCount, 0);
  const firstSeen = matches
    .map((match) => match.firstSeen)
    .filter((timestamp): timestamp is number => typeof timestamp === "number");
  const lastSeen = matches
    .map((match) => match.lastSeen)
    .filter((timestamp): timestamp is number => typeof timestamp === "number");
  const chains = matches.map((match) => match.chain);
  const realizedPnl = matches.reduce((sum, match) => sum + match.realizedPnl, 0);

  return {
    protocolId: "gmx-v2",
    protocolName: "GMX v2",
    chain: chains.join(" / "),
    addressKind: "evm",
    status: "detected",
    confidence: positionCount > 0 ? "high" : "medium",
    evidence: [
      `${positionCount} GMX position record${positionCount === 1 ? "" : "s"} found in public indexed data`,
      `Chains with activity: ${chains.join(", ")}`,
    ],
    notes: "Detected through GMX public indexed account data. Lifetime cashflow adapter still needs to be added.",
    metrics: realizedPnl !== 0 ? { realizedPnl } : undefined,
    firstSeen: firstSeen.length > 0 ? new Date(firstSeen[0] * 1000).toISOString() : undefined,
    lastSeen: lastSeen.length > 0 ? new Date(lastSeen[lastSeen.length - 1] * 1000).toISOString() : undefined,
    interactionCount: positionCount,
  };
}
