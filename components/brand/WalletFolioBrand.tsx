import { cn } from "@/lib/utils";

interface WalletFolioMarkProps {
  size?: number;
  className?: string;
  alt?: string;
}

interface WalletFolioWordmarkProps {
  className?: string;
}

interface WalletFolioBrandProps {
  size?: number;
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}

/* ─── Official Bitcoin path from the user's design ─── */
const BITCOIN_PATH =
  "M2947.77 1754.38c40.72,-272.26 -166.56,-418.61 -450,-516.24l91.95 -368.8 -224.5 -55.94 -89.51 359.09c-59.02,-14.72 -119.63,-28.59 -179.87,-42.34l90.16 -361.46 -224.36 -55.94 -92 368.68c-48.84,-11.12 -96.81,-22.11 -143.35,-33.69l0.26 -1.16 -309.59 -77.31 -59.72 239.78c0,0 166.56,38.18 163.05,40.53 90.91,22.69 107.35,82.87 104.62,130.57l-104.74 420.15c6.26,1.59 14.38,3.89 23.34,7.49 -7.49,-1.86 -15.46,-3.89 -23.73,-5.87l-146.81 588.57c-11.11,27.62 -39.31,69.07 -102.87,53.33 2.25,3.26 -163.17,-40.72 -163.17,-40.72l-111.46 256.98 292.15 72.83c54.35,13.63 107.61,27.89 160.06,41.3l-92.9 373.03 224.24 55.94 92 -369.07c61.26,16.63 120.71,31.97 178.91,46.43l-91.69 367.33 224.51 55.94 92.89 -372.33c382.82,72.45 670.67,43.24 791.83,-303.02 97.63,-278.78 -4.86,-439.58 -206.26,-544.44 146.69,-33.83 257.18,-130.31 286.64,-329.61l-0.07 -0.05zm-512.93 719.26c-69.38,278.78 -538.76,128.08 -690.94,90.29l123.28 -494.2c152.17,37.99 640.17,113.17 567.67,403.91zm69.43 -723.3c-63.29,253.58 -453.96,124.75 -580.69,93.16l111.77 -448.21c126.73,31.59 534.85,90.55 468.94,355.05l-0.02 0z";

/* Neon blue */
const NEON = "#00e5ff";
const NEON_GLOW = "rgba(0,229,255,0.6)";

