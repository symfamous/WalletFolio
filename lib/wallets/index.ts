/**
 * lib/wallets/index.ts
 *
 * Multi-wallet management.
 * Saved wallets stored in localStorage.
 */

import { normalizeTrackedAddress, sameTrackedAddress } from "@/lib/utils";

export interface SavedWallet {
  address: string;
  label: string;
  addedAt: string;
  color: string; // for visual distinction
  order: number;
}

const STORAGE_KEY = "folio_saved_wallets";

const WALLET_COLORS = [
  "#3B82F6", // blue
  "#8B5CF6", // purple
  "#10B981", // green
  "#ffb4ab", // amber
  "#EF4444", // red
  "#06B6D4", // cyan
  "#00f3ff", // pink
  "#84CC16", // lime
];

function nextColor(existing: SavedWallet[]): string {
  const usedColors = new Set(existing.map((w) => w.color));
  return WALLET_COLORS.find((c) => !usedColors.has(c)) ?? WALLET_COLORS[existing.length % WALLET_COLORS.length];
}

export function loadSavedWallets(): SavedWallet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as SavedWallet[]).sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}

export function saveSavedWallets(wallets: SavedWallet[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
}

export function addSavedWallet(address: string, label: string): SavedWallet {
  const existing = loadSavedWallets();
  const normalizedAddress = normalizeTrackedAddress(address);

  // Dedup by address
  const existingWallet = existing.find((w) => sameTrackedAddress(w.address, normalizedAddress));
  if (existingWallet) {
    return existingWallet;
  }

  const wallet: SavedWallet = {
    address: normalizedAddress,
    label: label || shortenForLabel(address),
    addedAt: new Date().toISOString(),
    color: nextColor(existing),
    order: existing.length,
  };

  saveSavedWallets([...existing, wallet]);
  return wallet;
}

export function removeSavedWallet(address: string): void {
  const wallets = loadSavedWallets().filter(
    (w) => !sameTrackedAddress(w.address, address)
  );
  // Re-order
  wallets.forEach((w, i) => { w.order = i; });
  saveSavedWallets(wallets);
}

export function updateWalletLabel(address: string, label: string): void {
  const wallets = loadSavedWallets().map((w) =>
    sameTrackedAddress(w.address, address) ? { ...w, label } : w
  );
  saveSavedWallets(wallets);
}

export function reorderWallets(wallets: SavedWallet[]): void {
  wallets.forEach((w, i) => { w.order = i; });
  saveSavedWallets(wallets);
}

function shortenForLabel(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
