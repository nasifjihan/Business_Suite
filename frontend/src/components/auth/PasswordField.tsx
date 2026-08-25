/**
 * Password Field reusable component:
 *   - Show/Hide eye toggle button (eye icon / eye-off icon)
 *   - Password Strength meter (4 bars: 0=blank, 4=unbreakable)
 *   - Works with React Hook Form via Controller or plain onChange
 *   - Accessible: aria-describedby linking error message span
 */
"use client";

import { useState, forwardRef } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function measurePasswordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score as 0 | 1 | 2 | 3 | 4;
}

export interface PasswordFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  hint?: string;
  showStrengthMeter?: boolean;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(
    { label, error, hint, showStrengthMeter = false, className, onChange, id, required, ...rest },
    ref
  ) {
    const [show, setShow] = useState(false);
    const [localValue, setLocalValue] = useState<string>("");
    const inputId = id ?? rest.name ?? `password-${Math.random().toString(36).slice(2, 8)}`;
    const strength = measurePasswordStrength(localValue);
    const strengthLabels = ["Too weak", "Weak", "Fair", "Good", "Strong"];
    const strengthColors = [
      "bg-slate-200",
      "bg-red-400",
      "bg-orange-400",
      "bg-yellow-400",
      "bg-green-500",
    ];

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      setLocalValue(e.target.value);
      onChange?.(e);
    }

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
          <input
            id={inputId}
            ref={ref}
            required={required}
            {...rest}
            type={show ? "text" : "password"}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={
              error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            onChange={handleChange}
            className={cn(
              "w-full rounded-lg border bg-background px-3 py-2 pr-10 text-sm shadow-sm transition-colors",
              "placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
              error
                ? "border-rose-400 focus-visible:ring-rose-400/60"
                : "border-input hover:border-ring/60",
              className
            )}
          />
          <button
            type="button"
            aria-label={show ? "Hide password" : "Show password"}
            onClick={() => setShow((s) => !s)}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-muted-foreground hover:text-foreground focus:outline-none"
          >
            {show ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>

        {showStrengthMeter && (
          <div className="space-y-1 pt-1">
            <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-full transition-colors duration-300",
                    i < strength ? strengthColors[strength] : "bg-border"
                  )}
                />
              ))}
            </div>
            {localValue && (
              <p className="text-xs text-muted-foreground">
                Strength:{" "}
                <span
                  className={cn(
                    "font-medium",
                    strength <= 1 && "text-rose-500",
                    strength === 2 && "text-orange-500",
                    strength === 3 && "text-yellow-600",
                    strength === 4 && "text-green-600"
                  )}
                >
                  {strengthLabels[strength]}
                </span>
                {strength < 4 && (
                  <span className="ml-2 text-muted-foreground/80">
                    (Use ≥12 chars, uppercase, lowercase, digit, &amp; special)
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        {error ? (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="text-xs font-medium text-rose-500"
          >
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);

export default PasswordField;
