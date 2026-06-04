import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "walletfolio",
    short_name: "walletfolio",
    description: "Multi-chain portfolio intelligence for wallet balances, DeFi positions, Hyperliquid exposure, and risk.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0f1712",
    theme_color: "#0f1712",
    icons: [
      {
        src: "/icon-192.png?v=11",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png?v=11",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/maskable-icon-512.png?v=11",
        sizes: "512x512",
        type: "image/png",
        // @ts-ignore
        purpose: "maskable",
      },
    ],
  };
}
