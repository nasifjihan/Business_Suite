"use client";

import { cn } from "@/lib/utils";

export interface MoneyDisplayProps {
  value: string | number | bigint | null | undefined;
  currency?: string;
  locale?: string;
  className?: string;
  align?: "left" | "right" | "center";
  showSymbol?: boolean;
  fractionDigits?: number;
  zeroPlaceholder?: string;
  negativeClass?: string;
  positiveClass?: string;
}

export function MoneyDisplay({
  value,
  currency = "USD",
  locale = "en-US",
  className,
  align = "right",
  showSymbol = true,
  fractionDigits = 2,
  zeroPlaceholder,
  negativeClass,
  positiveClass,
}: MoneyDisplayProps) {
  const numeric =
    value === null || value === undefined || value === ""
      ? NaN
      : typeof value === "bigint"
      ? Number(value)
      : typeof value === "number"
      ? value
      : parseFloat(String(value));

  const isNegative = isFinite(numeric) && numeric < 0;
  const isPositive = isFinite(numeric) && numeric > 0;
  const isZero = isFinite(numeric) && numeric === 0;

  let display: string;
  if (!isFinite(numeric)) {
    display = zeroPlaceholder ?? "—";
  } else if (isZero && zeroPlaceholder) {
    display = zeroPlaceholder;
  } else {
    const formatted = new Intl.NumberFormat(locale, {
      style: showSymbol ? "currency" : "decimal",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(numeric);
    display = formatted;
  }

  return (
    <span
      className={cn(
        "inline-block tabular-nums",
        align === "right" && "text-right w-full",
        align === "center" && "text-center",
        isNegative && (negativeClass ?? "text-rose-600 dark:text-rose-400 font-medium"),
        isPositive && positiveClass,
        className
      )}
    >
      {display}
    </span>
  );
}
