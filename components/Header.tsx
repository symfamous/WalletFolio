import Link from "next/link";
import { WalletFolioBrand } from "@/components/brand/WalletFolioBrand";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-bg/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="group flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <WalletFolioBrand size={28} wordmarkClassName="text-[15px]" />
          </Link>
          <span className="text-xs hidden sm:block" style={{ color: "rgb(var(--text-lo))", fontFamily: "var(--font-geist-mono),monospace" }}>
            // wallet + defi · read-only
          </span>
        </div>
      </div>
    </header>
  );
}
