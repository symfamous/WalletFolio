"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  id: string;               // for localStorage key
  icon: LucideIcon;
  title: string;
  summary?: string;         // compact summary shown when collapsed
  badge?: string;           // e.g. "3 warnings" badge
  badgeVariant?: "neutral" | "accent" | "warning" | "danger" | "success";
  defaultCollapsed?: boolean;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  className?: string;
}

const BADGE_STYLES: Record<string, string> = {
  neutral: "text-text-lo  border-border      bg-surface-raised",
  accent:  "text-accent   border-accent/25   bg-accent/8",
  warning: "text-warning  border-warning/25  bg-warning/8",
  danger:  "text-danger   border-danger/25   bg-danger/8",
  success: "text-success  border-success/25  bg-success/8",
};

export function CollapsibleSection({
  id,
  icon: Icon,
  title,
  summary,
  badge,
  badgeVariant = "neutral",
  defaultCollapsed = false,
  children,
  headerRight,
  className,
}: CollapsibleSectionProps) {
  const storageKey = `pseryte_collapsed_${id}`;
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const contentRef = useRef<HTMLDivElement>(null);

  // Load persisted state
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) setCollapsed(saved === "1");
  }, [storageKey]);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem(storageKey, next ? "1" : "0");
      }
      return next;
    });
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Section header — always visible */}
      {/* Use div+role=button so nested buttons are valid HTML */}
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => e.key === "Enter" && toggle()}
        className="w-full flex items-center gap-2.5 py-0.5 text-left group cursor-pointer"
      >
        <Icon className="h-4 w-4 text-accent flex-shrink-0" strokeWidth={1.5} />
        <h2 className="text-sm font-semibold text-text-hi">{title}</h2>

        {badge && (
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full border font-medium",
            BADGE_STYLES[badgeVariant]
          )}>
            {badge}
          </span>
        )}

        {/* Summary shown only when collapsed */}
        {collapsed && summary && (
          <span className="text-xs text-text-lo truncate ml-1">{summary}</span>
        )}

        {/* Right slot */}
        {headerRight && !collapsed && (
          <div className="ml-auto" onClick={(e) => e.stopPropagation()}>
            {headerRight}
          </div>
        )}

        {/* Collapse toggle */}
        <span className={cn(
          "ml-auto flex items-center gap-1 text-xs text-text-lo group-hover:text-text-mid transition-colors",
          headerRight && !collapsed && "ml-2"
        )}>
          {collapsed
            ? <><ChevronDown className="h-3.5 w-3.5" /></>
            : <><ChevronUp className="h-3.5 w-3.5" /></>}
        </span>
      </div>

      {/* Collapsible content */}
      {!collapsed && (
        <div ref={contentRef} className="animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}