"use client";

import { useState, useEffect } from "react";

/**
 * Returns true when the app is running as an installed PWA
 * (display-mode: standalone or fullscreen), or on a native wrapper.
 */
export function useStandalone(): boolean {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    // Also check navigator.standalone for older iOS Safari
    const isStandalone =
      mq.matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    setStandalone(isStandalone);

    function onChange(e: MediaQueryListEvent) {
      setStandalone(e.matches);
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return standalone;
}