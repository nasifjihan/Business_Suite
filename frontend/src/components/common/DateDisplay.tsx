"use client";

import { format, parseISO, formatDistanceToNow, isValid } from "date-fns";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DateDisplayFormat = "short" | "medium" | "long" | "relative" | "datetime" | "time";

const DATE_FORMATS: Record<DateDisplayFormat, string> = {
  short: "MMM d, yyyy",
  medium: "MMMM d, yyyy",
  long: "EEEE, MMMM d, yyyy",
  datetime: "MMM d, yyyy h:mm a",
  time: "h:mm a",
  relative: "",
};

export interface DateDisplayProps {
  date?: string | Date | number | null;
  format?: DateDisplayFormat;
  className?: string;
  placeholder?: ReactNode;
  suffixRelative?: string;
  addSuffix?: boolean;
  includeSeconds?: boolean;
}

export function DateDisplay({
  date,
  format: formatType = "medium",
  className,
  placeholder = "—",
  suffixRelative = "",
  addSuffix = true,
  includeSeconds = false,
}: DateDisplayProps) {
  if (date === undefined || date === null || date === "") {
    return <span className={cn("text-muted-foreground/60", className)}>{placeholder}</span>;
  }

  let parsed: Date;
  if (date instanceof Date) {
    parsed = date;
  } else if (typeof date === "number") {
    parsed = new Date(date);
  } else {
    parsed = parseISO(date as string);
    if (!isValid(parsed)) {
      parsed = new Date(date as string);
    }
  }

  if (!isValid(parsed)) {
    return <span className={cn("text-muted-foreground/60", className)}>{placeholder}</span>;
  }

  let display: string;
  if (formatType === "relative") {
    display = formatDistanceToNow(parsed, {
      addSuffix,
      includeSeconds,
    });
    if (suffixRelative) display = `${display} ${suffixRelative}`;
  } else {
    display = format(parsed, DATE_FORMATS[formatType]);
  }

  return (
    <time
      dateTime={parsed.toISOString()}
      title={format(parsed, "EEEE, MMMM d, yyyy 'at' h:mm:ss a OOOO")}
      className={cn(className)}
    >
      {display}
    </time>
  );
}
