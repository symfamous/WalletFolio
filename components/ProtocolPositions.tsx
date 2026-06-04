"use client";

import { useState } from "react";
import {
  ChevronDown, ChevronRight, TrendingDown,
  Coins, Gift, Lock, ArrowDownLeft, ArrowUpRight,
} from "lucide-react";
import { cn, formatUSD, formatBalance, formatPrice } from "@/lib/utils";
import { TokenLogo } from "@/components/TokenLogo";
import { Badge } from "@/components/ui/Badge";
import { PositionExplainButton, PositionExplainDrawer } from "@/components/PositionExplainDrawer";
import { buildItemExplanation } from "@/lib/positionExplainer";
import type { ProtocolPosition, NormalizedPosition, PositionExplanation, ProtocolCategory } from "@/types";

interface ProtocolPositionsProps {
  protocols: ProtocolPosition[];
  totalDefiUsd: number;
  compact?: boolean;
  limit?: number;
}

const CATEGORY_LABELS: Record<ProtocolCategory, string> = {
  lending:    "Lending",
  borrowing:  "Borrowing",
  staking:    "Staking",
  liquidity:  "Liquidity",
  vault:      "Vault",
  reward:     "Rewards",
  locked:     "Locked",
  dex:        "DEX",
  mixed:      "Mixed",
};

const CATEGORY_COLORS: Record<ProtocolCategory, string> = {
  lending:    "#3B82F6",
  borrowing:  "#F43F5E",
  staking:    "#8B5CF6",
  liquidity:  "#10B981",
  vault:      "#ffb4ab",
  reward:     "#00f3ff",
  locked:     "#ffb4ab",
  dex:        "#00FF79",
  mixed:      "#5a78a0",
};

