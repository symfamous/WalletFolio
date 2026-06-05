/**
 * app/api/ai/chat/route.ts
 *
 * Bring-your-own-key AI proxy. Accepts a provider + the user's key + messages,
 * forwards to the right provider (OpenAI-compatible or Anthropic), returns the
 * assistant text. The key is used only for this request and never stored.
 */
import { NextRequest, NextResponse } from "next/server";
import { AI_PROVIDERS, type AIChatRequest } from "@/lib/ai/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 45_000;
const MAX_TOKENS = 1024;

function trimBase(url: string): string {
  return url.replace(/\/+$/, "");
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/** POST with up to 2 retries on transient provider errors (rate limits / 5xx). */
async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let last: Response | null = null;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, init);
    if (res.ok || !RETRYABLE.has(res.status)) return res;
    last = res;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 700 * (i + 1)));
  }
  return last as Response;
}

function friendlyError(label: string, status: number, providerMsg?: string): string {
  if (status === 429) {
    return `${label} is rate-limited (common on free models). Wait a few seconds and retry, or switch model in settings.`;
  }
  return providerMsg || `${label} error (HTTP ${status}).`;
}

export async function POST(req: NextRequest) {
  let body: AIChatRequest;
  try {
    body = (await req.json()) as AIChatRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const def = AI_PROVIDERS[body.provider];
  if (!def) return NextResponse.json({ error: "Unknown AI provider." }, { status: 400 });

  const baseUrl = trimBase(body.baseUrl?.trim() || def.baseUrl);
  const model = body.model?.trim() || def.defaultModel;
  const apiKey = body.apiKey?.trim() ?? "";
  const messages = Array.isArray(body.messages) ? body.messages : [];

  if (!baseUrl) return NextResponse.json({ error: "Missing API base URL." }, { status: 400 });
  if (!model) return NextResponse.json({ error: "Missing model name." }, { status: 400 });
  if (!apiKey && !def.keyless) return NextResponse.json({ error: `Add your ${def.label} API key in Settings.` }, { status: 400 });
  if (messages.length === 0) return NextResponse.json({ error: "No messages provided." }, { status: 400 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    if (def.format === "anthropic") {
      const res = await fetchWithRetry(`${baseUrl}/v1/messages`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_TOKENS,
          system: body.system || undefined,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const json = await res.json().catch(() => null) as { content?: Array<{ text?: string }>; error?: { message?: string } } | null;
      if (!res.ok) {
        return NextResponse.json({ error: friendlyError(def.label, res.status, json?.error?.message) }, { status: 502 });
      }
      const text = (json?.content ?? []).map((c) => c.text ?? "").join("").trim();
      return NextResponse.json({ text: text || "(empty response)" });
    }

    // OpenAI-compatible (OpenAI, OpenRouter, MiniMax, Ollama, custom)
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    if (body.provider === "openrouter") {
      headers["HTTP-Referer"] = "https://walletfolio.app";
      headers["X-Title"] = "WalletFolio";
    }

    const chatMessages = body.system
      ? [{ role: "system", content: body.system }, ...messages]
      : messages;

    const res = await fetchWithRetry(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify({ model, messages: chatMessages, temperature: 0.4, max_tokens: MAX_TOKENS }),
    });
    const json = await res.json().catch(() => null) as
      | { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } }
      | null;
    if (!res.ok) {
      return NextResponse.json({ error: friendlyError(def.label, res.status, json?.error?.message) }, { status: 502 });
    }
    const text = (json?.choices?.[0]?.message?.content ?? "").trim();
    return NextResponse.json({ text: text || "(empty response)" });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      { error: aborted ? "The model took too long to respond." : "Could not reach the AI provider." },
      { status: 504 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
