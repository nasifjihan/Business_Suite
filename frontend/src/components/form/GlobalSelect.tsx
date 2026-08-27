"use client";

import { forwardRef, useId, useMemo } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import {
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface GlobalSelectProps {
  label?: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  name?: string;
}

export const GlobalSelect = forwardRef<HTMLButtonElement, GlobalSelectProps>(
  function GlobalSelect(
    {
      label,
      error,
      hint,
      placeholder = "Select...",
      options,
      value,
      onChange,
      onBlur,
      disabled,
      required,
      id,
      className,
      name,
    },
    forwardedRef
  ) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;
    const triggerId = `${inputId}-trigger`;

    const labelMap = useMemo(() => {
      const map = new Map<string, string>();
      for (const o of options) map.set(o.value, o.label);
      return map;
    }, [options]);

    return (
      <div className={cn("space-y-1.5", className)}>
        {label && (
          <label
            htmlFor={triggerId}
            className="block text-sm font-medium text-foreground"
          >
            {label}
            {required && <span className="ml-0.5 text-rose-500">*</span>}
          </label>
        )}
        {name && (
          <input
            type="hidden"
            name={name}
            value={value ?? ""}
            // Hidden input just carries the name/value pair for form.submit.
            // ref is passed to trigger when no name prop.
          />
        )}
        <SelectPrimitive.Root
          value={value ?? undefined}
          onValueChange={(v) => onChange?.(v)}
          disabled={disabled}
          name={undefined}
        >
          <SelectPrimitive.Trigger
            id={triggerId}
            ref={name ? undefined : forwardedRef}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={
              error ? errorId : hint ? hintId : undefined
            }
            onBlur={onBlur}
            className={cn(
              "flex h-10 w-full items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/70 disabled:cursor-not-allowed disabled:opacity-60 placeholder:text-muted-foreground/60",
              error && "border-rose-400 focus:ring-rose-400"
            )}
          >
            <SelectPrimitive.Value placeholder={placeholder} className={cn(!value && "text-muted-foreground/60")}>
              {value ? labelMap.get(value) : placeholder}
            </SelectPrimitive.Value>
            <SelectPrimitive.Icon asChild>
              <ChevronDown className="w-4 h-4 text-slate-400 opacity-80" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>
          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              position="popper"
              sideOffset={4}
              className="z-50 max-h-80 min-w-[--radix-select-trigger-width] overflow-hidden rounded-lg border border-border bg-card shadow-lg animate-in fade-in-80 zoom-in-95"
            >
              <SelectPrimitive.ScrollUpButton className="flex h-8 items-center justify-center bg-card text-slate-400">
                <ChevronUp className="w-4 h-4" />
              </SelectPrimitive.ScrollUpButton>
              <SelectPrimitive.Viewport className="p-1">
                <SelectPrimitive.Group>
                  {options.length === 0 && (
                    <div className="px-3 py-6 text-center text-xs text-slate-500">
                      No options
                    </div>
                  )}
                  {options.map((opt) => (
                    <SelectPrimitive.Item
                      key={opt.value}
                      value={opt.value}
                      disabled={opt.disabled}
                      className={cn(
                        "relative flex w-full cursor-pointer select-none items-center rounded-md py-2 pl-8 pr-2 text-sm outline-none",
                        "focus:bg-slate-100 dark:focus:bg-slate-800 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                      )}
                    >
                      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        <SelectPrimitive.ItemIndicator>
                          <Check className="w-4 h-4 text-primary" />
                        </SelectPrimitive.ItemIndicator>
                      </span>
                      <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                    </SelectPrimitive.Item>
                  ))}
                </SelectPrimitive.Group>
              </SelectPrimitive.Viewport>
              <SelectPrimitive.ScrollDownButton className="flex h-8 items-center justify-center bg-card text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </SelectPrimitive.ScrollDownButton>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
        {error && (
          <p
            id={errorId}
            className="text-xs font-medium text-rose-600 dark:text-rose-400"
          >
            {error}
          </p>
        )}
        {!error && hint && (
          <p
            id={hintId}
            className="text-xs text-slate-500 dark:text-slate-400"
          >
            {hint}
          </p>
        )}
      </div>
    );
  }
);
GlobalSelect.displayName = "GlobalSelect";
