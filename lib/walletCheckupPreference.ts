import { normalizeTrackedAddress } from "./utils.ts";

export interface WalletCheckupPreference {
  seenAt?: string;
  dismissedAt?: string;
}

const STORAGE_KEY = "folio_wallet_checkup";

type WalletCheckupPreferenceMap = Record<string, WalletCheckupPreference>;

function readAll(storage: Pick<Storage, "getItem"> | null | undefined): WalletCheckupPreferenceMap {
  const raw = storage?.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as WalletCheckupPreferenceMap;
  } catch {
    return {};
  }
}

function writeAll(storage: Pick<Storage, "setItem"> | null | undefined, value: WalletCheckupPreferenceMap) {
  storage?.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function readWalletCheckupPreference(
  storage: Pick<Storage, "getItem"> | null | undefined,
  address: string
): WalletCheckupPreference {
  const normalized = normalizeTrackedAddress(address);
  return readAll(storage)[normalized] ?? {};
}

export function markWalletCheckupSeen(
  storage: Pick<Storage, "getItem" | "setItem"> | null | undefined,
  address: string
) {
  const normalized = normalizeTrackedAddress(address);
  const all = readAll(storage);
  all[normalized] = {
    ...all[normalized],
    seenAt: all[normalized]?.seenAt ?? new Date().toISOString(),
  };
  writeAll(storage, all);
}

export function dismissWalletCheckup(
  storage: Pick<Storage, "getItem" | "setItem"> | null | undefined,
  address: string
) {
  const normalized = normalizeTrackedAddress(address);
  const all = readAll(storage);
  all[normalized] = {
    ...all[normalized],
    seenAt: all[normalized]?.seenAt ?? new Date().toISOString(),
    dismissedAt: new Date().toISOString(),
  };
  writeAll(storage, all);
}

export function resetWalletCheckupDismissed(
  storage: Pick<Storage, "getItem" | "setItem"> | null | undefined,
  address: string
) {
  const normalized = normalizeTrackedAddress(address);
  const all = readAll(storage);
  all[normalized] = {
    ...all[normalized],
    seenAt: all[normalized]?.seenAt ?? new Date().toISOString(),
    dismissedAt: undefined,
  };
  writeAll(storage, all);
}
