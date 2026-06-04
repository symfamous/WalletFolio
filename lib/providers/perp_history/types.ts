export type PerpHistoryAddressKind = "evm" | "solana";

export type PerpDiscoveryStatus =
  | "detected"
  | "not_detected"
  | "unscanned"
  | "unsupported";

export type PerpDiscoveryConfidence = "high" | "medium" | "low";

export interface PerpDiscoveryMetrics {
  openPositionCount?: number;
  currentAccountValue?: number;
  realizedPnl?: number;
  unrealizedPnl?: number;
  netLifetimePnl?: number;
  totalFees?: number;
  totalFunding?: number;
  totalVolume?: number;
  fillCount?: number;
}

export interface PerpDiscoveryCandidate {
  protocolId: string;
  protocolName: string;
  chain: string;
  addressKind: "evm" | "solana" | "both";
  status: PerpDiscoveryStatus;
  confidence: PerpDiscoveryConfidence;
  evidence: string[];
  notes?: string;
  metrics?: PerpDiscoveryMetrics;
  firstSeen?: string;
  lastSeen?: string;
  interactionCount?: number;
}

export interface PerpHistoryDiscoverySummary {
  detectedCount: number;
  unscannedCount: number;
  unsupportedCount: number;
  likelyProtocols: string[];
  notes: string[];
}

export interface PerpHistoryDiscoveryResponse {
  address: string;
  addressKind: PerpHistoryAddressKind;
  stage: "discovery_only";
  candidates: PerpDiscoveryCandidate[];
  summary: PerpHistoryDiscoverySummary;
  timestamp: string;
}
