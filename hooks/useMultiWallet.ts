"use client";

import { useState, useCallback, useEffect } from "react";
import { normalizeTrackedAddress } from "@/lib/utils";

const LS_WALLETS = "pseryte_wallets";

export interface WalletEntry {
  address: string;
  label?:  string;
}

export function useMultiWallet() {
  const [wallets, setWallets] = useState<WalletEntry[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(LS_WALLETS);
      if (saved) {
        const parsed = JSON.parse(saved) as WalletEntry[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Migrate: if a stored address looks like a lowercased Solana address
          // (base58 but all lowercase), we can't recover the original casing —
          // those will need to be re-added. We just pass them through as-is and
          // AppShell handles the case-insensitive match fallback.
          setWallets(parsed);
        }
      }
    } catch {}
  }, []);

  const persist = useCallback((next: WalletEntry[]) => {
    setWallets(next);
    if (typeof window !== "undefined") localStorage.setItem(LS_WALLETS, JSON.stringify(next));
  }, []);

  const addWallet = useCallback((address: string, label?: string) => {
    const norm = normalizeTrackedAddress(address);
    setWallets((prev) => {
      if (prev.some((w) => w.address === norm)) return prev; // no duplicate
      const next = [...prev, { address: norm, label }];
      if (typeof window !== "undefined") localStorage.setItem(LS_WALLETS, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeWallet = useCallback((address: string) => {
    const norm = normalizeTrackedAddress(address);
    setWallets((prev) => {
      const next = prev.filter((w) => w.address !== norm);
      if (typeof window !== "undefined") localStorage.setItem(LS_WALLETS, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateLabel = useCallback((address: string, label: string) => {
    const norm = normalizeTrackedAddress(address);
    setWallets((prev) => {
      const next = prev.map((w) => w.address === norm ? { ...w, label } : w);
      if (typeof window !== "undefined") localStorage.setItem(LS_WALLETS, JSON.stringify(next));
      return next;
    });
  }, []);

  const primaryAddress = wallets[0]?.address ?? "";

  return { wallets, primaryAddress, addWallet, removeWallet, updateLabel, persist };
}
