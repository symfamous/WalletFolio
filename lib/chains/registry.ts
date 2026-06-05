/**
 * lib/chains/registry.ts
 *
 * Chain registry — loaded from Zerion /chains/ at startup, cached in memory.
 * Static fallback metadata provides colors, emojis, and numeric IDs
 * for known chains. Unknown chains get safe generic defaults and still display.
 */

import type { ChainInfo, ZerionChain } from "@/types";
import {
  ProviderRequestError,
  getProviderHealth,
  logProviderEventOnce,
  providerFetchJson,
} from "@/lib/providers/resilience";

// ─────────────────────────────────────────────────────────
// Static metadata for known chains

interface StaticMeta {
  color:     string;
  emoji:     string;
  numericId?: number;
}

const KNOWN: Record<string, StaticMeta> = {
  ethereum:             { color: "#627EEA", emoji: "⟠",  numericId: 1},
  arbitrum:             { color: "#28A0F0", emoji: "🔵",  numericId: 42161},
  optimism:             { color: "#FF0420", emoji: "🔴",  numericId: 10},
  base:                 { color: "#0052FF", emoji: "🔷",  numericId: 8453},
  blast:                { color: "#FCFC03", emoji: "💛",  numericId: 81457},
  linea:                { color: "#61DFFF", emoji: "⬛",  numericId: 59144},
  scroll:               { color: "#EEB878", emoji: "📜",  numericId: 534352},
  "zksync-era":         { color: "#8C8DFC", emoji: "⚡",  numericId: 324},
  mode:                 { color: "#DFFE00", emoji: "🌀",  numericId: 34443},
  "binance-smart-chain":{ color: "#F3BA2F", emoji: "🟡",  numericId: 56},
  "op-bnb":             { color: "#F0B90B", emoji: "🟠",  numericId: 204},
  polygon:              { color: "#8247E5", emoji: "🟣",  numericId: 137},
  mantle:               { color: "#8B5CF6", emoji: "🔮",  numericId: 5000},
  avalanche:            { color: "#E84142", emoji: "🔺",  numericId: 43114},
  fantom:               { color: "#1969FF", emoji: "👻",  numericId: 250},
  gnosis:               { color: "#04795B", emoji: "🦉",  numericId: 100},
  celo:                 { color: "#35D07F", emoji: "🌱",  numericId: 42220},
  moonbeam:             { color: "#E1147B", emoji: "🌕",  numericId: 1284},
  moonriver:            { color: "#F2A007", emoji: "🌊",  numericId: 1285},
  aurora:               { color: "#78D64B", emoji: "🌌",  numericId: 1313161554},
  metis:                { color: "#00D2FF", emoji: "🔗",  numericId: 1088},
  cronos:               { color: "#002D74", emoji: "🦅",  numericId: 25},
  kava:                 { color: "#FF564F", emoji: "🌀",  numericId: 2222},
  boba:                 { color: "#CBFF00", emoji: "🫧",  numericId: 288},
  core:                 { color: "#FF9A00", emoji: "⬡",   numericId: 1116},
  harmony:              { color: "#00AEE9", emoji: "🔵",  numericId: 1666600000},
  "polygon-zkevm":      { color: "#7B3FE4", emoji: "🔵",  numericId: 1101},
  "hyper-evm":          { color: "#7CFC00", emoji: "⚡",  numericId: 999 },
};

// ─────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────

let chainRegistry: Map<string, ChainInfo> = new Map();
let registryLoaded = false;
let registrySource: "live" | "static" = "static";

function fromZerionChain(chain: ZerionChain): ChainInfo {
  const meta = KNOWN[chain.id] ?? { color: "#5a78a0", emoji: "⬡" };
  const externalId = parseInt(chain.attributes.external_id, 10);

  return {
    slug:          chain.id,
    numericId:     isNaN(externalId) ? meta.numericId : externalId,
    name:          chain.attributes.name,
    nativeAssetId: chain.attributes.native_asset_id,
    explorerUrl:   chain.attributes.explorer?.home_url,
    iconUrl:       chain.attributes.icon?.url,
    color:         meta.color,
    emoji:         meta.emoji,
  };
}

export async function loadChainRegistry(apiKey: string): Promise<Map<string, ChainInfo>> {
  if (registryLoaded && chainRegistry.size > 0) return chainRegistry;

  try {
    const body = await providerFetchJson<{ data: ZerionChain[] }>(
      "zerion_chains",
      "https://api.zerion.io/v1/chains/",
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
          Accept: "application/json",
        },
        next: { revalidate: 3600 },
      }
    );

    chainRegistry = new Map(body.data.map((c) => [c.id, fromZerionChain(c)]));
    registryLoaded = true;
    registrySource = "live";
    console.info(`[chains] loaded ${chainRegistry.size} chains from Zerion`);
    return chainRegistry;
  } catch (error) {
    const state = getProviderHealth("zerion_chains");
    if (error instanceof ProviderRequestError) {
      if (chainRegistry.size > 0) {
        console.warn(`[chains] ${error.reason}, using cached ${registrySource} registry`);
        registryLoaded = true;
        return chainRegistry;
      }

      if (error.reason === "circuit_open") {
        logProviderEventOnce(
          "chains-static-fallback-circuit-open",
          "[chains] circuit open, using cached static registry"
        );
      } else {
        console.warn(`[chains] ${error.reason}, using cached static registry`);
      }
    } else {
      console.warn("[chains] failed to load live registry, using static registry:", error);
    }

    if (state.state === "open_circuit") {
      logProviderEventOnce(
        "chains-circuit-open-state",
        "[chains] Zerion chain registry marked unhealthy; serving static registry during cooldown"
      );
    }
    return seedFallback();
  }
}

function seedFallback(): Map<string, ChainInfo> {
  if (chainRegistry.size > 0) return chainRegistry;

  const NAMES: Record<string, string> = {
    ethereum: "Ethereum", arbitrum: "Arbitrum", optimism: "Optimism",
    base: "Base", blast: "Blast", linea: "Linea", scroll: "Scroll",
    "zksync-era": "zkSync Era", mode: "Mode", "binance-smart-chain": "BNB Chain",
    "op-bnb": "opBNB", polygon: "Polygon", mantle: "Mantle", avalanche: "Avalanche",
    fantom: "Fantom", gnosis: "Gnosis", celo: "Celo", moonbeam: "Moonbeam",
    moonriver: "Moonriver", aurora: "Aurora", metis: "Metis", cronos: "Cronos",
    kava: "Kava", boba: "Boba", core: "Core", harmony: "Harmony",
    "polygon-zkevm": "Polygon zkEVM", "hyper-evm": "HyperEVM",
  };

  for (const [slug, meta] of Object.entries(KNOWN)) {
    chainRegistry.set(slug, {
      slug, name: NAMES[slug] ?? slug,
      nativeAssetId: "eth",
      numericId: meta.numericId,
      color:     meta.color,
      emoji:     meta.emoji,
    });
  }

  registryLoaded = true;
  registrySource = "static";
  return chainRegistry;
}

export function getChainInfo(slug: string): ChainInfo {
  return chainRegistry.get(slug) ?? {
    slug, name: slug,
    nativeAssetId: "eth",
    color: "#5a78a0", emoji: "⬡",
  };
}

export function getAllChains(): ChainInfo[] {
  return Array.from(chainRegistry.values());
}
