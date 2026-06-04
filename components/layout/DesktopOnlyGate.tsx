"use client";

import { useEffect, useState } from "react";
import { Monitor } from "lucide-react";

const MIN_WIDTH = 1024;

/**
 * Desktop-only contract. WalletFolio is a dense, multi-pane workspace tuned for
 * large screens. Below {@link MIN_WIDTH}px we render a calm notice instead of a
 * cramped, half-broken layout. (No PWA / mobile app for now.)
 */
export function DesktopOnlyGate({ children }: { children: React.ReactNode }) {
  const [wide, setWide] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia(`(min-width: ${MIN_WIDTH}px)`);
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Avoid a hydration flash: assume wide on the server, reconcile after mount.
  if (mounted && !wide) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-6">
        <div className="w-full max-w-sm rounded-[12px] border border-border bg-surface p-8 text-center shadow-card">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] border border-border bg-surface-raised text-accent">
            <Monitor className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <h1 className="mt-5 text-base font-semibold text-text-hi">Best on desktop</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-lo">
            WalletFolio is a dense portfolio workspace built for larger screens.
            Open it on a desktop or widen your window to at least {MIN_WIDTH}px.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
