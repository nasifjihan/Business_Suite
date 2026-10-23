/**
 * TwoFactorCard — the profile page's TOTP section.
 *
 * Four visual states, each mapped to a step of the enrolment lifecycle:
 *   off      → offer to start enrolment
 *   setup    → show the QR code / manual secret, ask for a live code
 *   codes    → show the recovery codes exactly once, with a "I saved them" exit
 *   on       → show status + the remaining-code count, offer a password-gated disable
 *
 * The recovery codes are never fetchable again, so the `codes` state is the
 * only place they are ever visible. Leaving it is the user's acknowledgement
 * that they were copied.
 */
"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalPasswordField } from "@/components/form/GlobalPasswordField";
import {
  useDisableTwoFactorMutation,
  useEnableTwoFactorMutation,
  useSetupTwoFactorMutation,
  useTwoFactorStatusQuery,
} from "@/lib/api/authEndpoints";
import type { TwoFactorSetupData } from "@/lib/api/authEndpoints";

type Mode = "off" | "setup" | "codes" | "disable";

function messageOf(error: unknown, fallback: string): string {
  return (
    (error as { data?: { error?: { message?: string } } })?.data?.error?.message ??
    fallback
  );
}

function Banner({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  const styles =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
      : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border p-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}

export function TwoFactorCard() {
  const { data, isLoading, isError } = useTwoFactorStatusQuery();
  const status = data?.data;

  const [mode, setMode] = useState<Mode>("off");
  const [setup, setSetup] = useState<TwoFactorSetupData | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const [startSetup, setupState] = useSetupTwoFactorMutation();
  const [enable, enableState] = useEnableTwoFactorMutation();
  const [disable, disableState] = useDisableTwoFactorMutation();

  const enabled = status?.enabled ?? false;

  async function beginSetup() {
    setCode("");
    const res = await startSetup();
    if ("data" in res && res.data?.success) {
      setSetup(res.data.data);
      setMode("setup");
    }
  }

  async function confirmCode(e: React.FormEvent) {
    e.preventDefault();
    const res = await enable({ code: code.trim() });
    if ("data" in res && res.data?.success) {
      setRecoveryCodes(res.data.data.recoveryCodes);
      setSetup(null);
      setCode("");
      setMode("codes");
    }
  }

  async function confirmDisable(e: React.FormEvent) {
    e.preventDefault();
    const res = await disable({ password });
    if ("data" in res && res.data?.success) {
      setPassword("");
      setMode("off");
    }
  }

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the codes stay selectable on screen */
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Checking two-factor status…
      </section>
    );
  }

  if (isError) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6">
        <Banner tone="error">Could not load your two-factor settings. Refresh the page.</Banner>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h2 className="text-base font-semibold">Two-factor authentication</h2>
        <span
          className={`ml-auto rounded-full border px-2 py-0.5 text-xs font-medium ${
            enabled
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
              : "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
          }`}
        >
          {enabled ? "Enabled" : "Not enabled"}
        </span>
      </div>

      {/* ── Enabled ──────────────────────────────────────────────────── */}
      {enabled && mode !== "disable" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sign-in requires a 6-digit code from your authenticator app.
            {status && status.recoveryCodesRemaining > 0 ? (
              <> You have {status.recoveryCodesRemaining} unused recovery code
                {status.recoveryCodesRemaining === 1 ? "" : "s"} left.</>
            ) : (
              <> You have no recovery codes left — if you lose your device you will
                need an administrator to reset 2FA.</>
            )}
          </p>
          {status?.recoveryCodesRemaining === 0 && (
            <Banner tone="error">
              No recovery codes remain. Ask an administrator to reset two-factor
              authentication for your account.
            </Banner>
          )}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => { setPassword(""); setMode("disable"); }}>
              <ShieldOff className="w-4 h-4 mr-1.5" /> Disable 2FA
            </Button>
          </div>
        </div>
      )}

      {/* ── Disable (password required) ──────────────────────────────── */}
      {enabled && mode === "disable" && (
        <form onSubmit={confirmDisable} className="space-y-4" noValidate>
          <p className="text-sm text-muted-foreground">
            Confirm your password to turn two-factor authentication off. Your
            recovery codes will be discarded.
          </p>
          {disableState.isError && (
            <Banner tone="error">{messageOf(disableState.error, "Could not disable 2FA.")}</Banner>
          )}
          <GlobalPasswordField
            label="Current password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setMode("off")}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={!password || disableState.isLoading}
            >
              {disableState.isLoading ? "Disabling…" : "Disable 2FA"}
            </Button>
          </div>
        </form>
      )}

      {/* ── Not enabled ──────────────────────────────────────────────── */}
      {!enabled && mode === "off" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Add a second step to sign-in using an authenticator app such as Google
            Authenticator, Authy, or 1Password.
          </p>
          {setupState.isError && (
            <Banner tone="error">{messageOf(setupState.error, "Could not start setup.")}</Banner>
          )}
          <div className="flex justify-end">
            <Button size="sm" onClick={beginSetup} disabled={setupState.isLoading}>
              {setupState.isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Preparing…
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 mr-1.5" /> Enable 2FA
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Setup: scan, then confirm ────────────────────────────────── */}
      {!enabled && mode === "setup" && setup && (
        <div className="space-y-4">
          <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
            <li>Scan this QR code with your authenticator app.</li>
            <li>Enter the 6-digit code it shows to confirm.</li>
          </ol>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, not a remote asset */}
            <img
              src={setup.qrDataUrl}
              alt="Two-factor authentication QR code"
              width={180}
              height={180}
              className="rounded-lg border border-border bg-white p-1"
            />
            <div className="min-w-0 flex-1 w-full">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Can&apos;t scan? Enter this key manually:
              </p>
              <code className="block break-all rounded-lg bg-slate-100 px-2.5 py-2 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {setup.secret}
              </code>
            </div>
          </div>

          {enableState.isError && (
            <Banner tone="error">{messageOf(enableState.error, "That code was not accepted.")}</Banner>
          )}

          <form onSubmit={confirmCode} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2" noValidate>
            <label className="flex-1 space-y-1.5">
              <span className="block text-sm font-medium text-foreground">Verification code</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm tracking-[0.2em] placeholder:tracking-normal placeholder:text-muted-foreground/60 hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              />
            </label>
            <Button type="submit" disabled={code.length !== 6 || enableState.isLoading}>
              {enableState.isLoading ? "Confirming…" : "Confirm and enable"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setSetup(null); setMode("off"); }}>
              Cancel
            </Button>
          </form>
        </div>
      )}

      {/* ── Recovery codes (shown once) ───────────────────────────────── */}
      {mode === "codes" && (
        <div className="space-y-4">
          <Banner tone="success">
            Two-factor authentication is on. Save these recovery codes now — they
            are shown only once.
          </Banner>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs">
            {recoveryCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={copyCodes}>
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1.5" /> Copy all
                </>
              )}
            </Button>
            <Button size="sm" onClick={() => { setRecoveryCodes([]); setMode("off"); }}>
              I&apos;ve saved them
            </Button>
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Each code works once. Store them somewhere offline — anyone with a code
            can sign in as you.
          </p>
        </div>
      )}
    </section>
  );
}
