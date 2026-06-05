import type { PerpsApiResponse, Portfolio, PortfolioIntelligence } from "../../types/index.ts";

function usd(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

/** Price formatter that keeps precision for sub-dollar tokens. */
function px(n: number): string {
  if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n > 0) return `$${n.toPrecision(2)}`;
  return "$0";
}

/**
 * Build a compact, factual context grounding the assistant in the user's actual
 * wallet. The wallet facts are the source of truth for the user's holdings; the
 * model is otherwise free to be a normal, helpful crypto assistant.
 */
export function buildPortfolioContext(
  portfolio: Portfolio,
  perps?: PerpsApiResponse | null,
  intelligence?: PortfolioIntelligence | null
): string {
  const s = portfolio.summary;
  const lines: string[] = [];

  lines.push("You are WalletFolio's AI portfolio assistant — knowledgeable, friendly, and concise.");
  lines.push(
    "Use the WALLET SNAPSHOT below as the source of truth for THIS user's holdings, and combine it with your general crypto knowledge to give genuinely useful, specific answers."
  );
  lines.push(
    "You can explain concepts, give market/context, discuss risks and tradeoffs, and share balanced perspective. For \"should I buy/sell/hold\" questions, don't refuse — walk through the relevant considerations and risks for their actual position, then add a short reminder that it's educational, not personalized financial advice, and the decision is theirs."
  );
  lines.push(
    "Prefer the user's real numbers. If a specific figure truly isn't available, reason from what you do have instead of just saying you don't have it. Keep answers tight and well-formatted."
  );
  lines.push("");
  lines.push("=== WALLET SNAPSHOT ===");
  lines.push(`Total value: ${usd(s.totalUsdValue)}${s.change24h !== undefined ? ` (24h ${s.change24h >= 0 ? "+" : ""}${s.change24h.toFixed(2)}%)` : ""}`);
  lines.push(`Wallet (spot): ${usd(s.walletUsdValue)} · DeFi net: ${usd(s.defiNetUsdValue)} · Chains: ${s.activeChainCount} · Protocols: ${s.activeProtocolCount}`);

  const top = portfolio.aggregated
    .filter((h) => h.totalUsdValue > 0)
    .slice(0, 12)
    .map((h) => {
      const price = h.price !== undefined && h.price > 0 ? ` @ ${px(h.price)}` : "";
      const chg = h.priceChange24h !== undefined ? ` (${h.priceChange24h >= 0 ? "+" : ""}${h.priceChange24h.toFixed(1)}% 24h)` : "";
      return `${h.symbol}: ${usd(h.totalUsdValue)}${price}${chg}`;
    });
  if (top.length > 0) {
    lines.push("");
    lines.push("Holdings (symbol: value @ current price, 24h change):");
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
      .map((p) => `${p.coin} ${p.side} ${p.leverage.toFixed(1)}x @ mark ${px(p.markPrice)}, value ${usd(p.positionValue)}, uPnL ${usd(p.unrealizedPnl)}${p.liquidationPrice ? `, liq ${px(p.liquidationPrice)}` : ""}`)
      .join("; "));
  }

  if (intelligence?.risk) {
    lines.push("");
    lines.push(`Risk: overall ${intelligence.risk.overallState}. ${intelligence.risk.topReason ?? ""}`.trim());
  }

  return lines.join("\n");
}
