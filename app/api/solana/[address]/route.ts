/**
 * Solana portfolio endpoint.
 *
 * Providers:
 * - Helius DAS API for wallet tokens and native stake accounts
 * - Helius RPC on-chain adapters for free protocol-specific Solana DeFi
 * - Mobula for broader Solana DeFi coverage when available
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchSolanaPortfolio } from "@/lib/providers/solana";
import { fetchSolanaDeFiPositions } from "@/lib/providers/solana_defi";
import { fetchMobulaDefiPositions } from "@/lib/providers/mobula";
import { normalizeSolanaData } from "@/lib/normalize/solana";
import { normalizeSolanaDefiData } from "@/lib/normalize/solana_defi";
import { normalizeMobulaData } from "@/lib/normalize/mobula";
import { buildPortfolio } from "@/lib/aggregate/portfolio";
import { buildPortfolioIntelligence } from "@/lib/intelligence";
import { enrichPositionsWithLivePrices } from "@/lib/prices/live";
import { buildProtocolPositions } from "@/lib/normalize/protocols";
import { isSolanaAddress } from "@/lib/utils";
import type { NormalizedPosition, PortfolioApiResponse } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const HELIUS_API_KEY = process.env.HELIUS_API_KEY ?? "";
const MOBULA_API_KEY = process.env.MOBULA_API_KEY ?? "";
const SOLANA_LST_SYMBOLS = new Set(["MSOL", "JITOSOL"]);

function relativeDiff(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1);
}

function isNativeStakeProgramPosition(position: NormalizedPosition): boolean {
  if (position.positionType !== "staked") return false;
  if (position.symbol.toUpperCase() !== "SOL") return false;

  const protocolLabel = `${position.protocolId ?? ""} ${position.protocolName ?? ""}`.toLowerCase();
  return (
    protocolLabel.includes("solana stake") ||
    protocolLabel.includes("stake program") ||
    protocolLabel.includes("native staking")
  );
}

function isWalletReceiptDuplicate(walletPosition: NormalizedPosition, defiPosition: NormalizedPosition): boolean {
  if (defiPosition.isLiability) return false;
  if (walletPosition.contractAddress !== defiPosition.contractAddress) return false;
  if (walletPosition.symbol.toUpperCase() !== defiPosition.symbol.toUpperCase()) return false;
  return relativeDiff(walletPosition.balance, defiPosition.balance) < 0.001;
}

function protocolKey(position: NormalizedPosition): string {
  return `${position.protocolId ?? position.protocolName ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function isProtocolDuplicate(a: NormalizedPosition, b: NormalizedPosition): boolean {
  if (a.isLiability !== b.isLiability) return false;
  if (protocolKey(a) !== protocolKey(b)) return false;

  const sameContract = a.contractAddress === b.contractAddress;
  const sameSymbol = a.symbol.toUpperCase() === b.symbol.toUpperCase();
  if (!sameContract && !sameSymbol) return false;

  return relativeDiff(a.balance, b.balance) < 0.01;
}

function shouldPreferMobulaPrice(mobulaPosition: NormalizedPosition, onChainPosition: NormalizedPosition): boolean {
  return (
    mobulaPosition.priceAvailable &&
    SOLANA_LST_SYMBOLS.has(onChainPosition.symbol.toUpperCase())
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address: raw } = await params;
  const address = raw.trim();

  if (!isSolanaAddress(address)) {
    return NextResponse.json({ error: "Invalid Solana address" }, { status: 400 });
  }

  if (!HELIUS_API_KEY) {
    return NextResponse.json({
      error:
        "HELIUS_API_KEY not configured. " +
        "Get a free key at https://dashboard.helius.dev/signup and add it to .env.local",
    }, { status: 503 });
  }

  let mobulaStatus: "ok" | "skipped" | "error" = "skipped";
  let solanaRpcStatus: "ok" | "skipped" | "error" = "skipped";

  try {
    const heliusPromise = fetchSolanaPortfolio(address, HELIUS_API_KEY);
    const onChainPromise = fetchSolanaDeFiPositions(address, HELIUS_API_KEY)
      .then((data) => {
        solanaRpcStatus = "ok";
        return data;
      })
      .catch((err) => {
        solanaRpcStatus = "error";
        console.warn("[solana] On-chain DeFi fetch failed:", err);
        return { positions: [] };
      });

    const [heliusData, onChainData] = await Promise.all([
      heliusPromise,
      onChainPromise,
    ]);

    const heliusPositions = normalizeSolanaData(heliusData);
    const solPrice =
      heliusData.solAsset?.token_info?.price_info?.price_per_token ??
      heliusData.solAsset?.nativeBalance?.price_per_sol ??
      0;
    const onChainDefiPositions = normalizeSolanaDefiData(onChainData.positions, solPrice);

    let mobulaPositions: ReturnType<typeof normalizeMobulaData> | null = null;
    if (MOBULA_API_KEY) {
      try {
        const mobulaData = await fetchMobulaDefiPositions(address, MOBULA_API_KEY);
        const rawProtocols = Array.isArray(mobulaData?.data?.protocols) ? mobulaData.data.protocols : [];
        console.info(`[solana] Mobula raw: ${rawProtocols.length} protocols`);
        if (rawProtocols.length > 0) {
          const protocolNames = rawProtocols.map((group) => group.protocol.name);
          const positionCount = rawProtocols.reduce((sum, group) => sum + group.positions.length, 0);
          console.info(`[solana] Mobula protocols: ${protocolNames.join(", ")} (${positionCount} positions)`);
        }
        mobulaPositions = normalizeMobulaData(rawProtocols);
        mobulaStatus = "ok";
      } catch (err) {
        console.warn("[solana] Mobula fetch failed:", err);
        mobulaStatus = "error";
      }
    }

    const heliusWalletPositions = heliusPositions.filter((position) => position.source === "wallet");
    const heliusStakePositions = heliusPositions.filter((position) => position.source === "defi");

    const preferredOnChainDefiPositions = onChainDefiPositions.filter((onChainPosition) => {
      const duplicateMobula = (mobulaPositions?.positions ?? []).find((mobulaPosition) =>
        isProtocolDuplicate(mobulaPosition, onChainPosition)
      );
      if (!duplicateMobula) return true;
      return !shouldPreferMobulaPrice(duplicateMobula, onChainPosition);
    });

    const mobulaDefiPositions = (mobulaPositions?.positions ?? []).filter((position) => {
      if (heliusStakePositions.length > 0 && isNativeStakeProgramPosition(position)) {
        return false;
      }
      const duplicateOnChain = preferredOnChainDefiPositions.some((onChainPosition) =>
        isProtocolDuplicate(position, onChainPosition)
      );
      return !duplicateOnChain;
    });

    const combinedDefiPositions = [
      ...heliusStakePositions,
      ...preferredOnChainDefiPositions,
      ...mobulaDefiPositions,
    ];

    const filteredHeliusWalletPositions = heliusWalletPositions.filter((walletPosition) => (
      !combinedDefiPositions.some((defiPosition) => isWalletReceiptDuplicate(walletPosition, defiPosition))
    ));

    const allPositions = await enrichPositionsWithLivePrices([
      ...filteredHeliusWalletPositions,
      ...combinedDefiPositions,
    ]);

    const protocols = buildProtocolPositions(
      allPositions.filter((position) => position.source === "defi")
    );

    const portfolio = buildPortfolio(address, allPositions, protocols);
    const intelligence = buildPortfolioIntelligence(portfolio, null);

    const response: PortfolioApiResponse = {
      portfolio,
      intelligence,
      providerStatus: {
        helius: "ok",
        jupiter: "skipped",
        mobula: mobulaStatus,
        solanaRpc: solanaRpcStatus,
        error: undefined,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "s-maxage=5, stale-while-revalidate=15" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[solana] portfolio fetch failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
