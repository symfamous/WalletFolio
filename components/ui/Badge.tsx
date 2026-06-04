import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "success" | "danger" | "warning" | "accent" | "chain";
  /** For chain variant — custom fg/bg colors */
  color?: string;
  className?: string;
}

/**
 * Linear-style chip: rounded-full, hairline border, low-alpha tint per variant.
 */
export function Badge({
  children,
  variant = "default",
  color,
  className,
}: BadgeProps) {
  const base =
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none";

  const variants = {
    default: "border-border bg-surface-raised text-text-lo",
    accent: "border-accent/30 bg-accent/10 text-accent",
    success: "border-success/30 bg-success/10 text-success",
    danger: "border-danger/30 bg-danger/10 text-danger",
    warning: "border-warning/30 bg-warning/10 text-warning",
    chain: "",
  };

  if (variant === "chain" && color) {
    return (
      <span
        className={cn(base, className)}
        style={{
          color,
          borderColor: `${color}40`,
          backgroundColor: `${color}14`,
        }}
      >
        {children}
      </span>
    );
  }

  return (
    <span className={cn(base, variants[variant], className)}>{children}</span>
  );
}
