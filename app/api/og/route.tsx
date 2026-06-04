/**
 * app/api/og/route.tsx
 * Shareable portfolio card (1200×630 PNG) via next/og. Data is passed as query
 * params so it renders instantly without re-fetching the portfolio.
 *   /api/og?name=vitalik.eth&value=$4,920&change=-2.4&assets=ETH,HYPE,USDC
 */
import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = (searchParams.get("name") ?? "Portfolio").slice(0, 42);
  const value = (searchParams.get("value") ?? "$0").slice(0, 24);
  const changeRaw = searchParams.get("change");
  const change = changeRaw != null ? Number(changeRaw) : null;
  const assets = (searchParams.get("assets") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);

  const up = (change ?? 0) >= 0;
  const accent = "#828fff";
  const green = "#4cc38a";
  const red = "#f2566a";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#08090a",
          padding: "64px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: accent }} />
          <div style={{ color: "#f7f8f8", fontSize: "30px", fontWeight: 700 }}>walletfolio</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: "#8a8f98", fontSize: "30px" }}>{name}</div>
          <div style={{ color: "#f7f8f8", fontSize: "108px", fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
          {change != null ? (
            <div style={{ color: up ? green : red, fontSize: "40px", fontWeight: 600, display: "flex" }}>
              {`${up ? "+" : ""}${change.toFixed(2)}% 24h`}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {assets.map((a) => (
            <div
              key={a}
              style={{
                color: "#d0d6e0",
                fontSize: "24px",
                border: "1px solid #28282c",
                borderRadius: "999px",
                padding: "8px 18px",
                display: "flex",
              }}
            >
              {a}
            </div>
          ))}
          <div style={{ marginLeft: "auto", color: "#8a8f98", fontSize: "22px", display: "flex" }}>
            {"multi-chain portfolio intelligence"}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
