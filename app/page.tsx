"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";

const Landing = dynamic(
  () => import("@/components/shell/Landing").then((mod) => mod.Landing),
  {
    ssr: false,
    loading: () => <div className="min-h-[100dvh] bg-bg" />,
  }
);

const AppShell = dynamic(
  () => import("@/components/shell/AppShell").then((mod) => mod.AppShell),
  {
    ssr: false,
    loading: () => <div className="min-h-[100dvh] bg-bg" />,
  }
);

export default function Home() {
  const [entered, setEntered] = useState(false);
  const [initialAddress, setInitialAddress] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Skip the landing on revisit only if a wallet is already tracked.
    const enteredFlag = localStorage.getItem("walletfolio_entered");
    const lastAddr = localStorage.getItem("pseryte_last_address");
    if (enteredFlag === "1" && lastAddr) setEntered(true);
  }, []);

  // Called from the landing. Pass an address to open its portfolio directly.
  function handleEnter(address?: string) {
    if (typeof window !== "undefined") {
      localStorage.setItem("walletfolio_entered", "1");
    }
    if (address) setInitialAddress(address);
    setEntered(true);
  }

  if (!entered) {
    return <Landing onEnter={handleEnter} />;
  }

  return <AppShell initialAddress={initialAddress} />;
}
