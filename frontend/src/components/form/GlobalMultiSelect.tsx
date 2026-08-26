"use client";

import { forwardRef, useId, useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as Checkbox from "@radix-ui/react-checkbox";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ControllerRenderProps, FieldValues } from "react-hook-form";

export interface MultiSelectOption<V extends string = string> {
  value: V;
  label: string;
  disabled?: boolean;
}

export interface GlobalMultiSelectProps<V extends string = string> {
  label?: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  options: MultiSelectOption<V>[];
  value?: V[];
  onChange?: (value: V[]) => void;
  onBlur?: () => void;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  maxDisplayed?: number;
}

type MultiSelectControllerField = ControllerRenderProps<FieldValues, string>;

export const GlobalMultiSelect = forwardRef<
  HTMLDivElement,
  GlobalMultiSelectProps & { field?: MultiSelectControllerField }
>(function GlobalMultiSelect(
  {
    label,
    error,
    hint,
    placeholder = "Select items...",
    options,
    value,
    onChange,
    onBlur,
    disabled,
    required,
    id,
    className,
    maxDisplayed = 3,
    field,
  },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [open, setOpen] = useState(false);

  const actualValue: string[] = useMemo(() => {
    if (field) return field.value as string[] ?? [];
    return (value as string[]) ?? [];
  }, [field, value]);

  const labelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) m.set(o.value as string, o.label);
    return m;
  }, [options]);

  function toggleItem(val: string) {
    const current = Array.isArray(actualValue) ? actualValue : [];
    const next = current.includes(val)
      ? current.filter((v) => v !== val)
      : [...current, val];
    if (field) field.onChange(next);
    onChange?.(next as any);
  }

  function removeChip(val: string, e: React.MouseEvent) {
    e.stopPropagation();
    const next = (Array.isArray(actualValue) ? actualValue : []).filter(
      (v) => v !== val
    );
    if (field) field.onChange(next);
    onChange?.(next as any);
  }

  const shown = actualValue.slice(0, maxDisplayed);
  const overflow = actualValue.length - shown.length;

  return (
    <div className={cn("space-y-1.5", className)} ref={ref}>
      {label && (
        <label className="block text-sm font-medium text-foreground">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
      )}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            id={inputId}
            disabled={disabled}
            onBlur={onBlur}
            aria-invalid={Boolean(error) || undefined}
            className={cn(
              "flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border bg-background px-3 py-1.5 text-left text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/70 disabled:cursor-not-allowed disabled:opacity-60",
              error && "border-rose-400 focus:ring-rose-400"
            )}
          >
            <span className="flex flex-wrap items-center gap-1 flex-1 min-w-0">
              {actualValue.length === 0 && (
                <span className="text-muted-foreground/60">{placeholder}</span>
              )}
              {shown.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  {labelMap.get(v) ?? v}
                  {!disabled && (
                    <span
                      onClick={(e) => removeChip(v, e)}
                      role="button"
                      tabIndex={-1}
                      className="text-slate-500 hover:text-rose-600"
                    >
                      <X className="w-3 h-3" />
                    </span>
                  )}
                </span>
              ))}
              {overflow > 0 && (
                <span className="inline-flex items-center rounded-md bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-200">
                  +{overflow}
                </span>
              )}
            </span>
            <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", open && "rotate-180")} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            className="z-50 w-[--radix-popover-trigger-width] max-h-80 overflow-auto rounded-lg border border-border bg-card p-2 shadow-lg animate-in fade-in-80 zoom-in-95"
          >
            {options.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-slate-500">
                No options
              </div>
            )}
            <div className="space-y-1">
              {options.map((opt) => {
                const val = opt.value as string;
                const checked = actualValue.includes(val);
                return (
                  <label
                    key={val}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm cursor-pointer select-none",
                      "hover:bg-slate-100 dark:hover:bg-slate-800",
                      opt.disabled && "opacity-50 pointer-events-none"
                    )}
                  >
                    <Checkbox.Root
                      checked={checked}
                      onCheckedChange={() => toggleItem(val)}
                      disabled={opt.disabled}
                      className="flex h-4 w-4 items-center justify-center rounded border border-slate-300 dark:border-slate-600 bg-background data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground transition-colors"
                    >
                      <Checkbox.Indicator>
                        <Check className="w-3 h-3" />
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
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
});
GlobalMultiSelect.displayName = "GlobalMultiSelect";
