"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, Loader2, MailCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useForgotPasswordMutation } from "@/lib/api/authEndpoints";

const Schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Please enter a valid email address."),
});
type Values = z.infer<typeof Schema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(Schema), mode: "onTouched" });
  const [trigger, { isLoading, isSuccess, error }] = useForgotPasswordMutation();

  const onSubmit = useCallback(
    async (values: Values) => {
      await trigger({ email: values.email.trim().toLowerCase() });
    },
    [trigger]
  );

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email. If an account exists, you&apos;ll receive a password
          reset link. (Local dev prints the link in the backend terminal.)
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm space-y-5">
        {isSuccess && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-200"
          >
            <MailCheck className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              If there is an account with that email, a password reset link has
              been sent. Open the backend terminal to copy it in local dev.
            </div>
          </div>
        )}

        {error && (error as { status?: unknown })?.status !== 429 && !isSuccess && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/30 dark:text-rose-200"
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              {((error as { data?: { error?: { message?: string } } }).data?.error
                ?.message as string) ??
                "Something went wrong. Please try again in a moment."}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground"
            >
              Work email <span className="ml-0.5 text-rose-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={Boolean(errors.email) || undefined}
              {...register("email")}
              className={cn(
                "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm",
                "placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                errors.email
                  ? "border-rose-400 focus-visible:ring-rose-400/60"
                  : "border-input hover:border-ring/60"
              )}
            />
            {errors.email && (
              <p role="alert" className="text-xs font-medium text-rose-500">
                {errors.email.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isLoading || isSuccess}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors",
              "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
              "disabled:pointer-events-none disabled:opacity-60"
            )}
          >
            {(isSubmitting || isLoading) && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {isSuccess ? "Check your inbox / terminal ✓" : isLoading ? "Sending link…" : "Send reset link"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/login")}
            className="w-full text-center text-sm text-primary hover:underline"
          >
            ← Back to sign in
          </button>
        </form>
      </div>
    </div>
  );
}
