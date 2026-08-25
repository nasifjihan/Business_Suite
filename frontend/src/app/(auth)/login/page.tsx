export default function LoginPage() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Business Suite";
  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-bold tracking-tight">Sign in to {appName}</h1>
      <p className="mt-1 text-sm text-muted">
        Phase 2 (Auth) will implement this form. Default seed creds in Phase 3:
        <code className="mt-2 block rounded bg-slate-100 dark:bg-slate-800 p-2 text-xs font-mono text-slate-700 dark:text-slate-200">
          admin@example.com / Admin@123
        </code>
      </p>
      <form className="mt-6 space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" disabled defaultValue="admin@example.com"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input type="password" disabled defaultValue="••••••••"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>
        <button disabled type="submit"
          className="w-full rounded-lg bg-primary text-primary-foreground font-medium py-2.5 transition hover:opacity-90 disabled:opacity-50">
          Sign in (Phase 2)
        </button>
        <p className="text-center text-sm text-muted">
          <a className="text-primary hover:underline" href="/forgot-password">Forgot password?</a>
        </p>
      </form>
    </div>
  );
}
