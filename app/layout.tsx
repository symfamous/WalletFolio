import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "@/app/providers";
import { ThemeProvider } from "@/components/common/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "walletfolio - Multi-Chain Portfolio Intelligence",
    template: "%s · walletfolio",
  },
  description:
    "Track wallet balances, DeFi positions, Hyperliquid exposure, and risk across EVM and Solana from one read-only dashboard.",
  keywords: ["crypto portfolio", "wallet tracker", "defi", "multi-chain", "walletfolio", "hyperliquid"],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "walletfolio - Multi-Chain Portfolio Intelligence",
    description: "Track wallet balances, DeFi positions, Hyperliquid exposure, and risk across EVM and Solana.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#08090a",
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="icon" href="/favicon.ico?v=7" sizes="any" />
        <link rel="shortcut icon" href="/favicon.ico?v=7" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=7" />
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="walletfolio" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  try {
    var theme = localStorage.getItem('walletfolio-theme');
    // Dark by default: only go light when explicitly chosen.
    var resolved = theme === 'light' ? 'light' : 'dark';
    document.documentElement.classList.add(resolved);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#08090a' : '#ffffff');
  } catch(e) {}
})();
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            // Register the service worker (PWA) ONLY in production. In dev, a SW
            // caches stale bundles and breaks HMR — so in dev we actively
            // unregister any existing SW and clear its caches.
            __html:
              process.env.NODE_ENV === "production"
                ? `if('serviceWorker'in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(e){console.warn('[SW]',e)})})}`
                : `if('serviceWorker'in navigator){navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister()})}).catch(function(){});if(window.caches&&caches.keys){caches.keys().then(function(ks){ks.forEach(function(k){caches.delete(k)})}).catch(function(){})}}`,
          }}
        />
      </head>
      <body className="font-sans bg-bg text-text-hi antialiased">
        <ThemeProvider>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
