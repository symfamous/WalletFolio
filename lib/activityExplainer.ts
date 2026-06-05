import type {
  ActivityFeedSummary,
  ActivityRiskImpact,
  ExplainedActivity,
  ExplainedActivityType,
  HistoryEvent,
} from "../types/index.ts";

export const MEANINGFUL_ACTIVITY_THRESHOLD_USD = 100;
export const ACTIVITY_NOISE_THRESHOLD_USD = 5;

const STABLE_SYMBOLS = new Set([
  "USDC", "USDT", "DAI", "USDE", "FDUSD", "USDS", "TUSD", "LUSD", "SUSDE", "PYUSD",
]);

interface ActivityExplanationDetail {
  title: string;
  plainEnglish: string;
  riskImpact: ActivityRiskImpact;
  riskReason?: string;
  bucketImpact?: string;
  beginnerNote?: string;
  shortReason?: string;
  protocol?: string;
}

function isStable(symbol?: string): boolean {
  return Boolean(symbol && STABLE_SYMBOLS.has(symbol.toUpperCase()));
}

function formatEventValue(value?: number): string | undefined {
  if (value === undefined || value <= 0) return undefined;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(value < 10 ? 2 : 0)}`;
}

function extractProtocol(description: string): string | undefined {
  const patterns = [
    /\binto ([A-Z][A-Za-z0-9 .-]+)/,
    /\bfrom ([A-Z][A-Za-z0-9 .-]+)/,
    /\bon ([A-Z][A-Za-z0-9 .-]+)/,
    /\bto ([A-Z][A-Za-z0-9 .-]+) to earn/i,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    const value = match?.[1]?.trim();
    if (value && value.length <= 24 && !/wallet|funds|protocol/i.test(value)) return value;
  }

  return undefined;
}

function extractTargetChain(description: string): string | undefined {
  const match = description.match(/\bto ([A-Z][A-Za-z0-9 -]+)/);
  return match?.[1]?.trim();
}

function getRiskBadgeTitle(riskImpact: ActivityRiskImpact): string {
  switch (riskImpact) {
    case "Higher":
      return "Risk likely increased";
    case "Lower":
      return "Risk likely decreased";
    case "Unchanged":
      return "Risk likely unchanged";
    case "Unknown":
    default:
      return "Risk impact is unclear";
  }
}

function defaultTitle(event: HistoryEvent): string {
  return event.description || "Wallet activity";
}

function mapType(event: HistoryEvent): ExplainedActivityType {
  switch (event.type) {
    case "swap":
    case "deposit":
    case "withdraw":
    case "bridge":
    case "send":
    case "receive":
    case "borrow":
    case "repay":
    case "approve":
      return event.type;
    case "claim":
      return "reward";
    case "other":
      return /perp|leverage|margin|futures/i.test(event.description) ? "trade" : "unknown";
    default:
      return "unknown";
  }
}

function buildSwapExplanation(event: HistoryEvent): ActivityExplanationDetail {
  const from = event.tokenSymbol || "one asset";
  const to = event.toTokenSymbol || "another asset";
  const fromStable = isStable(event.tokenSymbol);
  const toStable = isStable(event.toTokenSymbol);

  let riskImpact: ActivityRiskImpact = "Unknown";
  let riskReason = "This changed what your money is exposed to.";
  let shortReason = "Asset rotation";

  if (fromStable && !toStable) {
    riskImpact = "Higher";
    riskReason = "You moved from a steadier asset into a more volatile one.";
    shortReason = "More market exposure";
  } else if (!fromStable && toStable) {
    riskImpact = "Lower";
    riskReason = "You moved from a volatile asset into a steadier one.";
    shortReason = "More stable holdings";
  } else if (fromStable === toStable) {
    riskImpact = "Unchanged";
    riskReason = "This changed the asset mix more than the overall risk level.";
  }

  return {
    title: `You swapped ${from} for ${to}.`,
    plainEnglish: `You swapped ${from} for ${to}.`,
    riskImpact,
    riskReason,
    bucketImpact: fromStable && !toStable
      ? "Money likely moved out of Safe Cash and into Long-Term Holds or Active Trades."
      : !fromStable && toStable
      ? "Money likely moved toward Safe Cash."
      : "Your money likely stayed in a similar bucket mix.",
    beginnerNote: "A swap changes what you own. It does not create profit by itself.",
    shortReason,
  };
}

function buildDepositExplanation(event: HistoryEvent): ActivityExplanationDetail {
  const symbol = event.tokenSymbol || "funds";
  const protocol = extractProtocol(event.description);
  return {
    title: protocol
      ? `You moved ${symbol} into ${protocol} to earn yield.`
      : `You moved ${symbol} into DeFi to earn yield.`,
    plainEnglish: protocol
      ? `You moved ${symbol} into ${protocol} to earn yield.`
      : `You moved ${symbol} into a protocol to earn yield.`,
    riskImpact: "Higher",
    riskReason: "Your funds are now inside a protocol instead of sitting directly in your wallet.",
    bucketImpact: "Money likely moved toward DeFi Earn.",
    beginnerNote: "Yield can help returns, but it does not remove protocol risk.",
    shortReason: "Entered DeFi",
    protocol,
  };
}

function buildWithdrawExplanation(event: HistoryEvent): ActivityExplanationDetail {
  const symbol = event.tokenSymbol || "funds";
  const protocol = extractProtocol(event.description);
  return {
    title: protocol
      ? `You removed ${symbol} from ${protocol} back to your wallet.`
      : `You removed ${symbol} from DeFi back to your wallet.`,
    plainEnglish: protocol
      ? `You removed ${symbol} from ${protocol} back to your wallet.`
      : `You removed ${symbol} from a protocol back to your wallet.`,
    riskImpact: "Lower",
    riskReason: "Your funds became more directly accessible.",
    bucketImpact: "Money likely moved out of DeFi Earn and into wallet holdings.",
    beginnerNote: "Moving funds back to your wallet usually makes them easier to access.",
    shortReason: "Left DeFi",
    protocol,
  };
}

function buildBridgeExplanation(event: HistoryEvent): ActivityExplanationDetail {
  const symbol = event.tokenSymbol || "funds";
  const targetChain = extractTargetChain(event.description);
  const action = targetChain ? `You bridged ${symbol} to ${targetChain}.` : `You bridged ${symbol} to another chain.`;
  return {
    title: action,
    plainEnglish: action,
    riskImpact: "Unchanged",
    riskReason: "This mainly changed where the funds sit, not what they are invested in.",
    beginnerNote: "A bridge moves funds between chains. It is not the same as a swap.",
    shortReason: "Chain move",
  };
}

function buildTradeExplanation(event: HistoryEvent): ActivityExplanationDetail {
  const lowered = event.description.toLowerCase();
  const reducing = /reduce|close|decrease/.test(lowered);
  return {
    title: reducing ? "You reduced a leveraged trade." : "You opened or increased a leveraged trade.",
    plainEnglish: reducing ? "You reduced a leveraged trade." : "You opened or increased a leveraged trade.",
    riskImpact: reducing ? "Lower" : "Higher",
    riskReason: reducing
      ? "Less leveraged exposure usually means less trading risk."
      : "More leveraged exposure can increase losses quickly.",
    bucketImpact: "Money likely moved within Active Trades.",
    beginnerNote: "Leverage can move faster than a normal holding in both directions.",
    shortReason: reducing ? "Reduced leverage" : "Added leverage",
  };
}

function buildRewardExplanation(event: HistoryEvent): ActivityExplanationDetail {
  const symbol = event.tokenSymbol || "rewards";
  const protocol = extractProtocol(event.description);
  return {
    title: protocol ? `You claimed ${symbol} from ${protocol}.` : `You claimed ${symbol}.`,
    plainEnglish: protocol ? `You claimed rewards from ${protocol}.` : "You claimed rewards.",
    riskImpact: "Unchanged",
    riskReason: "Claiming rewards usually changes balances more than portfolio risk.",
    beginnerNote: "Claiming rewards does not remove the underlying protocol risk.",
    shortReason: "Claimed rewards",
    protocol,
  };
}

function buildSendExplanation(event: HistoryEvent): ActivityExplanationDetail {
  const symbol = event.tokenSymbol || "funds";
  const stable = isStable(event.tokenSymbol);
  return {
    title: stable ? `You sent stablecoins out of this wallet.` : `You sent ${symbol} out of this wallet.`,
    plainEnglish: stable ? `You sent stablecoins out of this wallet.` : `You sent ${symbol} out of this wallet.`,
    riskImpact: "Unknown",
    riskReason: "Sending funds changes what remains in the wallet, but the portfolio effect is not always clear.",
    beginnerNote: "A send is just a movement of funds. It is not always an investment decision.",
    shortReason: "Sent out",
  };
}

function buildReceiveExplanation(event: HistoryEvent): ActivityExplanationDetail {
  const symbol = event.tokenSymbol || "funds";
  const stable = isStable(event.tokenSymbol);
  const usdValue = event.usdValue ?? 0;
  const tiny = usdValue > 0 && usdValue <= ACTIVITY_NOISE_THRESHOLD_USD;

  return {
    title: tiny
      ? "You received a small leftover token."
      : stable
      ? `You received ${symbol} into this wallet.`
      : `You received ${symbol} into this wallet.`,
    plainEnglish: tiny
      ? "You received a small token balance that is not very important."
      : stable
      ? `You received ${symbol} into this wallet.`
      : `You received ${symbol} into this wallet.`,
    riskImpact: tiny ? "Unchanged" : stable ? "Lower" : "Unknown",
    riskReason: tiny
      ? "This is too small to matter much."
      : stable
      ? "Receiving stable assets can add a steadier balance to the wallet."
      : "Receiving funds does not always make the risk change obvious.",
    beginnerNote: tiny
      ? "Very small receives are often just wallet clutter."
      : "A receive changes what is in the wallet, but not always the overall strategy.",
    shortReason: tiny ? "Small receive" : "Received in wallet",
  };
}

function buildBorrowExplanation(event: HistoryEvent): ActivityExplanationDetail {
  const protocol = extractProtocol(event.description);
  return {
    title: "You borrowed against a DeFi position.",
    plainEnglish: protocol ? `You borrowed funds from ${protocol}.` : "You borrowed against a DeFi position.",
    riskImpact: "Higher",
    riskReason: "Borrowing adds debt and can increase liquidation risk.",
    beginnerNote: "Borrowing can make a portfolio more fragile during volatility.",
    shortReason: "Borrowed funds",
    protocol,
  };
}

function buildRepayExplanation(event: HistoryEvent): ActivityExplanationDetail {
  const protocol = extractProtocol(event.description);
  return {
    title: "You repaid borrowed funds.",
    plainEnglish: protocol ? `You repaid borrowed funds on ${protocol}.` : "You repaid borrowed funds.",
    riskImpact: "Lower",
    riskReason: "Repaying debt usually reduces liquidation and borrowing risk.",
    beginnerNote: "Repaying debt can make a portfolio more resilient.",
    shortReason: "Repaid debt",
    protocol,
  };
}

function buildApprovalExplanation(): ActivityExplanationDetail {
  return {
    title: "You approved a token for later use.",
    plainEnglish: "You approved a token so an app can use it later.",
    riskImpact: "Unchanged",
    riskReason: "This is setup activity, not a money move.",
    beginnerNote: "An approval does not move funds by itself.",
    shortReason: "Setup only",
  };
}

function buildUnknownExplanation(event: HistoryEvent): ActivityExplanationDetail {
  return {
    title: defaultTitle(event),
    plainEnglish: "This was wallet activity, but the exact meaning is not fully clear from the available data.",
    riskImpact: "Unknown",
    riskReason: "The data does not clearly show how this changed portfolio risk.",
    beginnerNote: "When activity is unclear, it is safer not to assume it helped or hurt the portfolio.",
    shortReason: "Not fully clear",
  };
}

export function explainHistoryEvent(event: HistoryEvent): ExplainedActivity {
  const explainedType = mapType(event);
  const protocol = extractProtocol(event.description);
  const tokenSymbols = [event.tokenSymbol, event.toTokenSymbol].filter((value): value is string => Boolean(value));
  const usdValue = event.usdValue;
  const isNoise =
    explainedType === "approve" ||
    (explainedType === "receive" &&
      !isStable(event.tokenSymbol) &&
      (usdValue ?? 0) > 0 &&
      (usdValue ?? 0) <= ACTIVITY_NOISE_THRESHOLD_USD);
  const isMeaningful = !isNoise && ((usdValue ?? 0) >= MEANINGFUL_ACTIVITY_THRESHOLD_USD || ["swap", "deposit", "withdraw", "trade", "borrow", "repay", "bridge"].includes(explainedType));

  const detail = (() => {
    switch (explainedType) {
      case "swap":
        return buildSwapExplanation(event);
      case "deposit":
        return buildDepositExplanation(event);
      case "withdraw":
        return buildWithdrawExplanation(event);
      case "bridge":
        return buildBridgeExplanation(event);
      case "trade":
        return buildTradeExplanation(event);
      case "reward":
        return buildRewardExplanation(event);
      case "send":
        return buildSendExplanation(event);
      case "receive":
        return buildReceiveExplanation(event);
      case "borrow":
        return buildBorrowExplanation(event);
      case "repay":
        return buildRepayExplanation(event);
      case "approve":
        return buildApprovalExplanation();
      case "unknown":
      default:
        return buildUnknownExplanation(event);
    }
  })();

  return {
    id: event.id,
    title: detail.title,
    subtitle: detail.shortReason,
    type: explainedType,
    plainEnglish: detail.plainEnglish,
    shortReason: detail.shortReason,
    protocol: detail.protocol ?? protocol,
    chain: event.chainName,
    tokenSymbols,
    usdValue,
    isMeaningful,
    isNoise,
    riskImpact: detail.riskImpact,
    riskReason: detail.riskReason,
    bucketImpact: detail.bucketImpact,
    beginnerNote: detail.beginnerNote,
    timestamp: event.timestamp,
    rawEvent: event,
  };
}

export function explainHistoryEvents(events: HistoryEvent[]): ExplainedActivity[] {
  return events.map(explainHistoryEvent);
}

export function summarizeExplainedActivity(events: ExplainedActivity[]): ActivityFeedSummary {
  const meaningful = events.filter((event) => !event.isNoise);
  const biggest = meaningful.reduce<ExplainedActivity | null>((best, event) => {
    if (!best) return event;
    return (event.usdValue ?? 0) > (best.usdValue ?? 0) ? event : best;
  }, null);
  const totalMeaningfulVolumeUsd = meaningful.reduce((sum, event) => sum + Math.max(0, event.usdValue ?? 0), 0);
  const riskSet = new Set(meaningful.map((event) => event.riskImpact).filter((value) => value !== "Unknown"));
  const firstProtocol = meaningful.find((event) => event.protocol)?.protocol;
  const latestMeaningful = meaningful[0];

  let overallRiskDirection: ActivityFeedSummary["overallRiskDirection"] = "Unknown";
  if (riskSet.size === 0) overallRiskDirection = "Unknown";
  else if (riskSet.size > 1) overallRiskDirection = "Mixed";
  else if (riskSet.has("Higher")) overallRiskDirection = "Higher";
  else if (riskSet.has("Lower")) overallRiskDirection = "Lower";
  else overallRiskDirection = "Unchanged";

  const biggestAction = biggest?.title ?? "No major recent actions.";
  const summaryLine =
    overallRiskDirection === "Higher"
      ? "Recent activity slightly increased your portfolio risk."
      : overallRiskDirection === "Lower"
      ? "Recent activity mostly reduced portfolio risk."
      : overallRiskDirection === "Mixed"
      ? "Recent activity had a mixed effect on portfolio risk."
      : overallRiskDirection === "Unchanged"
      ? "Most recent actions were routine wallet moves."
      : "Recent activity was limited or hard to classify.";

  return {
    biggestAction,
    totalMeaningfulVolumeUsd: totalMeaningfulVolumeUsd > 0 ? totalMeaningfulVolumeUsd : undefined,
    newProtocol: firstProtocol,
    overallRiskDirection,
    summaryLine: latestMeaningful ? `${summaryLine} Latest: ${latestMeaningful.title}` : summaryLine,
  };
}

export function getRiskImpactLabel(riskImpact: ActivityRiskImpact) {
  return getRiskBadgeTitle(riskImpact);
}

export function getRiskImpactChipLabel(riskImpact: ActivityRiskImpact) {
  switch (riskImpact) {
    case "Higher":
      return "More risk";
    case "Lower":
      return "Less risk";
    case "Unchanged":
      return "No big change";
    case "Unknown":
    default:
      return "Unclear";
  }
}
