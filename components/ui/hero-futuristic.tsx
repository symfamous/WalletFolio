"use client";

import { ArrowRight } from "lucide-react";
import { WalletFolioMark } from "@/components/brand/WalletFolioBrand";
import { cn } from "@/lib/utils";


export interface HeroFuturisticProps {
  headline?: string;
  subtitle?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  className?: string;
}

export function HeroFuturistic({
  headline = "Turn any wallet into a cleaner intelligence screen.",
  subtitle = "Track holdings, DeFi, perps, and risk without connecting your wallet.",
  ctaLabel = "Track Any Wallet",
  onCtaClick,
  className,
}: HeroFuturisticProps) {
  return (
    <section
      className={cn(
        "h-screen bg-[radial-gradient(circle_at_14%_12%,rgba(0,243,255,0.06),transparent_22%),radial-gradient(circle_at_86%_15%,rgba(0,243,255,0.05),transparent_24%),linear-gradient(180deg,#04060a,#04060a)] px-4 py-3 text-[#dce6ff] sm:px-6 sm:py-4 overflow-hidden",
        className,
      )}
    >
      <div className="pointer-events-none fixed inset-0 opacity-60 [background-image:linear-gradient(rgba(0,243,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,243,255,0.03)_1px,transparent_1px)] [background-size:40px_40px]" />
      <div className="pointer-events-none fixed inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_4px,rgba(0,0,0,0.02)_4px,rgba(0,0,0,0.02)_8px)] opacity-70" />

      <div className="relative z-10 flex h-full max-w-[120rem] flex-col justify-center overflow-hidden rounded-[16px] border border-[rgba(0,243,255,0.16)] bg-[linear-gradient(180deg,rgba(18,19,24,0.92),rgba(18,19,24,0.9))] shadow-[0_20px_60px_rgba(0,0,0,0.38)] sm:rounded-[24px]">
        <div className="flex flex-col h-full p-3 sm:p-4 sm:pt-3">
          {/* Brand header — centered on mobile */}
          <div className="wf-brand mb-2 flex items-center justify-center gap-2 sm:mb-3 sm:justify-start">
            <div className="wf-brand-icon flex h-9 w-9 items-center justify-center rounded-[9px] bg-[rgba(0,243,255,0.08)] border border-[rgba(0,243,255,0.2)] shadow-[0_0_20px_rgba(0,243,255,0.15)] sm:h-11 sm:w-11 sm:rounded-[11px]">
              <WalletFolioMark size={28} />
            </div>
            <div className="text-center sm:text-left">
              <span className="wf-brand-name block text-[20px] font-black tracking-[-0.04em] sm:text-[26px]">walletfolio</span>
              <span className="wf-brand-tag hidden text-[11px] font-mono uppercase tracking-[0.2em] sm:block">Portfolio Tracker</span>
            </div>
          </div>

          <div className="grid flex-1 gap-3 sm:gap-4 lg:grid-cols-[1fr_1fr] lg:items-center">
            {/* Left — hero content */}
            <div className="flex flex-col justify-center rounded-[16px] border border-[rgba(0,243,255,0.16)] bg-[radial-gradient(circle_at_78%_18%,rgba(0,243,255,0.08),transparent_22%),linear-gradient(180deg,rgba(30,31,37,0.95),rgba(18,19,24,0.96))] px-4 py-5 sm:rounded-[22px] sm:px-6 sm:py-6">
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#00f3ff]">Paste. Read. Understand.</div>
              <h1 className="wf-headline mt-3 text-[22px] font-bold leading-[1.05] tracking-[-0.03em] sm:mt-4 sm:text-[30px] lg:text-[38px]">
                {headline}
              </h1>
              <p className="mt-2 max-w-[26rem] font-mono text-[12px] leading-[1.6] text-[#5a78a0] sm:mt-3 sm:text-[13px]">
                {subtitle}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-5">
                <button
                  type="button"
                  onClick={onCtaClick}
                  className="inline-flex h-10 items-center gap-2 rounded-[13px] border border-[rgba(0,243,255,0.28)] bg-[linear-gradient(180deg,rgba(0,243,255,0.2),rgba(0,243,255,0.09))] px-5 text-[12px] font-bold text-[#dce6ff] shadow-[0_0_24px_rgba(0,243,255,0.12)] transition-all hover:border-[rgba(0,243,255,0.45)] hover:bg-[linear-gradient(180deg,rgba(0,243,255,0.26),rgba(0,243,255,0.12))] sm:h-11 sm:rounded-[15px] sm:px-6 sm:text-[13px]"
                >
                  {ctaLabel}
                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
                <button
                  type="button"
                  className="hidden sm:inline-flex h-11 items-center rounded-[15px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.025)] px-6 text-[13px] font-bold text-[#5a78a0]"
                >
                  View Desktop Flow
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-4">
                {["No wallet connect", "Beginner-friendly", "Desktop cockpit"].map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] px-2.5 py-1 font-mono text-[9px] tracking-wide text-[#5a78a0] sm:text-[10px]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Right — BTC orbit visual */}
            <div className="flex flex-col items-center justify-center rounded-[16px] border border-[rgba(0,243,255,0.16)] bg-[linear-gradient(180deg,rgba(30,31,37,0.97),rgba(18,19,24,0.98))] p-3 sm:rounded-[22px] sm:p-4">
              <p className="wf-orbit-label mb-2 text-center text-[11px] font-bold uppercase tracking-[0.12em] sm:mb-3 sm:text-[12px]">Your complete crypto portfolio in one view</p>
              <div className="wf-orbit-panel relative w-full max-w-[420px] overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_center,rgba(0,243,255,0.1),transparent_16%),linear-gradient(180deg,rgba(30,31,37,0.88),rgba(18,19,24,0.94))]">
                <div className="wf-orbit wf-orbit-1" />
                <div className="wf-orbit wf-orbit-2" />
                <div className="wf-orbit wf-orbit-3" />

                {/* Decorative star field — fills empty space */}
                <div className="wf-stars" aria-hidden="true">
                  <span className="wf-star wf-star-1" />
                  <span className="wf-star wf-star-2" />
                  <span className="wf-star wf-star-3" />
                  <span className="wf-star wf-star-4" />
                  <span className="wf-star wf-star-5" />
                  <span className="wf-star wf-star-6" />
                  <span className="wf-star wf-star-7" />
                  <span className="wf-star wf-star-8" />
                </div>

                {/* Single rotating ring — decorative, no tokens inside it */}
                <div className="wf-orbit-ring-main" />

                {/* Token chips — positioned directly around the orbit, outside the ring */}
                <div className="wf-token-chip wf-tc-eth">
                  <img src="/token-ethereum.svg" alt="ETH" />
                </div>
                <div className="wf-token-chip wf-tc-sol">
                  <img src="/token-solana.svg" alt="SOL" />
                </div>
                <div className="wf-token-chip wf-tc-wif">
                  <img src="/token-dogwifhat.svg" alt="WIF" />
                </div>
                <div className="wf-token-chip wf-tc-cake">
                  <img src="/token-pancakeswap.svg" alt="CAKE" />
                </div>
                <div className="wf-token-chip wf-tc-doge">
                  <img src="/token-dogecoin.svg" alt="DOGE" />
                </div>

                <div className="wf-core">
                  <img src="/token-bitcoin.svg" alt="BTC" className="wf-btc-icon" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        /* Brand header — pulsing glow */
        .wf-brand {
          animation: brand-glow 3s ease-in-out infinite;
        }

        .wf-brand-icon {
          box-shadow: 0 0 24px rgba(31, 203, 99, 0.2), 0 0 8px rgba(31, 203, 99, 0.1);
        }

        .wf-brand-name {
          background: linear-gradient(180deg, #ffffff 0%, #dce6ff 50%, #8caad2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-shadow: none;
          filter: drop-shadow(0 0 12px rgba(64, 234, 136, 0.5)) drop-shadow(0 0 24px rgba(64, 234, 136, 0.25));
        }

        .wf-brand-tag {
          color: #00f3ff;
          text-shadow: 0 0 12px rgba(64, 234, 136, 0.5), 0 0 24px rgba(64, 234, 136, 0.2);
          letter-spacing: 0.2em;
        }

        .wf-headline {
          background: linear-gradient(180deg, #ffffff 0%, #8caad2 60%, #5a78a0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 0 10px rgba(64, 234, 136, 0.4)) drop-shadow(0 0 20px rgba(64, 234, 136, 0.2));
        }

        .wf-orbit-label {
          background: linear-gradient(180deg, #ffffff 0%, #8caad2 60%, #5a78a0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 0 8px rgba(64, 234, 136, 0.5)) drop-shadow(0 0 16px rgba(64, 234, 136, 0.25));
        }

        @keyframes brand-glow {
          0%, 100% {
            filter: drop-shadow(0 0 8px rgba(31, 203, 99, 0.3));
          }
          50% {
            filter: drop-shadow(0 0 16px rgba(31, 203, 99, 0.55));
          }
        }

        .wf-orbit-panel {
          --wf-center-y: 50%;
          aspect-ratio: 1;
          max-height: 340px;
        }

        .wf-orbit {
          position: absolute;
          left: 50%;
          top: var(--wf-center-y);
          transform: translate(-50%, -50%);
          border-radius: 999px;
        }

        .wf-orbit-1 {
          width: 160px;
          height: 160px;
          border: 1px solid rgba(31, 203, 99, 0.18);
          box-shadow: inset 0 0 20px rgba(31, 203, 99, 0.04);
        }

        .wf-orbit-2 {
          width: 300px;
          height: 300px;
          border: 1px solid rgba(31, 203, 99, 0.1);
          box-shadow: inset 0 0 40px rgba(31, 203, 99, 0.03);
        }

        .wf-orbit-3 {
          width: 380px;
          height: 380px;
          border: 1px dashed rgba(31, 203, 99, 0.1);
          box-shadow: inset 0 0 50px rgba(31, 203, 99, 0.02);
        }

        /* Star field — subtle glowing dots scattered around */
        .wf-stars {
          position: absolute;
          inset: 0;
          z-index: 3;
          pointer-events: none;
        }

        .wf-star {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 999px;
          background: #00f3ff;
          animation: star-twinkle 3s ease-in-out infinite;
        }

        .wf-star-1 { left: 12%;  top: 20%; animation-delay: 0s;    width: 3px; height: 3px; opacity: 0.3; }
        .wf-star-2 { left: 82%;  top: 15%; animation-delay: 0.5s;  width: 5px; height: 5px; opacity: 0.4; }
        .wf-star-3 { left: 88%;  top: 72%; animation-delay: 1s;    width: 3px; height: 3px; opacity: 0.25; }
        .wf-star-4 { left: 8%;   top: 78%; animation-delay: 1.5s;  width: 4px; height: 4px; opacity: 0.35; }
        .wf-star-5 { left: 50%;  top: 8%;  animation-delay: 0.3s;  width: 3px; height: 3px; opacity: 0.2; }
        .wf-star-6 { left: 22%;  top: 88%; animation-delay: 0.8s;  width: 4px; height: 4px; opacity: 0.3; }
        .wf-star-7 { left: 75%;  top: 90%; animation-delay: 1.2s;  width: 3px; height: 3px; opacity: 0.2; }
        .wf-star-8 { left: 92%;  top: 45%; animation-delay: 0.2s;  width: 4px; height: 4px; opacity: 0.3; }

        @keyframes star-twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(1.3); }
        }

        /* ══════════════════════════════════════════════════
           ORBITING TOKENS — single keyframe, animation-delay spacing
           ══════════════════════════════════════════════════ */

        /* Ring — static visual guide */
        .wf-orbit-ring-main {
          position: absolute;
          left: 50%;
          top: var(--wf-center-y);
          transform: translate(-50%, -50%);
          width: 160px;
          height: 160px;
          border-radius: 999px;
          border: 1px solid rgba(31, 203, 99, 0.2);
          box-shadow: inset 0 0 16px rgba(31, 203, 99, 0.04);
          z-index: 5;
        }

        /* Token chips — all share same orbit keyframe, different delays */
        .wf-token-chip {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 30px;
          height: 30px;
          margin-left: -15px;
          margin-top: -15px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: rgba(255, 255, 255, 0.06);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: orbit-ring 20s linear infinite;
          animation-fill-mode: both;
          z-index: 6;
        }

        .wf-token-chip img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        /* Single orbit keyframe: polar formula rotate(θ) translateX(r) rotate(-θ)
           All tokens share this — animation-delay shifts their starting angle */
        @keyframes orbit-ring {
          from { transform: rotate(0deg) translateX(80px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(80px) rotate(-360deg); }
        }

        /* 5 tokens spaced 72° apart using animation-delay on 20s cycle:
           delay = -(n × 4s) so tokens start at their orbital positions */
        .wf-tc-eth { animation-delay: 0s; }
        .wf-tc-sol { animation-delay: -4s; }
        .wf-tc-wif { animation-delay: -8s; }
        .wf-tc-cake { animation-delay: -12s; }
        .wf-tc-doge { animation-delay: -16s; }

        .wf-core {
          position: absolute;
          left: 50%;
          top: var(--wf-center-y);
          transform: translate(-50%, -50%);
          width: 90px;
          height: 90px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: radial-gradient(circle at 32% 30%, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.04)), #f7931a;
          box-shadow:
            0 0 0 8px rgba(247, 147, 26, 0.06),
            0 0 50px rgba(247, 147, 26, 0.22),
            0 0 100px rgba(247, 147, 26, 0.1),
            inset 0 2px 4px rgba(255, 255, 255, 0.2);
          display: grid;
          place-items: center;
          z-index: 4;
          animation: core-glow 3s ease-in-out infinite;
        }

        .wf-btc-icon {
          width: 42px;
          height: 42px;
          object-fit: contain;
          border-radius: 50%;
          filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4));
        }

        @keyframes core-glow {
          0%, 100% {
            box-shadow:
              0 0 0 8px rgba(247, 147, 26, 0.06),
              0 0 50px rgba(247, 147, 26, 0.22),
              0 0 100px rgba(247, 147, 26, 0.1),
              inset 0 2px 4px rgba(255, 255, 255, 0.2);
          }
          50% {
            box-shadow:
              0 0 0 12px rgba(247, 147, 26, 0.1),
              0 0 70px rgba(247, 147, 26, 0.35),
              0 0 120px rgba(247, 147, 26, 0.18),
              inset 0 2px 4px rgba(255, 255, 255, 0.25);
          }
        }

        @media (max-width: 1280px) {
          .wf-orbit-panel { max-height: 380px; }
          .wf-orbit-1 { width: 160px; height: 160px; }
          .wf-orbit-2 { width: 300px; height: 300px; }
          .wf-orbit-3 { width: 380px; height: 380px; }
          .wf-core    { width: 90px; height: 90px; }
          .wf-btc-icon { width: 42px; height: 42px; }
          .wf-orbit-ring-main { width: 160px; height: 160px; }
          .wf-token-chip { width: 30px; height: 30px; margin-left: -15px; margin-top: -15px; }
        }

        @media (max-width: 780px) {
          .wf-orbit-panel { max-height: 280px; }
          .wf-orbit-1 { width: 140px; height: 140px; }
          .wf-orbit-2 { width: 240px; height: 240px; }
          .wf-orbit-3 { width: 300px; height: 300px; }
          .wf-core    { width: 70px; height: 70px; }
          .wf-btc-icon { width: 34px; height: 34px; }
          .wf-orbit-ring-main { width: 140px; height: 140px; }
          .wf-token-chip { width: 24px; height: 24px; margin-left: -12px; margin-top: -12px; }
        }
      `}</style>
    </section>
  );
}