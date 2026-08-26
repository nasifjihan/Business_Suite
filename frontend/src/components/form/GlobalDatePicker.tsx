"use client";

import { forwardRef, useId, useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { DayPicker } from "react-day-picker";
import { format, parseISO } from "date-fns";
import { Calendar, X } from "lucide-react";
import { cn } from "@/lib/utils";
import "react-day-picker/style.css";

export interface GlobalDatePickerProps {
  label?: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  value?: string | Date | null;
  onChange?: (isoDate: string | null) => void;
  onBlur?: () => void;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
  allowClear?: boolean;
}

export const GlobalDatePicker = forwardRef<HTMLButtonElement, GlobalDatePickerProps>(
  function GlobalDatePicker(
    {
      label,
      error,
      hint,
      placeholder = "Pick a date",
      value,
      onChange,
      onBlur,
      disabled,
      required,
      id,
      className,
      minDate,
      maxDate,
      allowClear = true,
    },
    ref
  ) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const [open, setOpen] = useState(false);

    const selectedDate: Date | undefined = useMemo(() => {
      if (!value) return undefined;
      if (value instanceof Date) return value;
      const parsed = parseISO(value);
      return isNaN(parsed.getTime()) ? undefined : parsed;
    }, [value]);

    const displayText = selectedDate ? format(selectedDate, "MMM d, yyyy") : placeholder;

    function handleSelect(date: Date | undefined) {
      if (!date) {
        onChange?.(null);
        return;
      }
      const iso = format(date, "yyyy-MM-dd");
      onChange?.(iso);
      setOpen(false);
    }

    function handleClear(e: React.MouseEvent) {
      e.stopPropagation();
      onChange?.(null);
    }

    return (
      <div className={cn("space-y-1.5", className)}>
        {label && (
          <label className="block text-sm font-medium text-foreground" htmlFor={inputId}>
            {label}
            {required && <span className="ml-0.5 text-rose-500">*</span>}
          </label>
        )}
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <button
              id={inputId}
              type="button"
              ref={ref}
              disabled={disabled}
              onBlur={onBlur}
              aria-invalid={Boolean(error) || undefined}
              className={cn(
                "flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-left text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/70 disabled:cursor-not-allowed disabled:opacity-60",
                error && "border-rose-400 focus:ring-rose-400"
              )}
            >
              <span className={cn("flex items-center gap-2 min-w-0", !selectedDate && "text-muted-foreground/60")}>
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{displayText}</span>
              </span>
              <span className="flex items-center gap-1">
                {allowClear && selectedDate && !disabled && (
                  <span
                    onClick={handleClear}
                    tabIndex={-1}
                    role="button"
                    className="text-slate-400 hover:text-rose-600 p-1"
                    aria-label="Clear date"
                  >
                    <X className="w-3.5 h-3.5" />
                  </span>
                )}
              </span>
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={4}
              className="z-50 rounded-lg border border-border bg-card p-3 shadow-lg animate-in fade-in-80 zoom-in-95"
            >
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={handleSelect}
                disabled={(d) =>
                  (minDate ? d < minDate : false) || (maxDate ? d > maxDate : false)
                }
                classNames={{
                  root: "!bg-transparent",
                  day: "rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 h-9 w-9 text-sm",
                  selected: "!bg-primary !text-primary-foreground !font-semibold",
                  today: "font-semibold ring-1 ring-primary/60",
                  disabled: "opacity-40 pointer-events-none",
                  months: "flex flex-col sm:flex-row gap-4",
                  month: "space-y-3",
                  month_caption: "flex justify-center items-center h-9",
                  caption_label: "text-sm font-semibold",
                  nav: "flex items-center gap-1",
                  button_previous: "p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800",
                  button_next: "p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800",
                  month_grid: "border-collapse space-y-1",
                  weekdays: "flex",
                  weekday: "text-[10px] font-semibold text-slate-500 w-9 text-center",
                  week: "flex mt-1",
                }}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        {error && (
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>
        )}
        {!error && hint && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
        )}
      </div>
    );
  }
);
GlobalDatePicker.displayName = "GlobalDatePicker";
