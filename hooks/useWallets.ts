"use client";

import { useState, useEffect, useCallback } from "react";
import { sameTrackedAddress } from "@/lib/utils";
import {
  loadSavedWallets, addSavedWallet, removeSavedWallet,
  updateWalletLabel,
  type SavedWallet,
} from "@/lib/wallets";

export function useWallets(currentAddress?: string) {
  const [wallets, setWallets] = useState<SavedWallet[]>([]);

  useEffect(() => {
    setWallets(loadSavedWallets());
  }, []);

  const saveWallet = useCallback((address: string, label: string) => {
    addSavedWallet(address, label);
    setWallets(loadSavedWallets());
  }, []);

  const removeWallet = useCallback((address: string) => {
    removeSavedWallet(address);
    setWallets(loadSavedWallets());
  }, []);

  const renameWallet = useCallback((address: string, label: string) => {
    updateWalletLabel(address, label);
    setWallets(loadSavedWallets());
  }, []);

  const isCurrentSaved = currentAddress
    ? wallets.some((w) => sameTrackedAddress(w.address, currentAddress))
    : false;

  return {
    wallets,
    isCurrentSaved,
    saveWallet,
    removeWallet,
    renameWallet,
  };
}
