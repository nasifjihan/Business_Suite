/**
 * LoginForm — React Hook Form + Zod validation + RTK useLoginMutation.
 *
 * Validation rules (copied from backend to stay in sync):
 *   email    → valid email
 *   password → min 8, uppercase, lowercase, digit, special character
 *
 * Two steps when the account has 2FA on: the password step returns a challenge
 * (no session) and the form swaps to a code prompt, which is exchanged for the
 * real session at POST /auth/2fa/verify.
 *
 * Post-login redirect paths:
 *   forceChangePassword = true → /change-password (Phase 3 UI)
 *   else → /dashboard
 */
"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, AlertTriangle, CheckCircle2, KeyRound, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { PasswordField } from "@/components/auth/PasswordField";
import { useLoginMutation, useVerifyTwoFactorMutation } from "@/lib/api/authEndpoints";
import type { LoginResponseData } from "@/lib/api/authEndpoints";
import { useAppDispatch } from "@/store/hooks";
import { setCredentials } from "@/store/slices/authSlice";

const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Please enter a valid email address."),
  password: z
    .string()
    .min(1, "Password is required.")
    .max(128, "Password is too long.")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$|^.{1,}$/,
      "Minimum 8 chars: 1 uppercase, 1 lowercase, 1 digit, 1 special character."
    ),
});
type LoginFormValues = z.infer<typeof LoginSchema>;

const REMEMBER_ME_KEY = "bs.auth.rememberEmail.v1";

/** Shared shape for a failed mutation: RTK wraps our envelope in `data`. */
function messageOf(error: unknown, fallback: string): string {
  const status = (error as { status?: number | string })?.status;
  if (status === 429 || status === "429") {
    return "Too many attempts. Please try again in 15 minutes.";
  }
  return (
    (error as { data?: { error?: { message?: string } } })?.data?.error?.message ?? fallback
  );
}

