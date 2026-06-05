"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, Send, Settings2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { AI_PROVIDERS, AI_PROVIDER_ORDER, type AIChatMessage, type AIProviderId } from "@/lib/ai/providers";
import { defaultConfigFor, isConfigured, loadAIConfig, saveAIConfig, type AIConfig } from "@/lib/ai/config";
import { buildPortfolioContext } from "@/lib/ai/context";
import type { PerpsApiResponse, Portfolio, PortfolioIntelligence } from "@/types";

const SUGGESTIONS = [
  "Summarize my portfolio in 3 bullpoints.",
  "What's my biggest risk right now?",
  "Which holdings dragged me down in the last 24h?",
  "How concentrated am I across chains?",
];

export function AIAssistant({
  portfolio,
  perps,
  intelligence,
}: {
  portfolio: Portfolio;
  perps?: PerpsApiResponse | null;
  intelligence?: PortfolioIntelligence | null;
}) {
  const [config, setConfig] = useState<AIConfig>(() => defaultConfigFor("openrouter"));
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loaded = loadAIConfig();
    if (loaded) setConfig(loaded);
    else setShowSettings(true);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const ready = isConfigured(config);
  const system = useMemo(
    () => buildPortfolioContext(portfolio, perps, intelligence),
    [portfolio, perps, intelligence]
  );

  function changeProvider(id: AIProviderId) {
    setConfig((prev) => ({ ...defaultConfigFor(id), apiKey: prev.provider === id ? prev.apiKey : "" }));
  }

  function persist() {
    saveAIConfig(config);
    setShowSettings(false);
    setError(null);
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    if (!ready) { setShowSettings(true); return; }

    const next: AIChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: config.provider,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
          system,
          messages: next.slice(-10),
        }),
      });
      const json = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      setMessages((prev) => [...prev, { role: "assistant", content: json.text ?? "(empty)" }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  const def = AI_PROVIDERS[config.provider];

  return (
    <Card noPadding className="flex h-[520px] flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-accent" strokeWidth={1.6} />
          <div>
            <h2 className="text-sm font-semibold text-text-hi">AI Assistant</h2>
            <p className="text-[11px] text-text-lo">{ready ? `${def.label} · ${config.model}` : "Add a model to start"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowSettings((v) => !v)}
          className="rounded-lg border border-border p-2 text-text-mid transition-colors hover:text-accent"
          aria-label="AI settings"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Settings */}
      {showSettings ? (
        <div className="space-y-2.5 border-b border-border bg-surface-raised/30 p-4">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-text-lo">Provider</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {AI_PROVIDER_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => changeProvider(id)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-[11px] transition-colors",
                    config.provider === id
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-border bg-surface text-text-mid hover:border-border-strong"
                  )}
                >
                  {AI_PROVIDERS[id].label}
                </button>
              ))}
            </div>
          </div>
          {!def.keyless ? (
            <div>
              <label className="text-[10px] uppercase tracking-wide text-text-lo">API key</label>
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => setConfig((p) => ({ ...p, apiKey: e.target.value }))}
                placeholder={`Your ${def.label} key (stored only in this browser)`}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-hi outline-none placeholder:text-text-lo focus:border-accent/40"
              />
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-text-lo">Model</label>
              <input
                value={config.model}
                onChange={(e) => setConfig((p) => ({ ...p, model: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-hi outline-none focus:border-accent/40"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-text-lo">Base URL</label>
              <input
                value={config.baseUrl}
                onChange={(e) => setConfig((p) => ({ ...p, baseUrl: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-hi outline-none focus:border-accent/40"
              />
            </div>
          </div>
          {def.hint ? <p className="text-[10px] text-text-lo">{def.hint}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowSettings(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-mid">
              Close
            </button>
            <button type="button" onClick={persist} className="rounded-lg border border-accent/25 bg-accent/10 px-3 py-1.5 text-xs text-accent">
              Save
            </button>
          </div>
          <p className="text-[10px] text-text-lo">
            Your key is stored only in this browser and sent per-request to the model — never saved on our servers.
          </p>
        </div>
      ) : null}

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Sparkles className="h-6 w-6 text-accent" />
            <p className="text-xs text-text-mid">Ask anything about your wallet — grounded in your live holdings.</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="rounded-full border border-border bg-surface-raised px-2.5 py-1 text-[11px] text-text-mid transition-colors hover:border-accent/30 hover:text-accent"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed",
                  m.role === "user"
                    ? "bg-accent/15 text-text-hi"
                    : "border border-border bg-surface-raised/50 text-text-mid"
                )}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        {busy ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface-raised/50 px-3 py-2 text-xs text-text-lo">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
            </div>
          </div>
        ) : null}
        {error ? <p className="text-center text-[11px] text-danger">{error}</p> : null}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={ready ? "Ask about your portfolio…" : "Add a model in settings first"}
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-hi outline-none placeholder:text-text-lo focus:border-accent/40"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="inline-flex items-center justify-center rounded-lg bg-accent px-3 py-2 text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
          aria-label="Send"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </Card>
  );
}
