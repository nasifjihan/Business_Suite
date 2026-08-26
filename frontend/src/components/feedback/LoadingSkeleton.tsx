"use client";

import { cn } from "@/lib/utils";

export interface LoadingSkeletonProps {
  count?: number;
  className?: string;
  columns?: number;
  rounded?: string;
}

export function LoadingSkeleton({
  count = 5,
  className,
  columns = 1,
  rounded = "rounded-lg",
}: LoadingSkeletonProps) {
  const rows = Array.from({ length: count }, (_, i) => i);
  return (
    <div
      className={cn(
        "grid gap-3 w-full animate-in fade-in-50",
        columns > 1 ? `grid-cols-1 md:grid-cols-${columns}` : "",
        className
      )}
    >
      {rows.map((i) => (
        <SkeletonRow key={i} rounded={rounded} />
      ))}
    </div>
  );
}

function SkeletonRow({ rounded = "rounded-lg" }: { rounded?: string }) {
  return (
    <div
      className={cn(
        "h-12 w-full animate-pulse",
        rounded,
        "bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-800 dark:via-slate-700/70 dark:to-slate-800"
      )}
      aria-hidden="true"
    />
  );
}
