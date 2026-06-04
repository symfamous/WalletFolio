"use client";

import { useState } from "react";
import { DebtToPaidTracker } from "@/components/intelligence/DebtToPaidTracker";
import { FxBar } from "@/components/common/FxBar";
import { TargetPriceCalculator } from "@/components/intelligence/TargetPriceCalculator";
import { ApprovalsScanner } from "@/components/intelligence/ApprovalsScanner";
import { PnlView } from "@/components/dashboard/views";
import { ShareCardModal } from "@/components/shell/ShareCardModal";
import { usePWAData } from "@/components/pwa/PWAContext";
import { TabHero } from "@/components/pwa/TabHero";
import { Card } from "@/components/ui/Card";
import { Calculator, CircleDollarSign, Share2 } from "lucide-react";

export function ToolsTab() {
  const {
    address,
    portfolio,
    currency,
    setCurrency,
    rates,
    format,
    isLoading,
  } = usePWAData();

  const hasPricedHoldings = portfolio?.aggregated.some((holding) => holding.priceAvailable) ?? false;
  const [shareOpen, setShareOpen] = useState(false);
  const topAssets = (portfolio?.aggregated ?? [])
    .filter((h) => h.priceAvailable && h.totalUsdValue > 0)
    .sort((a, b) => b.totalUsdValue - a.totalUsdValue)
    .slice(0, 6)
    .map((h) => h.symbol);

  return (
    <div className="space-y-5 px-4 pt-0 pb-24">
      <TabHero title="Tools" address={address} totalValue={portfolio?.summary.totalUsdValue} />

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CircleDollarSign className="h-4 w-4 text-accent" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold text-text-hi">Currency Converter</h2>
        </div>
        <FxBar currency={currency} onChangeCurrency={setCurrency} rates={rates} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CircleDollarSign className="h-4 w-4 text-accent" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold text-text-hi">Debt To Paid</h2>
        </div>
        <DebtToPaidTracker currency={currency} rates={rates} />
      </div>

      {isLoading ? (
        <Card>
          <p className="text-sm font-medium text-text-hi">Loading portfolio tools...</p>
          <p className="mt-1 text-xs text-text-lo">
            Target calculations will appear once your priced holdings finish loading.
          </p>
        </Card>
      ) : portfolio && hasPricedHoldings ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-accent" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold text-text-hi">Target Price Calculator</h2>
          </div>
          <TargetPriceCalculator portfolio={portfolio} format={format} currency={currency} />
        </div>
      ) : portfolio ? (
        <Card>
          <p className="text-sm font-medium text-text-hi">Target price calculator unavailable</p>
          <p className="mt-1 text-xs text-text-lo">
            This wallet does not currently have any priced holdings that can be used for target price calculations.
          </p>
        </Card>
      ) : null}

      <ApprovalsScanner address={address} />

      {portfolio ? <PnlView address={address} portfolio={portfolio} /> : null}

      {portfolio ? (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-text-hi">Share your portfolio</h2>
              <p className="mt-0.5 text-xs text-text-lo">Generate a card to save or post.</p>
            </div>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              <Share2 className="h-4 w-4" /> Share
            </button>
          </div>
        </Card>
      ) : null}

      {portfolio ? (
        <ShareCardModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          name={`${address.slice(0, 6)}…${address.slice(-4)}`}
          totalUsd={portfolio.summary.totalUsdValue}
          change24h={portfolio.summary.change24h}
          topAssets={topAssets}
        />
      ) : null}
    </div>
  );
}
