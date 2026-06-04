"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, useTransform, useSpring, useMotionValue } from "framer-motion";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { SpiralAnimation } from "@/components/ui/spiral-animation";

// --- Types ---
export type AnimationPhase = "scatter" | "line" | "circle" | "bottom-strip";

interface CoinInfo {
  name: string;
  ticker: string;
  src: string;
  color: string;
}

interface FlipCardProps {
  coin: CoinInfo;
  index: number;
  total: number;
  phase: AnimationPhase;
  target: { x: number; y: number; rotation: number; scale: number; opacity: number };
}

// --- FlipCard Component ---
const CARD_WIDTH = 42;
const CARD_HEIGHT = 60;

const FlipCard = React.memo(function FlipCard({
  coin,
  index: _index,
  target,
}: FlipCardProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <motion.div
      animate={{
        x: target.x,
        y: target.y,
        rotate: target.rotation,
        scale: target.scale,
        opacity: target.opacity,
      }}
      transition={{
        type: "spring",
        stiffness: 28,
        damping: 22,
        mass: 0.8,
      }}
      style={{
        position: "absolute",
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        transformStyle: "preserve-3d",
        perspective: "1000px",
        willChange: "transform",
      }}
      className="cursor-pointer group"
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
        whileHover={{ rotateY: 180 }}
      >
        {/* Front Face */}
        <div
          className="absolute inset-0 h-full w-full overflow-hidden rounded-xl shadow-lg bg-surface flex flex-col items-center justify-center p-2 border border-border"
          style={{ backfaceVisibility: "hidden" }}
        >
          {!imgError ? (
            <img
              src={coin.src}
              alt={coin.name}
              className="h-full w-full object-contain"
              onError={() => setImgError(true)}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center rounded-full font-bold text-[10px] text-text-hi"
              style={{ background: coin.color }}
            >
              {coin.ticker}
            </div>
          )}
        </div>

        {/* Back Face */}
        <div
          className="absolute inset-0 h-full w-full overflow-hidden rounded-xl shadow-lg bg-bg flex flex-col items-center justify-center p-2 border border-border"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="text-center">
            <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-0.5">
              {coin.ticker}
            </p>
            <p className="text-[9px] font-medium text-text-mid leading-tight">
              {coin.name}
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}, (prev, next) =>
  prev.target.x === next.target.x &&
  prev.target.y === next.target.y &&
  prev.target.rotation === next.target.rotation &&
  prev.target.scale === next.target.scale &&
  prev.target.opacity === next.target.opacity
);

// --- Coin Registry ---
const COINS: CoinInfo[] = [
  { name: "Bitcoin", ticker: "BTC", src: "/token-bitcoin.svg", color: "#F7931A" },
  { name: "Ethereum", ticker: "ETH", src: "/token-ethereum.svg", color: "#627EEA" },
  { name: "Solana", ticker: "SOL", src: "/token-solana.svg", color: "#14F195" },
  { name: "XRP", ticker: "XRP", src: "https://cryptologos.cc/logos/xrp-xrp-logo.svg", color: "#23292F" },
  { name: "BNB", ticker: "BNB", src: "https://cryptologos.cc/logos/bnb-bnb-logo.svg", color: "#F0B90B" },
  { name: "Dogecoin", ticker: "DOGE", src: "/token-dogecoin.svg", color: "#C2A633" },
  { name: "Cardano", ticker: "ADA", src: "https://cryptologos.cc/logos/cardano-ada-logo.svg", color: "#0033AD" },
  { name: "Avalanche", ticker: "AVAX", src: "https://cryptologos.cc/logos/avalanche-avax-logo.svg", color: "#E84142" },
  { name: "Chainlink", ticker: "LINK", src: "https://cryptologos.cc/logos/chainlink-link-logo.svg", color: "#375BD2" },
  { name: "Polygon", ticker: "MATIC", src: "https://cryptologos.cc/logos/polygon-matic-logo.svg", color: "#8247E5" },
  { name: "Polkadot", ticker: "DOT", src: "https://cryptologos.cc/logos/polkadot-new-dot-logo.svg", color: "#E6007A" },
  { name: "Uniswap", ticker: "UNI", src: "https://cryptologos.cc/logos/uniswap-uni-logo.svg", color: "#FF007A" },
  { name: "Litecoin", ticker: "LTC", src: "https://cryptologos.cc/logos/litecoin-ltc-logo.svg", color: "#345D9D" },
  { name: "Shiba Inu", ticker: "SHIB", src: "https://cryptologos.cc/logos/shiba-inu-shib-logo.svg", color: "#FFA409" },
  { name: "TRON", ticker: "TRX", src: "https://cryptologos.cc/logos/tron-trx-logo.svg", color: "#FF060A" },
  { name: "Cosmos", ticker: "ATOM", src: "https://cryptologos.cc/logos/cosmos-atom-logo.svg", color: "#2E3148" },
  { name: "Arbitrum", ticker: "ARB", src: "https://cryptologos.cc/logos/arbitrum-arb-logo.svg", color: "#2D374B" },
  { name: "Optimism", ticker: "OP", src: "https://cryptologos.cc/logos/optimism-ethereum-op-logo.svg", color: "#FF0420" },
  { name: "Dogwifhat", ticker: "WIF", src: "/token-dogwifhat.svg", color: "#D4A5A5" },
  { name: "PancakeSwap", ticker: "CAKE", src: "/token-pancakeswap.svg", color: "#D1884F" },
];

