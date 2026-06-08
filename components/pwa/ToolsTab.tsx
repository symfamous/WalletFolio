"use client";

import { DebtToPaidTracker } from "@/components/intelligence/DebtToPaidTracker";
import { FxBar } from "@/components/common/FxBar";
import { TargetPriceCalculator } from "@/components/intelligence/TargetPriceCalculator";
import { ApprovalsScanner } from "@/components/intelligence/ApprovalsScanner";
import { usePWAData } from "@/components/pwa/PWAContext";
import { TabHero } from "@/components/pwa/TabHero";
import { Card } from "@/components/ui/Card";
import { Calculator, CircleDollarSign } from "lucide-react";

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

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CircleDollarSign className="h-4 w-4 text-accent" strokeWidth={1.5} />
          <h2 className="text-sm font-semibold text-text-hi">Debt To Paid</h2>
        </div>
        <DebtToPaidTracker currency={currency} rates={rates} />
      </div>
    </div>
  );
}
