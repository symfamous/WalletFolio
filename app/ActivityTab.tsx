"use client";

import { usePWAData }     from "@/components/pwa/PWAContext";
import { WalletHistory }  from "@/components/wallet/WalletHistory";

export function ActivityTab() {
  const { address } = usePWAData();

  return (
    <div className="space-y-4 px-4 pt-4 pb-24">
      <WalletHistory address={address} />
    </div>
  );
}