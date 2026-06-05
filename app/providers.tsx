"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const ReactQueryDevtools = dynamic(
  () => import("@tanstack/react-query-devtools").then((mod) => mod.ReactQueryDevtools),
  { ssr: false }
);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime:          30_000,
            gcTime:             5 * 60_000,
            retry:              2,
            retryDelay:         (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}
