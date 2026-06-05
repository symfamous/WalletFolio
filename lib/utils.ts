import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUSD(
  value: number,
  opts: { compact?: boolean; decimals?: number } = {}
): string {
  if (!isFinite(value)) return "$0.00";
  const { compact = false } = opts;

  if (compact) {
    if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(value) >= 1_000_000)     return `$${(value / 1_000_000).toFixed(2)}M`;
    if (Math.abs(value) >= 1_000)         return `$${(value / 1_000).toFixed(2)}K`;
  }

  return new Intl.NumberFormat("en-US", {
    style:                 "currency",
    currency:              "USD",
    minimumFractionDigits: value < 1 && value > 0 ? 4 : 2,
    maximumFractionDigits: value < 1 && value > 0 ? 6 : 2,
  }).format(value);
}

export function formatPrice(price: number): string {
  if (!isFinite(price) || price === 0) return "$0";
  if (price < 0.000001) return `$${price.toExponential(3)}`;
  if (price < 0.001)    return `$${price.toFixed(8)}`;
  if (price < 0.01)     return `$${price.toFixed(6)}`;
  if (price < 0.1)      return `$${price.toFixed(5)}`;
  if (price < 1)        return `$${price.toFixed(4)}`;
  if (price < 100)      return `$${price.toFixed(3)}`;
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(price);
}

export function formatBalance(amount: number): string {
  if (!isFinite(amount) || amount === 0) return "0";
  if (amount < 0.000001) return "< 0.000001";
  if (amount < 0.001)    return amount.toFixed(8);
  if (amount < 1)        return amount.toFixed(6);
  if (amount < 1_000)    return amount.toFixed(4);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: amount < 100_000 ? 4 : 2,
  }).format(amount);
}

export function formatPct(value: number, decimals = 2): string {
  if (!isFinite(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address || address.length < 10) return address;
  // EVM: "0x1234…abcd"  |  Solana: "AbCd1234…XyZ9"
  const prefix = address.startsWith("0x") ? chars + 2 : chars;
  return `${address.slice(0, prefix)}…${address.slice(-chars)}`;
}

/** EVM: 0x + 40 hex chars */
export function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/** Solana: base58, 32–44 chars */
export function isSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/** Returns "evm" | "solana" | null */
export function detectChain(address: string): "evm" | "solana" | null {
  if (isValidAddress(address)) return "evm";
  if (isSolanaAddress(address)) return "solana";
  return null;
}

/** Preserve case for Solana base58, lowercase EVM */
export function normalizeTrackedAddress(address: string): string {
  const trimmed = address.trim();
  return (isSolanaAddress(trimmed) && !trimmed.startsWith("0x"))
    ? trimmed
    : trimmed.toLowerCase();
}

/** Address equality with Solana case-sensitivity respected */
export function sameTrackedAddress(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return normalizeTrackedAddress(a) === normalizeTrackedAddress(b);
}

export function validateAddress(input: string): string | null {
  const t = input.trim();
  if (!t) return "Please enter a wallet address.";
  // EVM
  if (t.startsWith("0x")) {
    if (t.length !== 42)      return "Address must be 42 characters (0x + 40 hex).";
    if (!isValidAddress(t))   return "Address contains invalid characters.";
    return null;
  }
  // Solana
  if (isSolanaAddress(t)) return null;
  return "Invalid address. Enter an EVM (0x…) or Solana (base58) address.";
}

export function parseTokenAmount(raw: string, decimals: number): number {
  try {
    const bigVal  = BigInt(raw);
    const divisor = BigInt(10) ** BigInt(Math.min(decimals, 18));
    return Number(bigVal / divisor) + Number(bigVal % divisor) / Number(divisor);
  } catch {
    return 0;
  }
}

export function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
