"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, CheckCircle2, Loader2, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";
import { PasswordField } from "@/components/auth/PasswordField";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearCredentials } from "@/store/slices/authSlice";
import { useChangePasswordMutation, useLogoutMutation } from "@/lib/api/authEndpoints";

const Schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z
      .string()
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
        "Min 8 chars, uppercase, lowercase, digit, and 1 special character."
      ),
    confirmPassword: z.string().min(1, "Please confirm."),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "New password must be different from the current one.",
    path: ["newPassword"],
  });
type Values = z.infer<typeof Schema>;

export default function ChangePasswordPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [changePwTrigger, { isLoading, error: rtkError, isSuccess }] = useChangePasswordMutation();
  const [logoutTrigger] = useLogoutMutation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<Values>({ resolver: zodResolver(Schema), mode: "onChange" });

  const submit = useCallback(
    async (values: Values) => {
      const res = await changePwTrigger({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      if ("error" in res && res.error) {
        const msg =
          (res.error as { data?: { error?: { message?: string } } }).data?.error
            ?.message ?? "Failed to update password.";
        if (/current password/i.test(msg)) {
          setError("currentPassword", { message: msg });
        } else if (/different from the current|same as current/i.test(msg)) {
          setError("newPassword", { message: msg });
        } else if (/match/i.test(msg)) {
          setError("confirmPassword", { message: msg });
        } else if (/policy|uppercase|lowercase|digit|special|character/i.test(msg)) {
          setError("newPassword", { message: msg });
        } else {
          setError("root", { message: msg });
        }
        return;
      }
      // Success! backend already revoked all refresh tokens & cleared cookie.
      dispatch(clearCredentials());
      await logoutTrigger();
      router.replace("/login?changed=1");
    },
    [changePwTrigger, dispatch, logoutTrigger, router, setError]
  );

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 py-10">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Change your password</h1>
        <p className="text-sm text-muted-foreground">
          You must choose a new unique password before using {user ? user.email : "this account"}.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm space-y-5">
        {isSuccess && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-200"
          >
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            <div>Password changed. Redirecting to sign in…</div>
          </div>
        )}

        {errors.root && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/30 dark:text-rose-200"
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>{errors.root.message}</div>
          </div>
        )}

        {rtkError &&
          (rtkError as { status?: unknown }).status !== 422 &&
          !isSubmitting &&
          !isSuccess &&
          !errors.root && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/30 dark:text-rose-200"
            >
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                {
                  (rtkError as { data?: { error?: { message?: string } } }).data
                    ?.error?.message
                }
              </div>
            </div>
          )}

        {!isSuccess && !errors.root && !rtkError && isSubmitting === false && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-200"
          >
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              For security, you&apos;re required to change the default seed password on your first login.
              After submitting, all other sessions for this account will be automatically logged out.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
          <PasswordField
            label="Current password"
            name="currentPassword"
            required
            autoComplete="current-password"
            error={errors.currentPassword?.message}
            {...register("currentPassword")}
          />

          <PasswordField
            label="New password"
            name="newPassword"
            required
            autoComplete="new-password"
            showStrengthMeter
            error={errors.newPassword?.message}
            {...register("newPassword")}
          />

          <PasswordField
            label="Confirm new password"
            name="confirmPassword"
            required
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                dispatch(clearCredentials());
                logoutTrigger();
                router.replace("/login");
              }}
              className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Sign out instead
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoading || isSuccess}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors",
                "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                "disabled:pointer-events-none disabled:opacity-60"
              )}
            >
              {(isSubmitting || isLoading) && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSuccess
                ? "Redirecting to sign in…"
                : isLoading
                ? "Updating password…"
                : "Update password &amp; sign out everywhere"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
