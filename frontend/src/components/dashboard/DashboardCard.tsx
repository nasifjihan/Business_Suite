import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "emerald" | "sky" | "violet" | "rose" | "slate" | "teal";

export interface DashboardCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  tone: Tone;
  neutralDelta?: boolean;
}

const TONE_CLASSES: Record<Tone, string> = {
  emerald: "bg-emerald-500/10 text-emerald-600",
  sky: "bg-sky-500/10 text-sky-600",
  violet: "bg-violet-500/10 text-violet-600",
  rose: "bg-rose-500/10 text-rose-600",
  slate: "bg-slate-500/10 text-slate-600",
  teal: "bg-teal-500/10 text-teal-600",
};

export default function DashboardCard({
  icon: Icon,
  label,
  value,
  delta,
  deltaLabel,
  tone,
  neutralDelta = false,
}: DashboardCardProps) {
  const showDelta = typeof delta === "number";
  const deltaPositive = showDelta && delta! > 0;
  const deltaNegative = showDelta && delta! < 0;
  const deltaZero = showDelta && delta === 0;

  const deltaToneClass = neutralDelta
    ? "text-slate-600 bg-slate-500/10"
    : deltaPositive
    ? "text-emerald-600 bg-emerald-500/10"
    : deltaNegative
    ? "text-rose-600 bg-rose-500/10"
    : "text-slate-600 bg-slate-500/10";

  const arrowChar = neutralDelta
    ? deltaZero
      ? "→"
      : deltaPositive
      ? "↗"
      : "↘"
    : deltaPositive
    ? "↑"
    : deltaNegative
    ? "↓"
    : "→";

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className={cn("rounded-lg p-2", TONE_CLASSES[tone])}>
          <Icon className="w-5 h-5" />
        </div>
        {showDelta && (
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
              deltaToneClass
            )}
          >
            <span>{arrowChar}</span>
            <span>{Math.abs(delta!).toFixed(1)}%</span>
          </div>
        )}
      </div>
      <p className="mt-3 text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {deltaLabel && (
        <p className="mt-1 text-xs text-muted-foreground">{deltaLabel}</p>
      )}
    </div>
  );
}
