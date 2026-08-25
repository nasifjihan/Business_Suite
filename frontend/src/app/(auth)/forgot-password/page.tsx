export default function ForgotPasswordPage() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-bold tracking-tight">Forgot password</h1>
      <p className="mt-1 text-sm text-muted">Phase 2 implementation. Enter your email to receive a reset link.</p>
      <form className="mt-6 space-y-4" onSubmit={(e) => e.preventDefault()}>
        <input type="email" disabled defaultValue="you@company.com"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        <button disabled type="submit"
          className="w-full rounded-lg bg-primary text-primary-foreground font-medium py-2.5 disabled:opacity-50">
          Send reset link (Phase 2)
        </button>
        <p className="text-center text-sm text-muted">
          <a className="text-primary hover:underline" href="/login">← Back to sign in</a>
        </p>
      </form>
    </div>
  );
}
