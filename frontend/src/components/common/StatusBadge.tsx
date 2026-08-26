"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusBadgeTone =
  | "success"
  | "danger"
  | "neutral"
  | "info"
  | "accent"
  | "teal"
  | "rose"
  | "violet"
  | "emerald"
  | "slate"
  | "sky"
  | "active"
  | "inactive"
  | "pending"
  | "approved"
  | "rejected";

export const TONE_CLASSES: Record<StatusBadgeTone, string> = {
  success: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60 ring-emerald-900/5",
  danger: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60 ring-rose-900/5",
  neutral: "bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 ring-slate-900/5",
  info: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900/60 ring-sky-900/5",
  accent: "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-900/60 ring-violet-900/5",
  teal: "bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-900/60 ring-teal-900/5",
  emerald: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60 ring-emerald-900/5",
  rose: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60 ring-rose-900/5",
  violet: "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-900/60 ring-violet-900/5",
  slate: "bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 ring-slate-900/5",
  sky: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900/60 ring-sky-900/5",
  active: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60 ring-emerald-900/5",
  inactive: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60 ring-rose-900/5",
  pending: "bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 ring-slate-900/5",
  approved: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60 ring-emerald-900/5",
  rejected: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60 ring-rose-900/5",
};

export type StatusBadgeSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<StatusBadgeSize, string> = {
  sm: "px-1.5 py-0.5 text-[10px] gap-1",
  md: "px-2 py-0.5 text-xs gap-1.5",
  lg: "px-2.5 py-1 text-sm gap-2",
};

export interface StatusBadgeProps {
  label: ReactNode;
  tone?: StatusBadgeTone;
  size?: StatusBadgeSize;
  icon?: ReactNode;
  dot?: boolean;
  className?: string;
}

export function StatusBadge({
  label,
  tone = "neutral",
  size = "md",
  icon,
  dot,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full border ring-1 ring-inset whitespace-nowrap",
        TONE_CLASSES[tone],
        SIZE_CLASSES[size],
        className
      )}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping",
              TONE_CLASSES[tone].match(/emerald|success|active|approved/) ? "bg-emerald-400" :
              TONE_CLASSES[tone].match(/rose|danger|inactive|rejected/) ? "bg-rose-400" :
              TONE_CLASSES[tone].match(/sky|info/) ? "bg-sky-400" :
              TONE_CLASSES[tone].match(/violet|accent/) ? "bg-violet-400" :
              "bg-slate-400"
            )}
          />
          <span
            className={cn(
              "relative rounded-full h-1.5 w-1.5",
              TONE_CLASSES[tone].match(/emerald|success|active|approved/) ? "bg-emerald-500" :
              TONE_CLASSES[tone].match(/rose|danger|inactive|rejected/) ? "bg-rose-500" :
              TONE_CLASSES[tone].match(/sky|info/) ? "bg-sky-500" :
              TONE_CLASSES[tone].match(/violet|accent/) ? "bg-violet-500" :
              TONE_CLASSES[tone].match(/teal/) ? "bg-teal-500" :
              "bg-slate-500"
            )}
          />
        </span>
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{label}</span>
    </span>
  );
}
