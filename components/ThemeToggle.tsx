"use client";

import { useTheme } from "@/components/ThemeProvider";
import { Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={
        `relative inline-flex h-9 w-9 items-center justify-center rounded-lg ` +
        `border border-border bg-surface text-text-mid ` +
        `transition-colors hover:border-accent hover:text-accent ` +
        className
      }
    >
      <motion.div
        key={resolvedTheme}
        initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
        animate={{ rotate: 0, scale: 1, opacity: 1 }}
        exit={{ rotate: 90, scale: 0.5, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {resolvedTheme === "dark" ? (
          <Sun className="h-[18px] w-[18px]" />
        ) : (
          <Moon className="h-[18px] w-[18px]" />
        )}
      </motion.div>
    </button>
  );
}
