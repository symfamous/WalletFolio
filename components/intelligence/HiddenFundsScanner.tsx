"use client";

import { useMemo } from "react";
import { Eye, Gift, Building2, Zap, ExternalLink, type LucideIcon } from "lucide-react";
import { formatUSD } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import type { Portfolio, PortfolioIntelligence } from "@/types";
import { MIN_VISIBLE_USD } from "@/types";

interface HiddenFundsScannerProps {
  portfolio: Portfolio;
  intelligence: PortfolioIntelligence;
}

interface FundItem {
  id: string;
  type: "reward" | "dust" | "abandoned";
  symbol: string;
  name: string;
  logo?: string;
  chainSlug: string;
  chainName: string;
  chainColor: string;
  chainEmoji: string;
  usdValue: number;
  description: string;
  action: string;
  actionLabel: string;
  actionUrl?: string;
  actionable: boolean;
}

const TYPE_CONFIG: Record<FundItem["type"], { icon: LucideIcon; color: string; label: string }> = {
  reward:    { icon: Gift,      color: "#00f3ff", label: "Unclaimed Reward" },
  dust:      { icon: Zap,       color: "#5a78a0", label: "Dust" },
  abandoned: { icon: Building2, color: "#ffb4ab", label: "Abandoned" },
};

const CHAIN_EXPLORERS: Record<string, string> = {
  ethereum:              "https://etherscan.io",
  arbitrum:              "https://arbiscan.io",
  optimism:              "https://optimistic.etherscan.io",
  base:                  "https://basescan.org",
  polygon:               "https://polygonscan.com",
  "binance-smart-chain": "https://bscscan.com",
  avalanche:             "https://snowtrace.io",
  fantom:                "https://ftmscan.com",
  "zksync-era":          "https://explorer.zksync.io",
  linea:                 "https://lineascan.build",
  scroll:                "https://scrollscan.com",
  blast:                 "https://blastscan.io",
  gnosis:                "https://gnosisscan.io",
  mantle:                "https://explorer.mantle.xyz",
  "hyper-evm":           "https://explorer.hyperliquid.xyz",
};

const PROTOCOL_APPS: Record<string, string> = {
  morpho:   "https://app.morpho.org",
  aave:     "https://app.aave.com",
  compound: "https://app.compound.finance",
  uniswap:  "https://app.uniswap.org",
  curve:    "https://curve.fi",
  lido:     "https://lido.fi",
  convex:   "https://www.convexfinance.com",
  yearn:    "https://yearn.finance",
  "1inch":  "https://app.1inch.io",
};

function explorerAddressUrl(chainSlug: string, address: string): string | undefined {
  const base = CHAIN_EXPLORERS[chainSlug];
  if (!base || !address) return undefined;
  return `${base}/address/${address}`;
}

function protocolUrl(protocolId?: string): string | undefined {
  if (!protocolId) return undefined;
  const key = protocolId.toLowerCase().split("-")[0];
  return PROTOCOL_APPS[key];
}

