"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PasswordField } from "@/components/auth/PasswordField";
import { useResetPasswordMutation } from "@/lib/api/authEndpoints";

const Schema = z
  .object({
    newPassword: z
      .string()
      .min(1, "Required.")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
        "Min 8 chars, uppercase, lowercase, digit, and 1 special character."
      ),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type Values = z.infer<typeof Schema>;

function Inner() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token");
  const [tokenInvalid, setTokenInvalid] = useState(!token);

  useEffect(() => {
    if (!token) setTokenInvalid(true);
  }, [token]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(Schema),
    mode: "onChange",
  });

  const [trigger, { isLoading, error, isSuccess }] = useResetPasswordMutation();
  const newPw = watch("newPassword");

  const submit = useCallback(
    async (values: Values) => {
      if (!token) return;
      await trigger({ token, newPassword: values.newPassword });
    },
    [token, trigger]
  );

  if (tokenInvalid) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/30 dark:text-rose-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h2 className="font-semibold">Invalid reset link</h2>
              <p className="text-sm">
                This password reset link is missing a valid token. It may have
                been copied incorrectly or has already been used. Please
                request a new password reset.
              </p>
              <button
                type="button"
                onClick={() => router.replace("/forgot-password")}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
              >
                Request a new reset link
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">
          This link expires 15 minutes after it was created and can only be
          used once.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm space-y-5">
        {isSuccess && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-200"
          >
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              Password changed successfully. All other sessions have been
              logged out for your security.
              <button
                type="button"
                onClick={() => router.replace("/login")}
                className="ml-2 font-semibold underline hover:no-underline"
              >
                Go to sign in →
              </button>
            </div>
          </div>
        )}

        {error && !isSuccess && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/30 dark:text-rose-200"
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              {((error as { data?: { error?: { message?: string } } }).data
                ?.error?.message as string) ??
                "Reset link is invalid, expired, or already used."}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
          <PasswordField
            label="New password"
            name="newPassword"
            placeholder="New password"
            required
            autoComplete="new-password"
            showStrengthMeter
            error={errors.newPassword?.message}
            {...register("newPassword")}
          />

          <PasswordField
            label="Confirm new password"
            name="confirmPassword"
            placeholder="Type it again"
            required
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            hint={newPw ? "Make sure it matches the password above." : undefined}
            {...register("confirmPassword")}
          />

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
            {isSuccess
              ? "Password updated ✓"
              : isLoading
              ? "Updating password…"
              : "Update password & sign me out everywhere"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-md space-y-6">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm flex items-center justify-center h-64">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </div>
      }
    >
      <Inner />
    </Suspense>
  );
}
