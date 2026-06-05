"use client";

import { useEffect, useRef, useState } from "react";

const HL_WS_URL = "wss://api.hyperliquid.xyz/ws";
const FLUSH_INTERVAL_MS = 1000;
const RECONNECT_DELAY_MS = 4000;

/**
 * Live mid prices streamed from Hyperliquid's public websocket (free, no key).
 * Browser-only. Covers Hyperliquid-listed assets keyed by coin name (BTC, ETH,
 * SOL, HYPE, …). Updates are throttled to ~1/sec so the UI doesn't thrash, and
 * the socket auto-reconnects. Returns a coin→USD-price map.
 *
 * Note: a persistent socket only lives in the browser — never on the (serverless)
 * server — so this is a client hook by design.
 */
export function useLiveMids(): { mids: Record<string, number>; connected: boolean } {
  const [mids, setMids] = useState<Record<string, number>>({});
  const [connected, setConnected] = useState(false);
  const pending = useRef<Record<string, number>>({});
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof WebSocket === "undefined") return;

    let closedByUs = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      let ws: WebSocket;
      try {
        ws = new WebSocket(HL_WS_URL);
      } catch {
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ method: "subscribe", subscription: { type: "allMids" } }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { channel?: string; data?: { mids?: Record<string, string> } };
          if (msg.channel !== "allMids" || !msg.data?.mids) return;
          for (const [coin, raw] of Object.entries(msg.data.mids)) {
            if (coin.startsWith("@")) continue; // skip spot-pair index keys
            const price = Number(raw);
            if (Number.isFinite(price) && price > 0) pending.current[coin] = price;
          }
        } catch {
          /* ignore malformed frame */
        }
      };

      ws.onerror = () => {
        try { ws.close(); } catch { /* noop */ }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!closedByUs) scheduleReconnect();
      };
    }

    function scheduleReconnect() {
      if (reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, RECONNECT_DELAY_MS);
    }

    connect();

    // Flush buffered mids into React state at most once per second.
    const flushTimer = setInterval(() => {
      if (Object.keys(pending.current).length === 0) return;
      setMids((prev) => ({ ...prev, ...pending.current }));
      pending.current = {};
    }, FLUSH_INTERVAL_MS);

    return () => {
      closedByUs = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(flushTimer);
      try { wsRef.current?.close(); } catch { /* noop */ }
    };
  }, []);

  return { mids, connected };
}
