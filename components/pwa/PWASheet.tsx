"use client";
import { type LucideIcon } from "lucide-react";

import type { ReactNode } from "react";
import { X } from "lucide-react";

interface PWASheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  children: ReactNode;
}

export function PWASheet({ open, onClose, title, subtitle, icon: Icon, children }: PWASheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-bg/75 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close panel"
      />

      <div
        className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-[28px] border border-border bg-bg shadow-2xl"
        style={{ top: "calc(3rem + env(safe-area-inset-top, 0px))", boxShadow: "0 -24px 80px rgba(0,0,0,0.45)" }}
      >
        <div className="sticky top-0 z-10 border-b border-border/60 bg-bg/95 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-text-hi/10" />
          <div className="flex items-start gap-3">
            {Icon && (
              <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent">
                <Icon className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text-hi">{title}</p>
              {subtitle && <p className="text-xs text-text-mid mt-0.5">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-surface-raised p-2 text-text-lo transition-colors hover:text-text-hi"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 pt-4"
          style={{ paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}