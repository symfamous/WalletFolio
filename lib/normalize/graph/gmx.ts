/**
 * lib/normalize/graph/gmx.ts
 *
 * Converts GMX v2 subgraph data (via The Graph) into NormalizedPerpPosition objects.
 * This normalizer is straightforward since GMX positions are already perps-shaped.
 */

import type { NormalizedPerpPosition } from "@/lib/providers/perps/types";
import type { GmxAccount } from "@/lib/providers/graph/gmx";

const GMX_CHAINS: Array<{
  chainId: number;
  chainSlug: string;
  chainColor: string;
  chainName: string;
}> = [
  { chainId: 42161, chainSlug: "arbitrum", chainColor: "#28E0B9", chainName: "Arbitrum" },
  { chainId: 43114, chainSlug: "avalanche", chainColor: "#E84142", chainName: "Avalanche" },
];

export function normalizeGmxPositions(
  accounts: Array<{ account: GmxAccount; chainId: number }>
): NormalizedPerpPosition[] {
  const positions: NormalizedPerpPosition[] = [];

  for (const { account, chainId } of accounts) {
    const chain = GMX_CHAINS.find((c) => c.chainId === chainId);
    if (!chain) continue;

    for (const pos of account.positions) {
      const size = parseFloat(pos.size) / 1e30;
      if (size <= 0) continue;

      const collateral = parseFloat(pos.collateral) / 1e30;
      const entryPrice = parseFloat(pos.entryPrice) / 1e30;
      const markPrice = parseFloat(pos.markPrice) / 1e30;
      const leverage = parseFloat(pos.leverage) / 1e4;
      const fundingFee = parseFloat(pos.fundingFee) / 1e30;
      const unrealizedPnl = parseFloat(pos.pnl) / 1e30;

      const positionValue = size * markPrice;

      // Liquidation price estimate
      const liqPrice = pos.side === "LONG"
        ? entryPrice * (1 - 1 / leverage)
        : entryPrice * (1 + 1 / leverage);

      const liqDistancePct = liqPrice > 0
        ? Math.abs((markPrice - liqPrice) / liqPrice) * 100
        : null;

      positions.push({
        platform: "gmx-v2",
        chain: chain.chainSlug,
        chainColor: chain.chainColor,
        market: pos.marketSymbol,
        coin: pos.marketSymbol.replace("-USD", "").replace("USD", ""),

        side: pos.side === "LONG" ? "long" : "short",
        size,
        entryPrice,
        markPrice,
        positionValue,
        unrealizedPnl,
        leverage,
        leverageType: "isolated",

        liquidationPrice: liqPrice || null,
        liqDistancePct,
        marginUsed: collateral,
        fundingSinceOpen: fundingFee,
        returnOnEquity: collateral > 0 ? unrealizedPnl / collateral : 0,

        riskLevel: leverage > 10 ? "critical" : leverage > 5 ? "warning" : "safe",
        status: size > 0 ? "open" : "closed",
        isExact: true,
      });
    }
  }

  return positions;
}
