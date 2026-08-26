"use client";

import { forwardRef, useState, useId } from "react";
import { cn } from "@/lib/utils";
import { Search, Eye, EyeOff } from "lucide-react";

export interface GlobalInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  hint?: string;
  inputType?: React.InputHTMLAttributes<HTMLInputElement>["type"];
  showSearchIcon?: boolean;
  showPasswordToggle?: boolean;
}

export const GlobalInput = forwardRef<HTMLInputElement, GlobalInputProps>(
  function GlobalInput(
    {
      label,
      error,
      hint,
      inputType = "text",
      showSearchIcon,
      showPasswordToggle,
      className,
      id,
      required,
      disabled,
      onChange,
      ...rest
    },
    ref
  ) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;
    const [localValue, setLocalValue] = useState("");
    const [showPw, setShowPw] = useState(false);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      setLocalValue(e.target.value);
      onChange?.(e);
    }

    const actualType = showPasswordToggle
      ? showPw
        ? "text"
        : "password"
      : inputType;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground"
          >
            {label}
            {required && <span className="ml-0.5 text-rose-500">*</span>}
          </label>
        )}
        <div className="relative">
          {showSearchIcon && (
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          )}
          <input
            id={inputId}
            ref={ref}
            type={actualType}
            required={required}
            disabled={disabled}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={
              error ? errorId : hint ? hintId : undefined
            }
            onChange={handleChange}
            value={rest.value ?? localValue}
            className={cn(
              "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
              showSearchIcon && "pl-9",
              showPasswordToggle && "pr-9",
              error && "border-rose-400 focus-visible:ring-rose-400",
              disabled && "opacity-60 cursor-not-allowed",
              className
            )}
            {...rest}
          />
          {showPasswordToggle && (
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              tabIndex={-1}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
        {error && (
          <p id={errorId} className="text-xs font-medium text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={hintId} className="text-xs text-slate-500 dark:text-slate-400">
            {hint}
          </p>
        )}
      </div>
    );
  }
);