export default function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const dispatch = useAppDispatch();
  const expired = search.get("expired") === "1";

  /** Non-null once step 1 has returned a challenge. */
  const [challenge, setChallenge] = useState<{ token: string; email: string } | null>(null);
  const [code, setCode] = useState("");
  /**
   * Set only when a real session has been stored. Deliberately not `isSuccess`
   * from the login mutation: that flips to true as soon as step 1 answers with
   * a challenge, which would show "Signed in" while the code prompt is up.
   */
  const [signedIn, setSignedIn] = useState(false);

  const rememberedEmail =
    typeof window !== "undefined"
      ? window.localStorage.getItem(REMEMBER_ME_KEY) ?? ""
      : "";

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: rememberedEmail, password: "" },
    mode: "onTouched",
  });
  const emailValue = watch("email");

  const [loginTrigger, { error: rtkError, isLoading: rtkLoading }] = useLoginMutation();
  const [
    verifyTrigger,
    { error: verifyError, isLoading: verifyLoading },
  ] = useVerifyTwoFactorMutation();

  /** Store the session and route. Shared by both login paths. */
  const finishLogin = useCallback(
    (payload: LoginResponseData) => {
      dispatch(
        setCredentials({
          accessToken: payload.accessToken,
          user: payload.user,
          permissions: payload.permissions ?? [],
        })
      );
      setSignedIn(true);
      // Let the user see success for 300ms then redirect
      setTimeout(() => {
        if (payload.user.mustChangePassword) {
          router.replace("/change-password");
        } else {
          router.replace("/dashboard");
        }
      }, 300);
    },
    [dispatch, router]
  );

  const submit = useCallback(
    async (values: LoginFormValues) => {
      // "Remember me" = store only the EMAIL (never the password!) in localStorage.
      // Safe — local storage for pre-fill = no credential exposure.
      try {
        window.localStorage.setItem(REMEMBER_ME_KEY, values.email.trim());
      } catch {
        /* ignore */
      }

      const email = values.email.trim().toLowerCase();
      const res = await loginTrigger({ email, password: values.password });

      if ("data" in res && res.data?.success) {
        const payload = res.data.data;
        if ("twoFactorRequired" in payload) {
          // No session yet — hold the challenge and swap to the code prompt.
          setChallenge({ token: payload.challengeToken, email });
          setCode("");
          return;
        }
        finishLogin(payload);
      }
    },
    [finishLogin, loginTrigger]
  );

  const submitCode = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!challenge || !code.trim()) return;
      const res = await verifyTrigger({
        challengeToken: challenge.token,
        code: code.trim(),
      });
      if ("data" in res && res.data?.success) {
        finishLogin(res.data.data);
      }
    },
    [challenge, code, finishLogin, verifyTrigger]
  );

  // Stringify any RTK error shape (Unprocessable / Unauthorized) for display.
  function errorForField(field: "email" | "password" | "non_field"): string | undefined {
    const fe = errors[field === "non_field" ? "root" : field]?.message;
    if (fe) return fe;
    if (!rtkError) return undefined;
    // RTK wraps errors as FetchBaseQueryError: { status, data } where data = our envelope.
    const status = (rtkError as { status?: number | string }).status;
    if (status === 429 || status === "429") {
      return "Too many failed attempts. Please try again in 15 minutes.";
    }
    if (status === 403 || status === "403") {
      return "This account has been disabled. Contact your administrator.";
    }
    const errData = (rtkError as { data?: { error?: { message?: string; code?: string } } }).data?.error;
    if (errData?.message) {
      if (field === "non_field") return errData.message;
      return undefined;
    }
    return undefined;
  }

  if (challenge) {
    return (
      <form onSubmit={submitCode} className="space-y-5" noValidate>
        <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800 dark:border-sky-800/40 dark:bg-sky-950/30 dark:text-sky-200">
          <KeyRound className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            Enter the 6-digit code from your authenticator app for{" "}
            <span className="font-medium">{challenge.email}</span>. A recovery code
            works here too.
          </div>
        </div>

        {verifyError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/30 dark:text-rose-200"
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>{messageOf(verifyError, "That code was not accepted. Please try again.")}</div>
          </div>
        )}

        {signedIn && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-200"
          >
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            <div>Signed in — redirecting…</div>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="totp-code" className="block text-sm font-medium text-foreground">
            Verification code <span className="ml-0.5 text-rose-500">*</span>
          </label>
          <input
            id="totp-code"
            autoFocus
            inputMode="text"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={cn(
              "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm tracking-[0.2em]",
              "placeholder:tracking-normal placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
              "border-input hover:border-ring/60"
            )}
          />
        </div>

        <button
          type="submit"
          disabled={!code.trim() || verifyLoading || signedIn}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors",
            "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
            "disabled:pointer-events-none disabled:opacity-60"
          )}
        >
          {verifyLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {signedIn ? "Signed in ✓" : verifyLoading ? "Verifying…" : "Verify and sign in"}
        </button>

        <button
          type="button"
          onClick={() => {
            setChallenge(null);
            setCode("");
          }}
          className="mx-auto flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </button>
      </form>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(submit)}
      className="space-y-5"
      noValidate
      aria-describedby={expired ? "session-expired" : undefined}
    >
      {expired && (
        <div
          id="session-expired"
          role="status"
          className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800 dark:border-violet-800/40 dark:bg-violet-950/30 dark:text-violet-200"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            Your session expired due to inactivity. Please sign in again to
            continue.
          </div>
        </div>
      )}

      {errorForField("non_field") && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/30 dark:text-rose-200"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>{errorForField("non_field")}</div>
        </div>
      )}

      {signedIn && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-200"
        >
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <div>Signed in — redirecting…</div>
        </div>
      )}

      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block text-sm font-medium text-foreground"
        >
          Email <span className="ml-0.5 text-rose-500">*</span>
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          aria-invalid={Boolean(errors.email) || undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
          onBlur={(e) => {
            // Normalize to lowercase on blur for UX.
            setValue("email", e.target.value.trim().toLowerCase(), {
              shouldValidate: true,
            });
          }}
          className={cn(
            "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm",
            "placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
            errors.email
              ? "border-rose-400 focus-visible:ring-rose-400/60"
              : "border-input hover:border-ring/60"
          )}
        />
        {errors.email && (
          <p
            id="email-error"
            role="alert"
            className="text-xs font-medium text-rose-500"
          >
            {errors.email.message}
          </p>
        )}
      </div>

      <PasswordField
        label="Password"
        autoComplete="current-password"
        placeholder="Enter your password"
        required
        hint="Minimum 8 characters, including uppercase, lowercase, digit, and special character."
        error={errors.password?.message}
        {...register("password")}
      />

      <div className="flex items-center justify-between pt-0.5">
        <label className="inline-flex items-center gap-2 text-sm text-foreground select-none">
          <input
            type="checkbox"
            defaultChecked={Boolean(emailValue || rememberedEmail)}
            className="h-4 w-4 rounded border-input text-primary focus:ring-primary/70"
            onChange={(e) => {
              if (!e.target.checked) {
                try {
                  window.localStorage.removeItem(REMEMBER_ME_KEY);
                } catch {
                  /* ignore */
                }
              }
            }}
          />
          Remember my email
        </label>
        <a
          href="/forgot-password"
          className="text-sm font-medium text-primary hover:underline"
        >
          Forgot password?
        </a>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || rtkLoading || signedIn}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors",
          "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          "disabled:pointer-events-none disabled:opacity-60"
        )}
      >
        {(isSubmitting || rtkLoading) && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
        {signedIn ? "Signed in ✓" : rtkLoading ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-center text-xs text-muted-foreground/80">
        Local dev default credentials:
        <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          admin@example.com / Admin@123
        </code>
      </p>
    </form>
  );
}
