/**
 * lib/ai/providers.ts — shared AI provider catalog (client + server).
 *
 * Bring-your-own-key: the user picks a provider and supplies their own API key
 * (stored in their browser). Requests are proxied through /api/ai/chat so they
 * work regardless of provider CORS, and the key is passed per-request — never
 * persisted on the server.
 */

export type AIProviderId = "openai" | "anthropic" | "openrouter" | "minimax" | "ollama" | "custom";
export type AIFormat = "openai" | "anthropic";

export interface AIProviderDef {
  id: AIProviderId;
  label: string;
  /** Wire format: OpenAI-style /chat/completions or Anthropic /v1/messages. */
  format: AIFormat;
  /** Default API base URL (no trailing slash). */
  baseUrl: string;
  defaultModel: string;
  /** Ollama/local needs no key. */
  keyless?: boolean;
  hint?: string;
}

export const AI_PROVIDERS: Record<AIProviderId, AIProviderDef> = {
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    format: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
    hint: "One key, hundreds of models. Get a key at openrouter.ai/keys.",
  },
  openai: {
    id: "openai",
    label: "OpenAI (ChatGPT)",
    format: "openai",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    hint: "Get a key at platform.openai.com/api-keys.",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic (Claude)",
    format: "anthropic",
    baseUrl: "https://api.anthropic.com",
    defaultModel: "claude-haiku-4-5-20251001",
    hint: "Get a key at console.anthropic.com.",
  },
  minimax: {
    id: "minimax",
    label: "MiniMax",
    format: "openai",
    baseUrl: "https://api.minimax.io/v1",
    defaultModel: "MiniMax-Text-01",
    hint: "OpenAI-compatible endpoint. Adjust the base URL if your region differs.",
  },
  ollama: {
    id: "ollama",
    label: "Ollama (local)",
    format: "openai",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.1",
    keyless: true,
    hint: "Runs locally. The server must be able to reach this URL (works in local dev / self-host).",
  },
  custom: {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    format: "openai",
    baseUrl: "",
    defaultModel: "",
    hint: "Any OpenAI-compatible endpoint — set base URL + model.",
  },
};

export const AI_PROVIDER_ORDER: AIProviderId[] = [
  "openrouter", "openai", "anthropic", "minimax", "ollama", "custom",
];

export interface AIChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIChatRequest {
  provider: AIProviderId;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  system?: string;
  messages: AIChatMessage[];
}
