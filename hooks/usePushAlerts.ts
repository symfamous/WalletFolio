"use client";

import { useCallback, useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

interface PushState {
  supported: boolean;
  configured: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  busy: boolean;
  error: string | null;
}

export function usePushAlerts(address: string) {
  const [state, setState] = useState<PushState>({
    supported: false,
    configured: false,
    permission: "unsupported",
    subscribed: false,
    busy: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const supported =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      if (!supported) {
        if (!cancelled) setState((s) => ({ ...s, supported: false }));
        return;
      }
      let configured = false;
      try {
        const res = await fetch("/api/push/vapid", { cache: "no-store" });
        configured = res.ok ? Boolean((await res.json()).configured) : false;
      } catch {
        configured = false;
      }
      let subscribed = false;
      try {
        const reg = await navigator.serviceWorker.ready;
        subscribed = Boolean(await reg.pushManager.getSubscription());
      } catch {
        subscribed = false;
      }
      if (!cancelled) {
        setState((s) => ({ ...s, supported: true, configured, subscribed, permission: Notification.permission }));
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const subscribe = useCallback(async () => {
    setState((s) => ({ ...s, busy: true, error: null }));
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState((s) => ({ ...s, busy: false, permission, error: "Notifications permission was not granted." }));
        return;
      }
      const vapidRes = await fetch("/api/push/vapid", { cache: "no-store" });
      const { publicKey, configured } = (await vapidRes.json()) as { publicKey: string | null; configured: boolean };
      if (!configured || !publicKey) throw new Error("Push is not configured on the server yet.");

      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        }));

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), address }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Subscribe failed.");

      setState((s) => ({ ...s, busy: false, subscribed: true, permission }));
    } catch (e) {
      setState((s) => ({ ...s, busy: false, error: e instanceof Error ? e.message : "Subscribe failed." }));
    }
  }, [address]);

  const unsubscribe = useCallback(async () => {
    setState((s) => ({ ...s, busy: true, error: null }));
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setState((s) => ({ ...s, busy: false, subscribed: false }));
    } catch (e) {
      setState((s) => ({ ...s, busy: false, error: e instanceof Error ? e.message : "Unsubscribe failed." }));
    }
  }, []);

  return { ...state, subscribe, unsubscribe };
}