export function WalletFolioMark({
  size = 28,
  className,
  alt = "walletfolio logo",
}: WalletFolioMarkProps) {
  /* Scale the 500×500 design to requested size */
  const s = size;
  const scale = s / 500;

  return (
    <svg
      viewBox={`0 0 ${s} ${s}`}
      role="img"
      aria-label={alt}
      width={size}
      height={size}
      className={cn("shrink-0 select-none", className)}
      style={{ width: size, height: size }}
    >
      <defs>
        <filter id="wf-neon-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
        <filter id="wf-ring-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
      </defs>

      {/* Orbit ring */}
      <circle
        cx={s / 2}
        cy={s / 2}
        r={200 * scale}
        fill="none"
        stroke={NEON}
        strokeWidth={2 * scale}
        opacity="0.15"
      />

      {/* ── 6 orbiting coins ── */}
      {/* ETH */}
      <g transform={`translate(${s/2},${s/2}) rotate(0) translate(${200*scale}) rotate(0)`}>
        <circle r={35 * scale} fill="#000b1e" stroke={NEON} strokeWidth={2 * scale}
          style={{ filter: `drop-shadow(0 0 ${5*scale}px ${NEON_GLOW})` }}/>
        <svg x={-20*scale} y={-20*scale} width={40*scale} height={40*scale} viewBox="0 0 32 32">
          <path d="M16 2L15.7 3V21L16 21.3L24.3 16.4L16 2Z" fill={NEON} fillOpacity="0.6"/>
          <path d="M16 2L7.7 16.4L16 21.3V11.8V2Z" fill={NEON}/>
          <path d="M16 22.8L15.8 23V30L16 30.4L24.3 17.9L16 22.8Z" fill={NEON} fillOpacity="0.6"/>
          <path d="M16 30.4V22.8L7.7 17.9L16 30.4Z" fill={NEON}/>
        </svg>
      </g>

      {/* DOT */}
      <g transform={`translate(${s/2},${s/2}) rotate(60) translate(${200*scale}) rotate(-60)`}>
        <circle r={35 * scale} fill="#000b1e" stroke={NEON} strokeWidth={2 * scale}
          style={{ filter: `drop-shadow(0 0 ${5*scale}px ${NEON_GLOW})` }}/>
        <svg x={-20*scale} y={-20*scale} width={40*scale} height={40*scale} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" stroke={NEON} strokeWidth="1.5"/>
          <circle cx="12" cy="7" fill={NEON} r="1.5"/>
          <circle cx="16.5" cy="9.5" fill={NEON} fillOpacity="0.6" r="1.5"/>
          <circle cx="16.5" cy="14.5" fill={NEON} fillOpacity="0.6" r="1.5"/>
          <circle cx="12" cy="17" fill={NEON} r="1.5"/>
          <circle cx="7.5" cy="14.5" fill={NEON} fillOpacity="0.6" r="1.5"/>
          <circle cx="7.5" cy="9.5" fill={NEON} fillOpacity="0.6" r="1.5"/>
        </svg>
      </g>

      {/* SOL */}
      <g transform={`translate(${s/2},${s/2}) rotate(120) translate(${200*scale}) rotate(-120)`}>
        <circle r={35 * scale} fill="#000b1e" stroke={NEON} strokeWidth={2 * scale}
          style={{ filter: `drop-shadow(0 0 ${5*scale}px ${NEON_GLOW})` }}/>
        <svg x={-16*scale} y={-16*scale} width={32*scale} height={32*scale} viewBox="0 0 397 311">
          <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-64.6 64.6c-2.4 2.4-5.7 3.8-9.2 3.8H4.6c-5.8 0-8.7-7-4.6-11.1l64.6-64.6zM327.4 73.1c-2.4 2.4-5.7 3.8-9.2 3.8H0.8c-5.8 0-8.7-7-4.6-11.1L60.8 1.2C63.2-1.2 66.5-2.6 70-2.6h317.4c5.8 0 8.7 7 4.6 11.1l-64.6 64.6zM64.6 117.4c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-64.6 64.6c-2.4 2.4-5.7 3.8-9.2 3.8H4.6c-5.8 0-8.7-7-4.6-11.1l64.6-64.6z" fill={NEON}/>
        </svg>
      </g>

      {/* DOGE */}
      <g transform={`translate(${s/2},${s/2}) rotate(180) translate(${200*scale}) rotate(-180)`}>
        <circle r={35 * scale} fill="#000b1e" stroke={NEON} strokeWidth={2 * scale}
          style={{ filter: `drop-shadow(0 0 ${5*scale}px ${NEON_GLOW})` }}/>
        <text
          x="0"
          y="0"
          textAnchor="middle"
          dominantBaseline="central"
          fill={NEON}
          fontSize={30 * scale}
          fontWeight="800"
          fontFamily="Arial Black, system-ui, sans-serif"
          style={{ textShadow: `0 0 ${4*scale}px ${NEON_GLOW}` }}
        >
          Ð
        </text>
      </g>

      {/* ADA */}
      <g transform={`translate(${s/2},${s/2}) rotate(240) translate(${200*scale}) rotate(-240)`}>
        <circle r={35 * scale} fill="#000b1e" stroke={NEON} strokeWidth={2 * scale}
          style={{ filter: `drop-shadow(0 0 ${5*scale}px ${NEON_GLOW})` }}/>
        <svg x={-20*scale} y={-20*scale} width={40*scale} height={40*scale} viewBox="0 0 100 100">
          <circle cx="50" cy="50" fill={NEON} r="3"/>
          <circle cx="50" cy="30" fill={NEON} fillOpacity="0.8" r="2.5"/>
          <circle cx="70" cy="40" fill={NEON} fillOpacity="0.8" r="2.5"/>
          <circle cx="70" cy="60" fill={NEON} fillOpacity="0.8" r="2.5"/>
          <circle cx="50" cy="70" fill={NEON} fillOpacity="0.8" r="2.5"/>
          <circle cx="30" cy="60" fill={NEON} fillOpacity="0.8" r="2.5"/>
          <circle cx="30" cy="40" fill={NEON} fillOpacity="0.8" r="2.5"/>
        </svg>
      </g>

      {/* AVAX */}
      <g transform={`translate(${s/2},${s/2}) rotate(300) translate(${200*scale}) rotate(-300)`}>
        <circle r={35 * scale} fill="#000b1e" stroke={NEON} strokeWidth={2 * scale}
          style={{ filter: `drop-shadow(0 0 ${5*scale}px ${NEON_GLOW})` }}/>
        <svg x={-16*scale} y={-16*scale} width={32*scale} height={32*scale} viewBox="0 0 24 24">
          <path d="M12 2L2 19.5H22L12 2ZM12 6.5L18.5 17.5H5.5L12 6.5Z" fill={NEON}/>
        </svg>
      </g>

      {/* ── Central Bitcoin ── */}
      <g>
        {/* Outer rim */}
        <circle
          cx={s / 2}
          cy={s / 2}
          r={112 * scale}
          fill="none"
          stroke={NEON}
          strokeWidth={3 * scale}
          style={{ filter: `drop-shadow(0 0 ${8*scale}px ${NEON_GLOW})` }}
        />
        {/* Depth ring background */}
        <circle
          cx={s / 2}
          cy={s / 2}
          r={112 * scale}
          fill="rgba(0,11,30,0.8)"
          style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.8), inset 0 0 15px rgba(255,255,255,0.05)" }}
        />
        {/* Inner subtle ring */}
        <circle
          cx={s / 2}
          cy={s / 2}
          r={88 * scale}
          fill="none"
          stroke={NEON}
          strokeWidth={2 * scale}
          opacity="0.2"
        />
        {/* Bitcoin symbol */}
        <g transform={`translate(${s/2},${s/2}) scale(${scale * 0.034}) translate(-2045.5,-2045.8)`}>
          <path
            d={BITCOIN_PATH}
            fill={NEON}
            style={{ filter: `drop-shadow(0 0 ${10*scale}px ${NEON_GLOW})` }}
          />
        </g>
      </g>
    </svg>
  );
}

