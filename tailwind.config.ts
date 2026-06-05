// Force tailwind rebuild cache v6
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-geist-sans)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "var(--font-geist-mono)",
          "ui-monospace",
          "monospace",
        ],
        display: [
          "var(--font-geist-sans)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        label: [
          "var(--font-geist-sans)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },

      colors: {
        /* ─── Semantic theme aliases (keep existing) ─── */
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-raised": "rgb(var(--surface-raised) / <alpha-value>)",
        "surface-overlay": "rgb(var(--surface-overlay) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        "border-subtle": "rgb(var(--border-subtle) / <alpha-value>)",
        "border-strong": "rgb(var(--border-strong) / <alpha-value>)",
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          hover: "rgb(var(--accent-hover) / <alpha-value>)",
          subtle: "rgb(var(--accent) / 0.08)",
          muted: "rgb(var(--accent) / 0.15)",
          glow: "rgb(var(--accent) / 0.30)",
        },
        success: {
          DEFAULT: "rgb(var(--success) / <alpha-value>)",
          subtle: "rgb(var(--success) / 0.10)",
          muted: "rgb(var(--success) / 0.20)",
        },
        danger: {
          DEFAULT: "rgb(var(--danger) / <alpha-value>)",
          subtle: "rgb(var(--danger) / 0.10)",
          muted: "rgb(var(--danger) / 0.20)",
        },
        warning: {
          DEFAULT: "rgb(var(--warning) / <alpha-value>)",
          subtle: "rgb(var(--warning) / 0.10)",
        },
        "text-hi": "rgb(var(--text-hi) / <alpha-value>)",
        "text-mid": "rgb(var(--text-mid) / <alpha-value>)",
        "text-lo": "rgb(var(--text-lo) / <alpha-value>)",
        "text-link": "rgb(var(--accent) / <alpha-value>)",
      },

      backgroundImage: {
        "grid-pattern":
          "linear-gradient(rgb(var(--text-lo) / 0.025) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--text-lo) / 0.025) 1px, transparent 1px)",
        "dot-pattern":
          "radial-gradient(circle, rgb(var(--text-lo) / 0.06) 1px, transparent 1px)",
        "card-shine":
          "linear-gradient(135deg, rgb(var(--text-lo) / 0.04) 0%, transparent 60%)",
        "accent-gradient":
          "linear-gradient(135deg, rgb(var(--accent)) 0%, rgb(var(--accent) / 0.75) 100%)",
        "shimmer-gradient":
          "linear-gradient(90deg, transparent 0%, rgb(var(--accent) / 0.04) 50%, transparent 100%)",
      },

      backgroundSize: {
        "grid-size": "24px 24px",
        "dot-size": "20px 20px",
      },

      boxShadow: {
        /* Linear elevation scale — hairline borders + soft shadow, no glow */
        card: "0 0 0 1px rgb(var(--border)), 0 1px 2px rgba(0,0,0,0.5)",
        "card-hover": "0 0 0 1px rgb(var(--border-strong)), 0 4px 12px rgba(0,0,0,0.4)",
        popover: "0 0 0 1px rgb(var(--border)), 0 8px 24px rgba(0,0,0,0.5)",
        accent: "0 0 0 1px rgb(var(--accent) / 0.4)",
        "inner-top": "inset 0 1px 0 rgb(var(--text-hi) / 0.04)",
      },

      animation: {
        "fade-in": "fadeIn 0.35s ease-out both",
        "fade-up": "fadeUp 0.4s ease-out both",
        "fade-right": "fadeRight 0.35s ease-out both",
        shimmer: "shimmer 1.8s ease-in-out infinite",
        "spin-slow": "spin 3s linear infinite",
        "pulse-dot": "pulseDot 2s ease-in-out infinite",
      },

      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeRight: {
          from: { opacity: "0", transform: "translateX(-10px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(0.85)" },
        },
      },

      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
