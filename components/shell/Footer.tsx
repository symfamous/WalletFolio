import { WalletFolioBrand } from "@/components/brand/WalletFolioBrand";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <WalletFolioBrand size={22} wordmarkClassName="text-xs" />
          <p className="text-xs text-center" style={{ color: "rgb(var(--text-lo))", fontFamily: "var(--font-geist-mono),monospace" }}>
            // read-only · for informational purposes only
          </p>
          <p className="text-xs" style={{ color: "rgb(var(--text-mid))", fontFamily: "var(--font-geist-mono),monospace" }}>Next.js 15 · React 19</p>
        </div>
      </div>
    </footer>
  );
}