function FundRow({ item, walletAddress }: { item: FundItem; walletAddress: string }) {
  const config = TYPE_CONFIG[item.type];
  const Icon = config.icon;

  const actionUrl =
    item.actionUrl ??
    (item.type === "reward" || item.type === "abandoned"
      ? explorerAddressUrl(item.chainSlug, walletAddress)
      : undefined);

  return (
    <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3 transition-colors hover:bg-surface-raised/20 last:border-0">
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${config.color}18` }}
      >
        <Icon className="h-4 w-4" style={{ color: config.color }} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="mb-0.5 truncate text-sm font-medium text-text-hi">{item.description}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="rounded border px-1.5 py-0.5 text-[10px]"
            style={{
              color: item.chainColor,
              borderColor: `${item.chainColor}30`,
              backgroundColor: `${item.chainColor}12`,
            }}
          >
            {item.chainEmoji} {item.chainName}
          </span>
          <span
            className="rounded border px-1.5 py-0.5 text-[10px]"
            style={{
              color: config.color,
              borderColor: `${config.color}30`,
              backgroundColor: `${config.color}10`,
            }}
          >
            {config.label}
          </span>
        </div>
      </div>

      <div className="flex flex-shrink-0 flex-col items-end gap-1 text-right">
        <p className="num text-sm font-semibold text-text-hi">{formatUSD(item.usdValue)}</p>
        {actionUrl ? (
          <a
            href={actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-accent transition-colors hover:text-accent"
          >
            {item.actionLabel}
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        ) : item.actionable ? (
          <p className="text-[10px] text-text-lo">{item.actionLabel}</p>
        ) : null}
      </div>
    </div>
  );
}

export function HiddenFundsScanner({ portfolio, intelligence }: HiddenFundsScannerProps) {
  const walletAddress = portfolio.address;

  const items = useMemo<FundItem[]>(() => {
    const result: FundItem[] = [];

    for (const fund of intelligence.hiddenFunds) {
      if (fund.type === "unclaimed_reward" && fund.usdValue >= 1) {
        const protoUrl = protocolUrl(fund.protocolName);
        result.push({
          id: `reward-${fund.symbol}-${fund.chainSlug}`,
          type: "reward",
          symbol: fund.symbol,
          name: fund.name,
          chainSlug: fund.chainSlug,
          chainName: fund.chainName,
          chainColor: fund.chainColor,
          chainEmoji: fund.chainEmoji,
          usdValue: fund.usdValue,
          description: fund.description,
          action: "claim",
          actionLabel: protoUrl ? "Open protocol" : "View on explorer",
          actionUrl: protoUrl ?? explorerAddressUrl(fund.chainSlug, walletAddress),
          actionable: true,
        });
        continue;
      }

      if (fund.type === "dust" && fund.usdValue >= 1 && fund.usdValue <= MIN_VISIBLE_USD) {
        result.push({
          id: `dust-${fund.symbol}-${fund.chainSlug}`,
          type: "dust",
          symbol: fund.symbol,
          name: fund.name,
          chainSlug: fund.chainSlug,
          chainName: fund.chainName,
          chainColor: fund.chainColor,
          chainEmoji: fund.chainEmoji,
          usdValue: fund.usdValue,
          description: fund.description,
          action: "review",
          actionLabel: "View on explorer",
          actionUrl: explorerAddressUrl(fund.chainSlug, walletAddress),
          actionable: false,
        });
        continue;
      }

      if (fund.type === "abandoned_position" && fund.usdValue >= 1) {
        const protoUrl = protocolUrl(fund.protocolName);
        result.push({
          id: `abandoned-${fund.protocolName}-${fund.chainSlug}`,
          type: "abandoned",
          symbol: fund.symbol,
          name: fund.name,
          chainSlug: fund.chainSlug,
          chainName: fund.chainName,
          chainColor: fund.chainColor,
          chainEmoji: fund.chainEmoji,
          usdValue: fund.usdValue,
          description: fund.description,
          action: "withdraw",
          actionLabel: protoUrl ? "Open protocol" : "View on explorer",
          actionUrl: protoUrl ?? explorerAddressUrl(fund.chainSlug, walletAddress),
          actionable: true,
        });
      }
    }

    return result
      .filter((item) => item.usdValue >= 1)
      .sort((a, b) => {
        if (a.actionable !== b.actionable) return a.actionable ? -1 : 1;
        return b.usdValue - a.usdValue;
      });
  }, [intelligence, walletAddress]);

  const totalValue = items.reduce((sum, item) => sum + item.usdValue, 0);
  const actionableTotal = items
    .filter((item) => item.actionable)
    .reduce((sum, item) => sum + item.usdValue, 0);

  if (items.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center py-8 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-success/20 bg-success/10">
            <Eye className="h-5 w-5 text-success" />
          </div>
          <p className="text-sm text-text-mid">No hidden balances found</p>
          <p className="mt-1 text-xs text-text-lo">
            Nothing appears to be hidden by the current portfolio filters
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card noPadding className="overflow-hidden">
      <div className="flex items-center gap-4 border-b border-border bg-surface-raised/30 px-4 py-3">
        <div className="flex-1">
          <p className="text-xs text-text-lo">Total hidden value</p>
          <p className="num text-sm font-semibold text-text-hi">{formatUSD(totalValue)}</p>
        </div>
        {actionableTotal > 0 && (
          <div className="text-right">
            <p className="text-xs text-text-lo">Actionable</p>
            <p className="num text-sm font-semibold text-accent">{formatUSD(actionableTotal)}</p>
          </div>
        )}
        <div className="text-right">
          <p className="text-xs text-text-lo">Items</p>
          <p className="num text-sm font-semibold text-text-hi">{items.length}</p>
        </div>
      </div>

      {items.slice(0, 12).map((item) => (
        <FundRow key={item.id} item={item} walletAddress={walletAddress} />
      ))}

      {items.length > 12 && (
        <div className="border-t border-border/40 px-4 py-2.5 text-center">
          <p className="text-xs text-text-lo">+{items.length - 12} more items</p>
        </div>
      )}
    </Card>
  );
}
