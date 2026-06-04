import type { PortfolioApiResponse } from "@/types";

export interface ProviderBannerState {
  tone: "info" | "warning" | "error";
  title: string;
  message: string;
  repeatKey?: string;
}

export function getProviderBannerState(
  status: PortfolioApiResponse["providerStatus"] | undefined,
  options?: {
    errorMessage?: string | null;
    hasRenderablePortfolio?: boolean;
  }
): ProviderBannerState | null {
  if (!status) return null;

  if (status.mobula === "error" && status.solanaRpc === "ok") {
    return {
      tone: "warning",
      title: "Using Solana fallback providers",
      message:
        "Mobula is unavailable for this refresh, so Solana staking and supported protocol positions are being served from the direct on-chain fallback adapters.",
    };
  }

  if (status.fallbackUsed && status.fallbackSource && options?.hasRenderablePortfolio) {
    const sourceLabel = status.fallbackSource === "zapper"
      ? "Zapper"
      : status.fallbackSource === "moralis"
        ? "Moralis"
        : "Covalent";

    if (status.fallbackCoverage === "good") {
      return {
        tone: "info",
        title: "Using backup data source",
        message: `${sourceLabel} is serving portfolio data for this refresh while Zerion is temporarily unavailable.`,
        repeatKey: `portfolio-fallback-${status.fallbackSource}-good`,
      };
    }

    return {
      tone: "warning",
      title: "Using backup data source",
      message: `${sourceLabel} is serving portfolio data for this refresh, but coverage or freshness may be limited until Zerion recovers.`,
      repeatKey: `portfolio-fallback-${status.fallbackSource}-${status.fallbackCoverage ?? "partial"}`,
    };
  }

  if (status.zerion === "error") {
    if (options?.hasRenderablePortfolio) {
      return {
        tone: "warning",
        title: "Showing partial portfolio data",
        message: "Zerion is unavailable for this refresh, but your current wallet balance and available positions are still being shown.",
      };
    }

    const msg = options?.errorMessage ?? status.error ?? "Unknown error";
    const isApiKey = msg.includes("ZERION_API_KEY") || msg.includes("503") || msg.includes("401");
    return {
      tone: "error",
      title: isApiKey ? "API key required" : "Portfolio unavailable",
      message: isApiKey
        ? "Add ZERION_API_KEY to .env.local — get a free key at developers.zerion.io"
        : msg,
    };
  }

  const warnings: string[] = [];
  if (status.zerion === "partial") warnings.push("Some positions may be missing");
  if (status.morpho === "ok") warnings.push("Morpho positions supplemented");
  if (!warnings.length) return null;

  return {
    tone: "warning",
    title: "Limited provider coverage",
    message: warnings.join(" · "),
  };
}
