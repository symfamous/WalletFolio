import { AI_PROVIDERS, type AIProviderId } from "./providers";

export interface AIConfig {
  provider: AIProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
}

const STORAGE_KEY = "walletfolio-ai-config";

export function defaultConfigFor(provider: AIProviderId): AIConfig {
  const def = AI_PROVIDERS[provider];
  return { provider, apiKey: "", baseUrl: def.baseUrl, model: def.defaultModel };
}

export function loadAIConfig(): AIConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AIConfig>;
    if (!parsed.provider || !AI_PROVIDERS[parsed.provider]) return null;
    const base = defaultConfigFor(parsed.provider);
    return {
      provider: parsed.provider,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      baseUrl: typeof parsed.baseUrl === "string" && parsed.baseUrl ? parsed.baseUrl : base.baseUrl,
      model: typeof parsed.model === "string" && parsed.model ? parsed.model : base.model,
    };
  } catch {
    return null;
  }
}

export function saveAIConfig(config: AIConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function isConfigured(config: AIConfig | null): config is AIConfig {
  if (!config) return false;
  const def = AI_PROVIDERS[config.provider];
  return Boolean(config.model && config.baseUrl && (config.apiKey || def?.keyless));
}
