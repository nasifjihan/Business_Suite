"use client";

import Link from "next/link";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Business Suite";
  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="text-center space-y-1">
        <Link href="/" className="inline-block text-left">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome back 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to access your {appName} workspace.
          </p>
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <LoginForm />
      </div>

      <p className="text-center text-xs text-muted-foreground/80">
        Protected by end-to-end signed JWTs &amp; Secure HttpOnly refresh
        cookies.
      </p>
    </div>
  );
}
