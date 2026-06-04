"use client";

import { usePWAData }    from "@/components/pwa/PWAContext";
import { WalletHistory } from "@/components/wallet/WalletHistory";
import { TabHero }       from "@/components/pwa/TabHero";
import { getActivityFeedModeForDashboard } from "@/lib/dashboardViewMode";

export function ActivityTab() {
  const { address, portfolio, viewMode } = usePWAData();
  const activityConfig = getActivityFeedModeForDashboard(viewMode);

  return (
    <div className="pb-24">
      <div className="px-4">
        <TabHero
          title="Activity"
          address={address}
          totalValue={portfolio?.summary.totalUsdValue}
          subtitle="Transaction history"
        />
      </div>
      <div className="px-4 space-y-4">
        <WalletHistory
          address={address}
          initialViewMode={activityConfig.defaultViewMode}
          allowRawToggle={activityConfig.allowRawToggle}
          compact={activityConfig.compact}
        />
      </div>
    </div>
  );
}
