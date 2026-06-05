"use client";

import { Bell, BellOff, Loader2 } from "lucide-react";
import { usePushAlerts } from "@/hooks/usePushAlerts";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";

/**
 * Web Push opt-in. Subscribes the device so portfolio-move alerts arrive as OS
 * notifications even when the app is closed (server sends them via the cron).
 */
export function PushAlertsToggle({ address }: { address: string }) {
  const push = usePushAlerts(address);

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {push.subscribed ? <Bell className="h-4 w-4 text-accent" /> : <BellOff className="h-4 w-4 text-text-lo" />}
          <div>
            <h2 className="text-sm font-semibold text-text-hi">Push alerts</h2>
            <p className="text-[11px] text-text-lo">Get notified of big 24h portfolio moves — even when closed.</p>
          </div>
        </div>
        {push.subscribed ? (
          <button
            type="button"
            onClick={push.unsubscribe}
            disabled={push.busy}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface-raised px-3 py-2 text-xs text-text-hi transition-colors hover:border-border-strong disabled:opacity-50"
          >
            {push.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellOff className="h-3.5 w-3.5" />} Turn off
          </button>
        ) : (
          <button
            type="button"
            onClick={push.subscribe}
            disabled={push.busy || !push.supported || !push.configured}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50",
              "bg-accent text-white hover:bg-accent-hover"
            )}
          >
            {push.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />} Enable
          </button>
        )}
      </div>

      {!push.supported ? (
        <p className="text-[11px] text-text-lo">This browser doesn’t support push notifications. On iOS, install the app to your Home Screen first.</p>
      ) : !push.configured ? (
        <p className="text-[11px] text-warning/80">Push isn’t configured on the server yet (Upstash + VAPID env vars).</p>
      ) : push.subscribed ? (
        <p className="text-[11px] text-success/80">Alerts are on for this device.</p>
      ) : null}

      {push.error ? <p className="text-[11px] text-danger">{push.error}</p> : null}
    </Card>
  );
}
