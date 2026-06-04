"use client";

import { useState } from "react";
import { usePWAData } from "@/components/pwa/PWAContext";
import { AddressInput } from "@/components/AddressInput";
import { useWallets } from "@/hooks/useWallets";
import { cn, formatUSD } from "@/lib/utils";
import { Plus, Trash2, ChevronRight, Check, Wallet, RefreshCw } from "lucide-react";

export function ProfileTab() {
  const {
    address,
    portfolio,
    onNewAddress,
    onClear,
    isFetching,
    onRefresh,
    autoRefresh,
    onToggleAutoRefresh,
    timestamp,
  } = usePWAData();

  const wallets = useWallets(address);
  const [labelInput, setLabelInput] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);

  const handleSaveWallet = () => {
    if (!address) return;
    const label = labelInput.trim() || address.slice(0, 8);
    wallets.saveWallet(address, label);
    setLabelInput("");
    setShowSaveForm(false);
  };

  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-accent" />
          <p className="text-sm font-bold text-text-hi">Profile</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Current Wallet */}
        <div className="px-4 py-3">
          <p className="text-[10px] text-text-lo uppercase tracking-widest mb-2">Current Wallet</p>
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs text-text-lo">Active</span>
              </div>
              <button
                onClick={onRefresh}
                disabled={isFetching}
                className="flex items-center gap-1 text-[10px] text-text-lo hover:text-accent transition-colors"
              >
                <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
              </button>
            </div>
            <p className="text-sm font-mono text-text-hi mb-1">{shortAddress}</p>
            {portfolio && (
              <p className="text-lg font-bold text-text-hi num">{formatUSD(portfolio.summary.totalUsdValue)}</p>
            )}
          </div>
        </div>

        {/* Saved Wallets */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-text-lo uppercase tracking-widest">Saved Wallets</p>
            <span className="text-[10px] text-accent">{wallets.wallets.length}</span>
          </div>

          <div className="space-y-2">
            {wallets.wallets.map((w) => {
              const isActive = w.address.toLowerCase() === address?.toLowerCase();
              return (
                <div
                  key={w.address}
                  className={cn(
                    "rounded-xl border p-3 transition-all",
                    isActive
                      ? "border-accent/30 bg-accent/5"
                      : "border-border bg-surface-raised hover:border-border-strong"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {isActive && <Check className="h-3 w-3 text-success flex-shrink-0" />}
                        <p className={cn("text-xs font-medium truncate", isActive ? "text-accent" : "text-text-hi")}>
                          {w.label || `${w.address.slice(0, 6)}...${w.address.slice(-4)}`}
                        </p>
                      </div>
                      <p className="text-[10px] text-text-lo font-mono">{w.address.slice(0, 12)}...{w.address.slice(-6)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!isActive && (
                        <button
                          onClick={() => onNewAddress(w.address)}
                          className="flex items-center gap-1 rounded-lg bg-accent/10 px-2 py-1 text-[10px] text-accent hover:bg-accent/20 transition-colors"
                        >
                          Switch
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        onClick={() => wallets.removeWallet(w.address)}
                        className="rounded-lg p-1.5 text-text-lo hover:text-danger hover:bg-danger/10 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {wallets.wallets.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-bg/30 p-4 text-center">
                <p className="text-xs text-text-lo">No saved wallets yet</p>
                <p className="text-[10px] text-text-lo mt-0.5">Save your current wallet below</p>
              </div>
            )}
          </div>
        </div>

        {/* Save Current Wallet */}
        {address && !wallets.isCurrentSaved && (
          <div className="px-4 py-3">
            {!showSaveForm ? (
              <button
                onClick={() => setShowSaveForm(true)}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-accent/20 bg-accent/5 py-3 text-xs text-accent hover:bg-accent/10 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Save This Wallet
              </button>
            ) : (
              <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-3">
                <p className="text-xs font-medium text-text-hi">Save Current Wallet</p>
                <input
                  type="text"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  placeholder="Nickname (optional)"
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text-hi placeholder:text-text-lo focus:outline-none focus:border-accent/40"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveWallet}
                    className="flex-1 rounded-lg bg-accent/10 py-2 text-xs font-medium text-accent hover:bg-accent/20 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setShowSaveForm(false); setLabelInput(""); }}
                    className="flex-1 rounded-lg border border-border py-2 text-xs text-text-lo hover:text-text-hi transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Switch Wallet */}
        <div className="px-4 py-3">
          <p className="text-[10px] text-text-lo uppercase tracking-widest mb-2">Switch to Different Wallet</p>
          <AddressInput onSubmit={onNewAddress} isLoading={isFetching} />
        </div>

        {/* Auto Refresh */}
        <div className="px-4 py-3">
          <div className="rounded-xl border border-border bg-surface-raised p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-text-hi">Auto-refresh</p>
                <p className="text-[10px] text-text-lo mt-0.5">
                  {autoRefresh ? "Refreshing every 30s" : "Paused"}
                </p>
              </div>
              <button
                onClick={onToggleAutoRefresh}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  autoRefresh ? "bg-success/20" : "bg-border"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 rounded-full bg-text-lo transition-transform",
                    autoRefresh ? "translate-x-6 bg-success" : "translate-x-1 bg-text-lo/40"
                  )}
                />
              </button>
            </div>
            {timestamp && (
              <p className="text-[9px] text-text-lo mt-2">
                Last update: {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