function PositionTokenRow({
  pos,
  variant = "default",
  onExplain,
}: {
  pos: NormalizedPosition;
  variant?: "deposit" | "borrow" | "reward" | "staked" | "default";
  onExplain: (explanation: PositionExplanation) => void;
}) {
  const isNeg = variant === "borrow";

  return (
    <div className="flex items-center gap-3 py-2 group">
      <TokenLogo logo={pos.logo} symbol={pos.symbol} size="xs" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-text-hi truncate">{pos.symbol}</p>
          <span
            className="inline-flex items-center gap-0.5 text-[10px] rounded-md px-1.5 py-0.5 border flex-shrink-0"
            style={{
              color:           pos.chainColor,
              borderColor:     `${pos.chainColor}30`,
              backgroundColor: `${pos.chainColor}12`,
            }}
            >
              {pos.chainEmoji} {pos.chainName}
            </span>
          </div>
        {pos.name && pos.name !== pos.symbol && (
          <p className="text-[11px] text-text-lo truncate mt-0.5">{pos.name}</p>
        )}
        <p className="text-xs text-text-lo">
          <span className="num">{formatBalance(pos.balance)}</span>
          {pos.price !== undefined && (
            <span className="ml-1">@ {formatPrice(pos.price)}</span>
          )}
          {pos.apy !== undefined && pos.apy > 0 && (
            <span className="ml-1 text-accent">| ~{pos.apy.toFixed(1)}% APY</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 text-right flex-shrink-0">
        <PositionExplainButton
          onClick={() => onExplain(buildItemExplanation({ kind: "position", item: pos }))}
          className="h-6 w-6"
          label={`Explain ${pos.symbol}`}
        />
        {pos.usdValue !== undefined ? (
          <p className={cn("num text-sm font-medium", isNeg ? "text-danger" : "text-text-hi")}>
            {isNeg ? "-" : ""}{formatUSD(pos.usdValue)}
          </p>
        ) : (
          <p className="text-xs text-text-lo italic">Unpriced</p>
        )}
      </div>
    </div>
  );
}

function ProtocolCard({
  protocol,
  onExplain,
}: {
  protocol: ProtocolPosition;
  onExplain: (explanation: PositionExplanation) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const hasDeposits = protocol.deposits.length > 0;
  const hasBorrows  = protocol.borrows.length > 0;
  const hasRewards  = protocol.rewards.length > 0;
  const hasStaked   = protocol.staked.length > 0;

  const catColor = CATEGORY_COLORS[protocol.category];

  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-surface transition-colors hover:border-border-strong">
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/[0.04]"
      >
        {/* Protocol identity */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div
            className="h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-xl text-sm font-bold text-text-hi"
            style={{ backgroundColor: catColor + "30", border: `1px solid ${catColor}40` }}
          >
            {protocol.protocolName.slice(0, 2).toUpperCase()}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-text-hi">{protocol.protocolName}</p>
              <Badge
                variant="chain"
                color={protocol.chainColor}
              >
                {protocol.chainEmoji} {protocol.chainName}
              </Badge>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-md border"
                style={{ color: catColor, borderColor: `${catColor}30`, backgroundColor: `${catColor}10` }}
              >
                {CATEGORY_LABELS[protocol.category]}
              </span>
            </div>

            {/* Mini summary */}
            <div className="mt-0.5 flex items-center gap-3 text-[11px] text-text-lo">
              {protocol.totalDepositUsd > 0 && (
                <span className="flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3 text-success" />
                  <span className="num text-text-mid">{formatUSD(protocol.totalDepositUsd, { compact: true })}</span>
                  supplied
                </span>
              )}
              {protocol.totalStakedUsd > 0 && (
                <span className="flex items-center gap-1">
                  <Lock className="h-3 w-3 text-accent" />
                  <span className="num text-text-mid">{formatUSD(protocol.totalStakedUsd, { compact: true })}</span>
                  staked
                </span>
              )}
              {protocol.totalBorrowUsd > 0 && (
                <span className="flex items-center gap-1">
                  <ArrowDownLeft className="h-3 w-3 text-danger" />
                  <span className="num text-danger">{formatUSD(protocol.totalBorrowUsd, { compact: true })}</span>
                  borrowed
                </span>
              )}
              {protocol.totalRewardUsd > 0 && (
                <span className="flex items-center gap-1">
                  <Gift className="h-3 w-3 text-warning" />
                  <span className="num text-text-mid">{formatUSD(protocol.totalRewardUsd, { compact: true })}</span>
                  rewards
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Net value */}
        <div className="text-right flex-shrink-0 flex items-center gap-2">
          <div>
            <p className="num text-sm font-semibold text-text-hi">
              {formatUSD(protocol.netUsdValue)}
            </p>
            <p className="text-[10px] text-text-lo">net value</p>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-text-lo transition-transform flex-shrink-0",
              expanded && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="space-y-3.5 border-t border-accent/7 px-4 pb-4 pt-3 animate-fade-in">

          {/* Deposits */}
          {hasDeposits && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                <p className="text-xs font-medium uppercase tracking-widest text-text-mid">
                  Supplied / Deposited
                </p>
              </div>
              <div className="divide-y divide-accent/8">
                {protocol.deposits.map((pos) => (
                  <PositionTokenRow key={pos.id} pos={pos} variant="deposit" onExplain={onExplain} />
                ))}
              </div>
            </div>
          )}

          {/* Staked / locked */}
          {hasStaked && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Lock className="h-3.5 w-3.5 text-accent" />
                <p className="text-xs font-medium uppercase tracking-widest text-text-mid">
                  Staked / Locked
                </p>
              </div>
              <div className="divide-y divide-accent/8">
                {protocol.staked.map((pos) => (
                  <PositionTokenRow key={pos.id} pos={pos} variant="staked" onExplain={onExplain} />
                ))}
              </div>
            </div>
          )}

          {/* Borrows */}
          {hasBorrows && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowDownLeft className="h-3.5 w-3.5 text-danger" />
                <p className="text-xs font-medium uppercase tracking-widest text-danger">
                  Borrowed (Liability)
                </p>
              </div>
              <div className="divide-y divide-accent/8">
                {protocol.borrows.map((pos) => (
                  <PositionTokenRow key={pos.id} pos={pos} variant="borrow" onExplain={onExplain} />
                ))}
              </div>
            </div>
          )}

          {/* Rewards */}
          {hasRewards && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Gift className="h-3.5 w-3.5 text-warning" />
                <p className="text-xs font-medium uppercase tracking-widest text-text-mid">
                  Claimable Rewards
                </p>
              </div>
              <div className="divide-y divide-accent/8">
                {protocol.rewards.map((pos) => (
                  <PositionTokenRow key={pos.id} pos={pos} variant="reward" onExplain={onExplain} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ProtocolPositions({ protocols, totalDefiUsd, compact = false, limit = 4 }: ProtocolPositionsProps) {
  const [selectedExplanation, setSelectedExplanation] = useState<PositionExplanation | null>(null);
  const visibleProtocols = protocols
    .filter((p) => p.netUsdValue >= 5 || p.totalBorrowUsd > 0)
    .slice(0, compact ? limit : protocols.length);
  if (visibleProtocols.length === 0) return null;

  if (compact) {
    return (
      <div className="animate-fade-up">
        <div className="space-y-0 overflow-hidden rounded-[12px] border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border bg-surface-raised px-5 py-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-accent">DeFi Positions · {formatUSD(totalDefiUsd, { compact: true })} net</p>
            <span className="text-[9px] uppercase tracking-[0.14em] text-text-lo">{visibleProtocols.length} shown</span>
          </div>
          {visibleProtocols.map((protocol, i) => (
            <button
              key={`${protocol.id}-${i}`}
              type="button"
              onClick={() => {
                const explainable = protocol.deposits[0] ?? protocol.staked[0] ?? protocol.rewards[0] ?? protocol.borrows[0];
                if (explainable) {
                  setSelectedExplanation(buildItemExplanation({ kind: "position", item: explainable }));
                }
              }}
              className="flex w-full items-center justify-between gap-3 border-t border-accent/7 px-5 py-4 text-left transition-colors first:border-t-0 hover:bg-accent/[0.04]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] border text-[10px] font-semibold"
                  style={{ color: protocol.chainColor, borderColor: `${protocol.chainColor}28`, backgroundColor: `${protocol.chainColor}08` }}
                >
                  {protocol.protocolName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="truncate text-sm font-semibold uppercase tracking-[0.05em] text-text-hi">{protocol.protocolName}</p>
                    <Badge variant="accent" className="opacity-80">{CATEGORY_LABELS[protocol.category]}</Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-text-lo">
                    <Badge variant="chain" color={protocol.chainColor}>{protocol.chainEmoji} {protocol.chainName}</Badge>
                    {protocol.totalDepositUsd > 0 ? <span>{formatUSD(protocol.totalDepositUsd, { compact: true })} supplied</span> : null}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className={`num text-[15px] font-semibold ${protocol.netUsdValue >= 0 ? "text-accent" : "text-danger"}`}>{formatUSD(protocol.netUsdValue)}</p>
              </div>
            </button>
          ))}
        </div>

        <PositionExplainDrawer
          open={selectedExplanation !== null}
          explanation={selectedExplanation}
          onClose={() => setSelectedExplanation(null)}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <div className="space-y-2.5">
        {visibleProtocols.map((protocol, i) => (
            <ProtocolCard
              key={`${protocol.id}-${i}`}
              protocol={protocol}
              onExplain={(explanation) => setSelectedExplanation(explanation)}
            />
          ))}
      </div>

      <PositionExplainDrawer
        open={selectedExplanation !== null}
        explanation={selectedExplanation}
        onClose={() => setSelectedExplanation(null)}
      />
    </div>
  );
}