export function WalletFolioWordmark({ className }: WalletFolioWordmarkProps) {
  return (
    <span className={cn("relative inline-block", className)}>
      <span
        className="block font-extrabold lowercase tracking-[-0.02em] leading-none"
        style={{
          fontSize: "inherit",
          background: "linear-gradient(135deg,#0a2e38 0%,#064e3b 25%,#1e3a8a 50%,#064e3b 75%,#0a2e38 100%)",
          backgroundSize: "200% auto",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          filter: "drop-shadow(0 5px 15px rgba(0,0,0,0.5))",
          animation: "wfShine 5s linear infinite",
        }}
      >
        walletfolio
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 block font-extrabold lowercase tracking-[-0.02em] leading-none"
        style={{
          fontSize: "inherit",
          background: "linear-gradient(105deg,transparent 45%,rgba(255,255,255,0.4) 50%,transparent 55%)",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          animation: "wfSheen 3s infinite",
        }}
      >
        walletfolio
      </span>
    </span>
  );
}

export function WalletFolioBrand({
  size = 28,
  className,
  markClassName,
  wordmarkClassName,
}: WalletFolioBrandProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <WalletFolioMark size={size} className={markClassName} />
      <WalletFolioWordmark className={wordmarkClassName} />
    </div>
  );
}
