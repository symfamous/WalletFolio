"use client";

import { AddressInput } from "@/components/wallet/AddressInput";
import { usePWAData } from "@/components/pwa/PWAContext";
import { TabHero } from "@/components/pwa/TabHero";
import { WalletManager } from "@/components/wallet/WalletManager";
import { Card } from "@/components/ui/Card";
import { useWallets } from "@/hooks/useWallets";
import { cn, formatUSD } from "@/lib/utils";
import { LogOut, Pause, Play, RefreshCw, Wallet2 } from "lucide-react";

export function SettingsTab() {
  const {
    address,
    portfolio,
    autoRefresh,
    onToggleAutoRefresh,
    onClear,
    onNewAddress,
    isFetching,
    onRefresh,
    timestamp,
  } = usePWAData();

  const wallets = useWallets(address);

  return (
    <div className="space-y-5 px-4 pt-0 pb-24">
      <TabHero title="Tools" address={address} totalValue={portfolio?.summary.totalUsdValue} />

      <Card noPadding className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-surface-raised/30 px-4 py-3">
          <Wallet2 className="h-3.5 w-3.5 text-text-lo" strokeWidth={1.5} />
          <p className="text-xs font-medium uppercase tracking-widest text-text-lo">Current Wallet</p>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="num flex-1 truncate text-xs text-text-mid">{address}</p>
            <button
              onClick={onClear}
              className="ml-3 flex shrink-0 items-center gap-1 text-xs text-danger hover:text-danger"
            >
              <LogOut className="h-3.5 w-3.5" /> Switch
            </button>
          </div>
          {portfolio && (
            <p className="num text-sm font-semibold text-text-hi">
              {formatUSD(portfolio.summary.totalUsdValue)}
            </p>
          )}
        </div>
        <div className="px-4 pb-4">
          <p className="mb-2 text-xs text-text-lo">Track a different address</p>
          <AddressInput onSubmit={onNewAddress} isLoading={isFetching} />
        </div>
      </Card>

      <WalletManager
        wallets={wallets.wallets}
        currentAddress={address}
        isCurrentSaved={wallets.isCurrentSaved}
        onSaveCurrent={(label) => wallets.saveWallet(address, label)}
        onRemove={wallets.removeWallet}
        onRename={wallets.renameWallet}
        onSwitch={onNewAddress}
        defaultExpanded
      />

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-hi">Auto-refresh</p>
            <p className="mt-0.5 text-xs text-text-lo">
              {autoRefresh ? "Refreshes every 30 seconds when tab is active" : "Paused - tap to resume"}
            </p>
            {timestamp && (
              <p className="mt-1 text-[10px] text-text-lo">
                Last updated: {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
            )}
          </div>
          <button
            onClick={onToggleAutoRefresh}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
              autoRefresh
                ? "border-success/25 bg-success/8 text-success"
                : "border-border bg-surface-raised text-text-lo",
            )}
          >
            {autoRefresh ? <><Pause className="h-3 w-3" /> Live</> : <><Play className="h-3 w-3" /> Paused</>}
          </button>
        </div>
        <div className="mt-3 border-t border-border/50 pt-3">
          <button
            onClick={onRefresh}
            disabled={isFetching}
            className="flex items-center gap-2 text-xs text-text-mid transition-colors hover:text-text-hi disabled:opacity-40"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            {isFetching ? "Refreshing..." : "Refresh now"}
          </button>
        </div>
      </Card>

      <Card>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-hi">About</p>
        <div className="space-y-1 text-xs text-text-lo">
          <p>walletfolio - Multi-chain Portfolio Intelligence</p>
          <p>Read-only - No wallet connection</p>
          <p className="text-text-mid">EVM + Solana - DeFi - Hyperliquid - History</p>
        </div>
      </Card>
    </div>
  );
}
