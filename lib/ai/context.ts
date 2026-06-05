import type { PerpsApiResponse, Portfolio, PortfolioIntelligence } from "../../types/index.ts";

function usd(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

/**
 * Build a compact, factual system prompt grounding the assistant in the user's
 * actual wallet so answers are specific rather than generic. Kept short to save
 * tokens; the model is told to only use these facts.
 */
export function buildPortfolioContext(
  portfolio: Portfolio,
  perps?: PerpsApiResponse | null,
  intelligence?: PortfolioIntelligence | null
): string {
  const s = portfolio.summary;
  const lines: string[] = [];

  lines.push("You are WalletFolio's portfolio assistant. Answer using ONLY the wallet facts below.");
  lines.push("Be concise and specific. Use the real numbers. You are not a financial advisor; do not give buy/sell advice — explain and inform. If something isn't in the facts, say you don't have that data.");
  lines.push("");
  lines.push("=== WALLET SNAPSHOT ===");
  lines.push(`Total value: ${usd(s.totalUsdValue)}${s.change24h !== undefined ? ` (24h ${s.change24h >= 0 ? "+" : ""}${s.change24h.toFixed(2)}%)` : ""}`);
  lines.push(`Wallet (spot): ${usd(s.walletUsdValue)} · DeFi net: ${usd(s.defiNetUsdValue)} · Chains: ${s.activeChainCount} · Protocols: ${s.activeProtocolCount}`);

  const top = portfolio.aggregated
    .filter((h) => h.totalUsdValue > 0)
    .slice(0, 10)
    .map((h) => `${h.symbol} ${usd(h.totalUsdValue)}${h.priceChange24h !== undefined ? ` (${h.priceChange24h >= 0 ? "+" : ""}${h.priceChange24h.toFixed(1)}% 24h)` : ""}`);
  if (top.length > 0) {
    lines.push("");
    lines.push("Top holdings:");
    lines.push(top.join("; "));
  }

  if (portfolio.protocols.length > 0) {
    const protos = portfolio.protocols
      .slice(0, 8)
      .map((p) => `${p.protocolName} (${p.chainName}) net ${usd(p.netUsdValue)}${p.totalBorrowUsd > 0 ? `, borrow ${usd(p.totalBorrowUsd)}` : ""}`);
    lines.push("");
    lines.push("DeFi positions:");
    lines.push(protos.join("; "));
  }

  const openPerps = (perps?.allPositions ?? []).filter((p) => p.status === "open");
  if (openPerps.length > 0) {
    lines.push("");
    lines.push("Open perp positions:");
    lines.push(openPerps
      .slice(0, 8)
      .map((p) => `${p.coin} ${p.side} ${p.leverage.toFixed(1)}x, value ${usd(p.positionValue)}, uPnL ${usd(p.unrealizedPnl)}`)
      .join("; "));
  }

  if (intelligence?.risk) {
    lines.push("");
    lines.push(`Risk: overall ${intelligence.risk.overallState}. ${intelligence.risk.topReason ?? ""}`.trim());
  }

  return lines.join("\n");
}
