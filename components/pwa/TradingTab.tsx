"use client";

import { usePWAData } from "@/components/pwa/PWAContext";
import { PerpPositions } from "@/components/portfolio/PerpPositions";
import { DashboardSkeleton } from "@/components/common/Skeleton";
import { Activity } from "lucide-react";
import { TabHero } from "@/components/pwa/TabHero";

export function TradingTab() {
  const { portfolio, isLoading, perpsData, perpsLoading, address, visibleSections } = usePWAData();

  if (isLoading) return <div className="px-4 pt-3"><DashboardSkeleton /></div>;
  if (!portfolio) return null;

  return (
    <div className="space-y-4 px-4 pt-0 pb-24">
      <TabHero title="Trading" address={address} totalValue={portfolio.summary.totalUsdValue} />

      {visibleSections.detailedPerps && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 py-0.5">
            <Activity className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
            <p className="text-xs font-semibold text-text-hi">Perp Positions</p>
            <span className="text-[10px] text-text-lo">Hyperliquid · dYdX</span>
          </div>
          <PerpPositions data={perpsData ?? null} isLoading={perpsLoading} />
        </div>
      )}
    </div>
  );
}
