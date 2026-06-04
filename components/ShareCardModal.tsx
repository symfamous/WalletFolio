"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Copy, Download, X } from "lucide-react";

interface ShareCardModalProps {
  open: boolean;
  onClose: () => void;
  name: string;
  totalUsd: number;
  change24h?: number;
  topAssets: string[];
}

/**
 * Mood character driven by the 24h change. Drop your own art at the `src` paths
 * (e.g. public/mood/happy-panda.png) and it's used automatically; otherwise the
 * emoji fallback renders.
 */
function mood(change: number | undefined): { src: string; emoji: string; label: string; up: boolean } {
  const c = change ?? 0;
  if (c >= 10) return { src: "/mood/happy-panda.png", emoji: "🐼", label: "Euphoric", up: true };
  if (c >= 0) return { src: "/mood/happy-panda.png", emoji: "🐼", label: "Up only", up: true };
  if (c > -5) return { src: "/mood/sad-cat.png", emoji: "😿", label: "Down bad", up: false };
  return { src: "/mood/sad-cat.png", emoji: "🙀", label: "Shook", up: false };
}

export function ShareCardModal({ open, onClose, name, totalUsd, change24h, topAssets }: ShareCardModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imgError, setImgError] = useState(false);

  const m = mood(change24h);
  // Reset the image-error fallback whenever the chosen art changes.
  useEffect(() => setImgError(false), [m.src]);

  if (!open) return null;

  const accent = m.up ? "#4cc38a" : "#f2566a";
  const glow = m.up ? "rgba(76,195,138,0.20)" : "rgba(242,86,106,0.18)";
  const valueStr = `$${totalUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const changeStr = change24h !== undefined ? `${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}%` : "";

  async function saveImage() {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `walletfolio-${name.replace(/[^a-z0-9]/gi, "")}.png`;
      a.click();
    } catch (e) {
      console.warn("[share] save failed", e);
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(typeof window !== "undefined" ? window.location.origin : "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  function shareX() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const text = `My multi-chain portfolio: ${valueStr}${changeStr ? ` (${changeStr} 24h)` : ""} — tracked on walletfolio`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(origin)}`,
      "_blank",
      "noopener"
    );
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-[16px] border border-border bg-surface p-5 shadow-popover"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-text-hi">Share your portfolio</p>
          <button type="button" onClick={onClose} className="text-text-lo transition-colors hover:text-text-hi">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* The exported card */}
        <div
          ref={cardRef}
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: "18px",
            padding: "26px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            minHeight: "230px",
            background: `radial-gradient(120% 130% at 100% 10%, ${glow} 0%, transparent 50%), linear-gradient(160deg, #101113 0%, #08090a 100%)`,
            border: "1px solid #28282c",
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "18px" }}>
              <div style={{ width: "22px", height: "22px", borderRadius: "7px", background: "#828fff" }} />
              <span style={{ color: "#f7f8f8", fontSize: "17px", fontWeight: 700 }}>walletfolio</span>
            </div>

            <div style={{ color: "#8a8f98", fontSize: "13px" }}>{name}</div>
            <div style={{ color: "#f7f8f8", fontSize: "40px", fontWeight: 700, lineHeight: 1.1 }}>{valueStr}</div>
            {changeStr ? (
              <div style={{ color: accent, fontSize: "20px", fontWeight: 600, marginTop: "2px", display: "flex" }}>
                {`${changeStr} · 24h · ${m.label}`}
              </div>
            ) : null}

            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "16px" }}>
              {topAssets.slice(0, 5).map((a) => (
                <span
                  key={a}
                  style={{ color: "#d0d6e0", fontSize: "11px", border: "1px solid #28282c", borderRadius: "999px", padding: "3px 9px" }}
                >
                  {a}
                </span>
              ))}
            </div>
          </div>

          {/* Mood character — custom art if present, else emoji */}
          <div style={{ width: "150px", height: "150px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {!imgError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.src}
                alt={m.label}
                width={150}
                height={150}
                onError={() => setImgError(true)}
                style={{ width: "150px", height: "150px", objectFit: "contain" }}
              />
            ) : (
              <span style={{ fontSize: "108px", lineHeight: 1 }}>{m.emoji}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={saveImage}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-accent px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            <Download className="h-4 w-4" /> {busy ? "Saving…" : "Save Image"}
          </button>
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-border bg-surface-raised px-3 py-2.5 text-sm text-text-hi transition-colors hover:border-border-strong"
          >
            <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy Link"}
          </button>
          <button
            type="button"
            onClick={shareX}
            className="inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-border bg-surface-raised px-3 py-2.5 text-sm text-text-hi transition-colors hover:border-border-strong"
          >
            𝕏 Share
          </button>
        </div>
      </div>
    </div>
  );
}
