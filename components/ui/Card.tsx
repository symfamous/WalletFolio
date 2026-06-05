import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Subtle border-strong highlight on hover */
  hoverable?: boolean;
  /** Indigo-tinted accent border for emphasis */
  accent?: boolean;
  /** Remove default padding */
  noPadding?: boolean;
}

/**
 * Linear-style card: flat surface, 1px hairline border, 12px radius, soft shadow.
 * No backdrop-blur, no gradient shine, no glow — depth comes from the border + shadow tokens.
 */
export function Card({
  children,
  className,
  hoverable = false,
  accent = false,
  noPadding = false,
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[12px] border bg-surface shadow-card",
        !noPadding && "p-4",
        accent ? "border-accent/40" : "border-border",
        hoverable && "transition-colors duration-150 hover:border-border-strong",
        className
      )}
    >
      {children}
    </div>
  );
}
