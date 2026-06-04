import { cn } from "@/lib/utils";

export function Sk({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} />;
}

export function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface p-5 space-y-3">
          <div className="flex items-start justify-between">
            <Sk className="h-3 w-24" />
            <Sk className="h-7 w-7 rounded-lg" />
          </div>
          <Sk className="h-8 w-28" />
          <Sk className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function HoldingsTableSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Sk className="h-9 flex-1 max-w-xs" />
        <Sk className="h-9 w-48" />
      </div>
      <div className="divide-y divide-border">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5">
            <Sk className="h-9 w-9 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Sk className="h-3.5 w-20" />
              <Sk className="h-3 w-28" />
            </div>
            <Sk className="h-5 w-20 rounded-md hidden sm:block" />
            <div className="ml-auto text-right space-y-1.5">
              <Sk className="h-3.5 w-24 ml-auto" />
              <Sk className="h-3 w-14 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChainBreakdownSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <Sk className="h-4 w-32" />
      <Sk className="h-32 w-32 rounded-full mx-auto" />
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Sk className="h-8 w-8 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="flex justify-between">
                <Sk className="h-3 w-20" />
                <Sk className="h-3 w-16" />
              </div>
              <Sk className="h-1.5 w-full rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-5 animate-fade-in">
      <SummaryCardsSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <HoldingsTableSkeleton />
        </div>
        <ChainBreakdownSkeleton />
      </div>
    </div>
  );
}
