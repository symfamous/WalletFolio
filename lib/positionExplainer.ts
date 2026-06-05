import type {
  NormalizedPosition,
  PortfolioBucketEntry,
  PortfolioBucketId,
  PositionExplanation,
  PositionExitDifficulty,
  PositionRiskLevel,
} from "../types/index.ts";
import type { NormalizedPerpPosition } from "./providers/perps/types.ts";
import {
  getBucketForPosition,
  getPortfolioBucketMeta,
} from "./portfolioBuckets.ts";

export type ExplainableItem =
  | { kind: "position"; item: NormalizedPosition }
  | { kind: "bucket_entry"; item: PortfolioBucketEntry }
  | { kind: "perp"; item: NormalizedPerpPosition };

function unique(values: Array<string | undefined | false>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function capitalize(source: string): string {
  return source.charAt(0).toUpperCase() + source.slice(1);
}

function getBucketType(bucketId: PortfolioBucketId): PositionExplanation["type"] {
  switch (bucketId) {
    case "safe_cash":
      return "stable";
    case "long_term_holds":
      return "spot";
    case "active_trades":
      return "perp";
    case "defi_earn":
      return "defi";
    case "locked_funds":
      return "locked";
    case "forgotten_dust":
      return "dust";
  }
}

function getBucketReasonForLabel(bucketId: PortfolioBucketId): string {
  switch (bucketId) {
    case "safe_cash":
      return "Liquid stablecoin balance.";
    case "long_term_holds":
      return "Regular spot holding.";
    case "active_trades":
      return "Leveraged trading exposure.";
    case "defi_earn":
      return "Funds placed into a protocol for yield.";
    case "locked_funds":
      return "Locked balance with a limited exit.";
    case "forgotten_dust":
      return "Small leftover balance.";
  }
}

function getSpotRiskLevel(position: NormalizedPosition): PositionRiskLevel {
  if (position.isStablecoin) return "Low";
  if (position.source === "defi") return "Medium";
  return "Medium";
}

export function getPositionExitProfile(position: NormalizedPosition): {
  level: PositionExitDifficulty;
  reason: string;
} {
  if (position.positionType === "locked") {
    return {
      level: "Locked",
      reason: "You cannot freely move this balance right now.",
    };
  }

  if (position.positionType === "lp") {
    return {
      level: "Hard",
      reason: "You may need to unwind the position before you can fully exit.",
    };
  }

  if (position.source === "defi" || position.positionType === "deposit" || position.positionType === "staked" || position.positionType === "reward") {
    return {
      level: "Moderate",
      reason: "You may need a withdrawal step before the funds are fully liquid.",
    };
  }

  return {
    level: "Easy",
    reason: "You can usually move or sell this quickly.",
  };
}

function getPerpRiskLevel(position: NormalizedPerpPosition): PositionRiskLevel {
  if (position.riskLevel === "critical" || position.leverage >= 4) return "High";
  if (position.riskLevel === "warning" || position.leverage >= 2) return "High";
  return "High";
}

function buildNormalizedPositionExplanation(position: NormalizedPosition): PositionExplanation {
  const bucket = getBucketForPosition(position);
  const bucketId = bucket?.bucketId ?? "long_term_holds";
  const bucketLabel = bucket?.label ?? getPortfolioBucketMeta("long_term_holds").label;
  const bucketReason = bucket?.reason ?? getBucketReasonForLabel("long_term_holds");
  const type = bucket ? getBucketType(bucket.bucketId) : "other";
  const exit = getPositionExitProfile(position);

  let quickSummary = "This is a regular token holding in your wallet.";
  let riskLevel = getSpotRiskLevel(position);
  let riskReason = "Its value moves with the token price.";
  let makesMoney = ["You benefit if the token price rises."];
  let losesMoney = ["You lose value if the token price falls."];
  let beginnerWarning = "Do not confuse this with cash; price can still move.";

  if (position.isLiability || position.positionType === "borrow") {
    quickSummary = "This is a borrowed position, not an owned asset.";
    riskLevel = "High";
    riskReason = "Borrowing adds repayment and liquidation risk.";
    makesMoney = ["This does not directly make money on its own."];
    losesMoney = [
      "Debt is harder to manage if the borrowed asset rises in value.",
      "Weak collateral can push the position toward liquidation.",
    ];
    beginnerWarning = "Borrowing can turn a normal market move into a bigger problem.";
  } else if (type === "stable") {
    quickSummary = "This is a liquid stablecoin balance.";
    riskLevel = "Low";
    riskReason = "It is usually steadier than a normal token, but it still has issuer and chain risk.";
    makesMoney = ["This is mainly for stability and quick access, not for strong upside."];
    losesMoney = [
      "A stablecoin can lose its peg.",
      "Issuer or chain problems can still affect access or value.",
    ];
    beginnerWarning = "Stablecoins are steadier than most tokens, but they are not the same as bank cash.";
  } else if (type === "defi") {
    quickSummary = "This is money placed into a protocol to earn yield.";
    riskLevel = "Medium";
    riskReason = "Returns depend on both the asset and the protocol.";
    makesMoney = [
      "You may earn yield from lending, staking, or protocol incentives.",
      !position.isStablecoin ? "You can also benefit if the underlying asset price rises." : undefined,
    ].filter((value): value is string => Boolean(value));
    losesMoney = [
      "Asset prices can fall while funds are in the protocol.",
      "Protocol risk can affect withdrawals or value.",
    ];
    beginnerWarning = "Yield does not remove protocol risk.";
  } else if (type === "locked") {
    quickSummary = "This is a locked balance with a limited exit.";
    riskLevel = "Medium";
    riskReason = "The main risk is reduced flexibility when you want to exit.";
    makesMoney = [
      "You may earn rewards while the funds stay committed.",
      !position.isStablecoin ? "You can still benefit if the underlying asset price rises." : undefined,
    ].filter((value): value is string => Boolean(value));
    losesMoney = [
      "The asset can lose value while it remains locked.",
      "Limited exit options can hurt if you need cash quickly.",
    ];
    beginnerWarning = "Locked positions are not ideal for emergency liquidity.";
  } else if (type === "dust") {
    quickSummary = "This is a tiny leftover balance.";
    riskLevel = "Low";
    riskReason = "The main issue here is clutter, not major portfolio risk.";
    makesMoney = ["This is usually too small to make a meaningful difference."];
    losesMoney = [
      "The token can still lose value.",
      "Fees may be larger than the value you are trying to move.",
    ];
    beginnerWarning = "Do not over-focus on dust unless you want to clean up wallet clutter.";
  }

  return {
    title: position.name || position.symbol,
    subtitle: position.name !== position.symbol ? position.symbol : undefined,
    type,
    quickSummary,
    bucketLabel,
    bucketReason,
    riskLevel,
    riskReason,
    makesMoney,
    losesMoney,
    exitDifficulty: exit.level,
    exitReason: exit.reason,
    beginnerWarning,
    badges: unique([
      position.chainName,
      position.protocolName,
      position.source === "defi" ? "DeFi" : "Wallet",
      position.positionType !== "wallet" ? capitalize(position.positionType) : undefined,
      position.isStablecoin ? "Stablecoin" : undefined,
      position.positionType === "locked" ? "Locked" : undefined,
    ]),
    metadata: {
      valueUsd: position.usdValue,
      change24hPct: position.priceChange24h,
      chain: position.chainName,
      protocol: position.protocolName,
      sourceType: position.source === "defi" ? "DeFi" : "Wallet",
      isStable: position.isStablecoin,
      isLocked: position.positionType === "locked",
    },
  };
}

function buildBucketEntryExplanation(entry: PortfolioBucketEntry): PositionExplanation {
  const bucketMeta = getPortfolioBucketMeta(entry.bucketId);
  const type = getBucketType(entry.bucketId);

  let quickSummary = "This is part of your portfolio.";
  let riskLevel: PositionRiskLevel = "Medium";
  let riskReason = "Its risk depends on the kind of asset and where it sits.";
  let makesMoney = ["This depends on the underlying asset or protocol."];
  let losesMoney = ["The underlying asset or protocol can lose value."];
  let exitDifficulty: PositionExitDifficulty = entry.bucketId === "locked_funds" ? "Locked" : entry.sourceKind === "defi" ? "Moderate" : "Easy";
  let exitReason = exitDifficulty === "Locked"
    ? "You cannot freely move this balance right now."
    : exitDifficulty === "Moderate"
    ? "You may need a withdrawal step before the funds are fully liquid."
    : "You can usually move or sell this quickly.";
  let beginnerWarning = "Know what the asset is before treating it like cash.";

  switch (entry.bucketId) {
    case "safe_cash":
      quickSummary = "This is a liquid stablecoin balance.";
      riskLevel = "Low";
      riskReason = "It is usually steadier than a normal token, but stablecoin and chain risk still exist.";
      makesMoney = ["This is mainly useful for stability and quick access."];
      losesMoney = ["A stablecoin can lose its peg or face issuer risk."];
      beginnerWarning = "Stablecoins are steadier than most tokens, but they can still break their peg.";
      break;
    case "long_term_holds":
      quickSummary = "This is a regular token holding.";
      riskLevel = "Medium";
      riskReason = "Its value can rise or fall with the market price of the token.";
      makesMoney = ["You benefit if the token price rises."];
      losesMoney = ["You lose value if the token price falls."];
      beginnerWarning = "Do not confuse a normal token holding with cash.";
      break;
    case "active_trades":
      quickSummary = "This is leveraged trading exposure.";
      riskLevel = "High";
      riskReason = "Leverage and short-term trading can amplify losses quickly.";
      makesMoney = ["This position can profit from short-term price moves."];
      losesMoney = [
        "Leverage can make losses happen faster.",
        "Liquidation or funding costs can reduce value.",
      ];
      beginnerWarning = "Leverage can damage a small account quickly.";
      break;
    case "defi_earn":
      quickSummary = "This is money placed into a protocol to earn yield.";
      riskLevel = "Medium";
      riskReason = "This depends on both the asset and the protocol.";
      makesMoney = ["You may earn yield from lending, staking, or protocol incentives."];
      losesMoney = [
        "Asset prices can fall while funds are in the protocol.",
        "Protocol risk may affect funds.",
      ];
      beginnerWarning = "Yield does not remove protocol risk.";
      break;
    case "locked_funds":
      quickSummary = "This is a locked balance with a limited exit.";
      riskLevel = "Medium";
      riskReason = "Reduced exit flexibility can matter if you need liquidity quickly.";
      makesMoney = ["You may still earn rewards or benefit from token upside while funds stay locked."];
      losesMoney = [
        "The asset can lose value while it remains locked.",
        "You may not be able to exit when you want to.",
      ];
      beginnerWarning = "Locked positions are not ideal for emergency liquidity.";
      break;
    case "forgotten_dust":
      quickSummary = "This is a tiny leftover balance.";
      riskLevel = "Low";
      riskReason = "The amount is small, so it matters more as clutter than as portfolio risk.";
      makesMoney = ["This is usually too small to matter much on its own."];
      losesMoney = ["Fees can easily outweigh the value you are trying to move."];
      beginnerWarning = "Do not over-focus on dust unless you want to clean up your wallet.";
      break;
  }

  return {
    title: entry.name || entry.symbol,
    subtitle: entry.name !== entry.symbol ? entry.symbol : undefined,
    type,
    quickSummary,
    bucketLabel: bucketMeta.label,
    bucketReason: entry.reason || getBucketReasonForLabel(entry.bucketId),
    riskLevel,
    riskReason,
    makesMoney,
    losesMoney,
    exitDifficulty,
    exitReason,
    beginnerWarning,
    badges: unique([
      entry.chainName,
      entry.protocolName,
      entry.sourceLabel,
    ]),
    metadata: {
      valueUsd: entry.usdValue,
      chain: entry.chainName,
      protocol: entry.protocolName,
      sourceType: entry.sourceLabel ?? capitalize(entry.sourceKind),
      isStable: entry.bucketId === "safe_cash",
      isLocked: entry.bucketId === "locked_funds",
    },
  };
}

function buildPerpExplanation(position: NormalizedPerpPosition): PositionExplanation {
  return {
    title: position.market,
    subtitle: `${position.side === "long" ? "Long" : "Short"} · ${position.coin}`,
    type: "perp",
    quickSummary: "This is a leveraged trading position.",
    bucketLabel: getPortfolioBucketMeta("active_trades").label,
    bucketReason: "Leveraged trading exposure.",
    riskLevel: getPerpRiskLevel(position),
    riskReason: position.riskLevel === "critical" || position.leverage >= 5
      ? "This uses high leverage, so losses can build quickly."
      : "Leverage can amplify losses much faster than a normal holding.",
    makesMoney: [
      `You can profit if the market moves ${position.side === "long" ? "up" : "down"} in your favor.`,
      "Short-term price moves matter more here than long-term investing.",
    ],
    losesMoney: [
      "Leverage can make losses happen faster than a spot position.",
      "Funding costs and liquidation risk can reduce value.",
    ],
    exitDifficulty: "Easy",
    exitReason: "You can usually close this quickly, but price moves can be sharp while you are in it.",
    beginnerWarning: "Leverage can damage a small account quickly.",
    badges: unique([
      position.platform,
      position.chain,
      `${position.leverage.toFixed(position.leverage >= 10 ? 0 : 1)}x`,
      capitalize(position.leverageType),
    ]),
    metadata: {
      valueUsd: position.marginUsed,
      chain: position.chain,
      protocol: position.platform,
      leverage: `${position.leverage.toFixed(position.leverage >= 10 ? 0 : 1)}x ${position.leverageType}`,
      sourceType: "Perps",
    },
  };
}

export function buildItemExplanation(input: ExplainableItem): PositionExplanation {
  switch (input.kind) {
    case "position":
      return buildNormalizedPositionExplanation(input.item);
    case "bucket_entry":
      return buildBucketEntryExplanation(input.item);
    case "perp":
      return buildPerpExplanation(input.item);
  }
}