const TOTAL_CARDS = COINS.length;
// 0 = the formed circle locks in place; scrolling goes straight to the page
// sections instead of morphing/rotating the cards on scroll.
const MAX_SCROLL = 0;

const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;

export interface ScrollMorphHeroProps {
  onEnter?: () => void;
}

export default function ScrollMorphHero({ onEnter }: ScrollMorphHeroProps) {
  const [introPhase, setIntroPhase] = useState<AnimationPhase>("scatter");
  const [containerSize, setContainerSize] = useState(() => {
    if (typeof window !== "undefined") {
      return { width: window.innerWidth, height: window.innerHeight };
    }
    return { width: 375, height: 667 };
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Container Size ---
  useEffect(() => {
    if (!containerRef.current) return;

    const handleResize = (entries: ResizeObserverEntry[]) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(containerRef.current);

    setContainerSize({
      width: containerRef.current.offsetWidth,
      height: containerRef.current.offsetHeight,
    });

    return () => observer.disconnect();
  }, []);

  // --- Virtual Scroll Logic ---
  const virtualScroll = useMotionValue(0);
  const scrollRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Release to native page scroll once the morph is fully scrolled (so the
      // marketing sections below the hero become reachable), or above the top.
      if (
        (e.deltaY > 0 && scrollRef.current >= MAX_SCROLL) ||
        (e.deltaY < 0 && scrollRef.current <= 0)
      ) {
        return;
      }
      e.preventDefault();
      const newScroll = Math.min(Math.max(scrollRef.current + e.deltaY, 0), MAX_SCROLL);
      scrollRef.current = newScroll;
      virtualScroll.set(newScroll);
    };

    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    const handleTouchMove = (e: TouchEvent) => {
      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;
      touchStartY = touchY;
      const newScroll = Math.min(Math.max(scrollRef.current + deltaY, 0), MAX_SCROLL);
      scrollRef.current = newScroll;
      virtualScroll.set(newScroll);
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("touchstart", handleTouchStart, { passive: false });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
    };
  }, [virtualScroll]);

  // 1. Morph Progress
  const morphProgress = useTransform(virtualScroll, [0, 350], [0, 1]);
  const smoothMorph = useSpring(morphProgress, { stiffness: 40, damping: 20 });

  // 2. Scroll Rotation
  const scrollRotate = useTransform(virtualScroll, [350, 1800], [0, 360]);
  const smoothScrollRotate = useSpring(scrollRotate, { stiffness: 40, damping: 20 });

  // --- Mouse Parallax ---
  const mouseX = useMotionValue(0);
  const smoothMouseX = useSpring(mouseX, { stiffness: 30, damping: 20 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const normalizedX = (relativeX / rect.width) * 2 - 1;
      mouseX.set(normalizedX * 100);
    };
    container.addEventListener("mousemove", handleMouseMove);
    return () => container.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX]);

  // --- Intro Sequence ---
  useEffect(() => {
    const timer1 = setTimeout(() => setIntroPhase("line"), 500);
    const timer2 = setTimeout(() => setIntroPhase("circle"), 2500);
    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, []);

  // --- Random Scatter Positions ---
  const scatterPositions = useMemo(() => {
    return COINS.map(() => ({
      x: (Math.random() - 0.5) * 1500,
      y: (Math.random() - 0.5) * 1000,
      rotation: (Math.random() - 0.5) * 180,
      scale: 0.6,
      opacity: 0,
    }));
  }, []);

  // --- Render Loop (throttled RAF, single state update) ---
  const [renderTick, setRenderTick] = useState(0);
  const animRef = useRef({ morph: 0, rotate: 0, parallax: 0 });

  useEffect(() => {
    let rafId: number;
    let lastUpdate = 0;

    const loop = (time: number) => {
      rafId = requestAnimationFrame(loop);
      // Throttle React state updates to ~30fps (every 33ms)
      if (time - lastUpdate < 33) return;
      lastUpdate = time;

      animRef.current = {
        morph: smoothMorph.get(),
        rotate: smoothScrollRotate.get(),
        parallax: smoothMouseX.get(),
      };
      setRenderTick((t) => t + 1);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [smoothMorph, smoothScrollRotate, smoothMouseX]);

  const isMobile = containerSize.width < 768;

    return (
    <div ref={containerRef} className="relative w-full pwa-full-height bg-bg overflow-hidden">
      {/* Theme Toggle — top right (safe-area aware) */}
      <div className="absolute right-4 z-30" style={{ top: "max(1rem, env(safe-area-inset-top, 1rem))" }}>
        <ThemeToggle />
      </div>

      {/* Spiral animation — full page canvas, spiral origin at center */}
      {introPhase === "circle" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: Math.max(0, 1 - animRef.current.morph * 2.5) }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="absolute inset-0 z-[6] pointer-events-none"
        >
          <SpiralAnimation />
        </motion.div>
      )}

      {/* Enter button + tagline — absolutely centered in the containerRef */}
      {introPhase === "circle" && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: Math.max(0, 1 - animRef.current.morph * 2.5), scale: 1 }}
            transition={{ duration: 0.8, delay: 1.5, ease: "easeOut" }}
            className="flex flex-col items-center gap-2"
          >
            <p
              className="text-[11px] sm:text-xs tracking-[0.3em] uppercase font-medium"
              style={{
                background: "linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent)/0.6), rgb(var(--text-hi)))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "drop-shadow(0 0 8px rgb(var(--accent)/0.3))",
              }}
            >
              Portfolio intelligence
            </p>
            {onEnter && (
              <button
                type="button"
                onClick={onEnter}
                className="pointer-events-auto text-text-hi text-base sm:text-lg tracking-[0.25em] uppercase font-light transition-all duration-700 hover:tracking-[0.35em]"
                style={{
                  textShadow: "0 0 12px rgb(var(--accent)/0.4), 0 0 24px rgb(var(--accent)/0.15)",
                }}
              >
                Enter
              </button>
            )}
          </motion.div>
        </div>
      )}

      <div className="flex h-full w-full flex-col items-center justify-center" style={{ perspective: 1000 }}>
        {/* Main Container */}
        <div className="relative z-[5] flex items-center justify-center w-full h-full">
          {COINS.map((coin, i) => {
            let target = { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 };

            if (introPhase === "scatter") {
              target = scatterPositions[i];
            } else if (introPhase === "line") {
              const lineSpacing = 70;
              const lineTotalWidth = TOTAL_CARDS * lineSpacing;
              const lineX = i * lineSpacing - lineTotalWidth / 2;
              target = { x: lineX, y: 0, rotation: 0, scale: 1, opacity: 1 };
            } else {
              const isMobile = containerSize.width < 768;
              const minDimension = Math.min(containerSize.width, containerSize.height);
              const centerX = containerSize.width / 2;
              const centerY = containerSize.height / 2;

              const circleRadius = Math.min(minDimension * 0.38, 380);
              const circleAngle = (i / TOTAL_CARDS) * 360;
              const circleRad = (circleAngle * Math.PI) / 180;
              const circlePos = {
                x: Math.cos(circleRad) * circleRadius,
                y: Math.sin(circleRad) * circleRadius,
                rotation: circleAngle + 90,
              };

              const baseRadius = Math.min(containerSize.width, containerSize.height * 1.5);
              const arcRadius = baseRadius * (isMobile ? 0.72 : 1.1);
              const arcApexY = containerSize.height * (isMobile ? 0.22 : 0.25);
              const arcCenterY = arcApexY + arcRadius;
              const spreadAngle = isMobile ? 100 : 130;
              const startAngle = -90 - (spreadAngle / 2);
              const step = spreadAngle / (TOTAL_CARDS - 1);

              const scrollProgress = Math.min(Math.max(animRef.current.rotate / 360, 0), 1);
              const maxRotation = spreadAngle * 0.8;
              const boundedRotation = -scrollProgress * maxRotation;
              const currentArcAngle = startAngle + (i * step) + boundedRotation;
              const arcRad = (currentArcAngle * Math.PI) / 180;

              const arcPos = {
                x: Math.cos(arcRad) * arcRadius + animRef.current.parallax,
                y: Math.sin(arcRad) * arcRadius + arcCenterY - centerY,
                rotation: currentArcAngle + 90,
                scale: isMobile ? 0.7 : 1.4,
              };

              target = {
                x: lerp(circlePos.x, arcPos.x, animRef.current.morph),
                y: lerp(circlePos.y, arcPos.y, animRef.current.morph),
                rotation: lerp(circlePos.rotation, arcPos.rotation, animRef.current.morph),
                scale: lerp(1, arcPos.scale, animRef.current.morph),
                opacity: 1,
              };
            }

            return (
              <FlipCard
                key={i}
                coin={coin}
                index={i}
                total={TOTAL_CARDS}
                phase={introPhase}
                target={target}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
