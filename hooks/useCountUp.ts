"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 (or previous value) to `target` over `duration`ms.
 * Returns the current display value.
 */
export function useCountUp(target: number | undefined, duration = 600): number {
  const [display, setDisplay] = useState(0);
  const frameRef  = useRef<number | null>(null);
  const startRef  = useRef<number | null>(null);
  const fromRef   = useRef(0);

  useEffect(() => {
    if (target === undefined || target === 0) {
      setDisplay(0);
      return;
    }

    const from = fromRef.current;
    const to   = target;
    startRef.current = null;

    function step(timestamp: number) {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed  = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased    = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
        setDisplay(to);
      }
    }

    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration]);

  return display;
}