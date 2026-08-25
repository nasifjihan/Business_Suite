"use client";

/**
 * PHASE 1 EXIT CRITERIA TEST PAGE
 * -------------------------------------------------------------------
 * This page verifies the full Next.js → Express → PostgreSQL handshake
 * using the app's real infrastructure (Redux Provider + RTK Query via
 * apiSlice). If all three checkmarks render green, Phase 1 is done.
 *
 * What it proves:
 *   1. BACKEND ONLINE        : fetch() reaches Express on :5000
 *   2. DATABASE CONNECTED    : Prisma adapter-pg ran SELECT 1 on Postgres 18
 *   3. RTK QUERY WORKING     : apiSlice cached result in Redux store
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle, Database, Server, Cpu, ArrowRight } from "lucide-react";
import { useGetHealthQuery } from "@/lib/api/healthEndpoints";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

type Step = {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "pending" | "loading" | "ok" | "fail";
  detail?: string;
  latencyMs?: number;
};

export default function DashboardHealthTestPage() {
  // Check #1 + #2: RTK Query real HTTP call through Redux → apiSlice → backend → postgres
  const rtk = useGetHealthQuery(undefined, {
    pollingInterval: 0,
    refetchOnMountOrArgChange: true,
  });

  // Check #3: Independent fetch() call, just measuring the raw backend latency
  const [direct, setDirect] = useState<{
    status: Step["status"];
    latencyMs?: number;
    detail?: string;
  }>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const started = performance.now();
      try {
        const res = await fetch(`${BACKEND_URL}/health`, {
          credentials: "include",
          cache: "no-store",
        });
        const latency = Math.round(performance.now() - started);
        const text = await res.text();
        if (cancelled) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 140)}`);
        setDirect({ status: "ok", latencyMs: latency, detail: text });
      } catch (err) {
        if (cancelled) return;
        const m = err instanceof Error ? err.message : String(err);
        setDirect({ status: "fail", detail: m });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const steps: Step[] = [
    {
      key: "backend",
      title: "Backend Online",
      description: `GET ${BACKEND_URL}/health returns 200 (raw fetch)`,
      icon: Server,
      status: direct.status,
      latencyMs: direct.latencyMs,
      detail: direct.detail,
    },
    {
      key: "db",
      title: "PostgreSQL 18 Connected",
      description: "HealthService.check() → prisma.$queryRaw(`SELECT 1`) succeeds via PrismaPg driver adapter",
      icon: Database,
      status: rtk.isLoading ? "loading" : rtk.isError ? "fail" : rtk.data?.dbOk ? "ok" : "fail",
      latencyMs:
        typeof rtk.fulfilledTimeStamp === "number" && typeof rtk.startedTimeStamp === "number"
          ? Math.round(rtk.fulfilledTimeStamp - rtk.startedTimeStamp)
          : undefined,
      detail: rtk.isError
        ? "RTK error — see DevTools Network tab"
        : rtk.data
        ? `status=${rtk.data.status} · timestamp=${rtk.data.timestamp} · version=${rtk.data.version}`
        : undefined,
    },
    {
      key: "rtk",
      title: "Redux + RTK Query Working",
      description: "apiSlice.injectEndpoints mounted, reducer cached result at state.api.queries['getHealth(undefined)']",
      icon: Cpu,
      status: rtk.isSuccess ? "ok" : rtk.isLoading ? "loading" : "fail",
      detail: rtk.isSuccess
        ? `cache size: 1 query fulfilled · refetch() will increment cache sequence`
        : undefined,
    },
  ];

  const allOk = steps.every((s) => s.status === "ok");
  const anyFail = steps.some((s) => s.status === "fail");

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">3-Tier Connectivity Test</h1>
        <p className="text-muted mt-1 text-sm">
          Phase 1 exit criteria — all 3 rows below must render ✅.
        </p>
      </div>

      <div
        className={cn(
          "rounded-xl border p-4 flex items-center gap-3",
          allOk
            ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900"
            : anyFail
            ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
            : "bg-slate-50 dark:bg-slate-900/40 border-border"
        )}
      >
        {allOk ? (
          <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400 shrink-0" />
        ) : anyFail ? (
          <XCircle className="w-8 h-8 text-red-600 dark:text-red-400 shrink-0" />
        ) : (
          <Loader2 className="w-8 h-8 text-slate-500 animate-spin shrink-0" />
        )}
        <div className="min-w-0">
          <div className="font-semibold">
            {allOk
              ? "All 3 tiers connected successfully — Phase 1 exit criteria met."
              : anyFail
              ? "One or more checks failed — see below for detail."
              : "Checking frontend ↔ backend ↔ postgres..."}
          </div>
          <div className="text-sm text-muted">
            {allOk
              ? "Proceed to Phase 2 — Authentication + Token Refresh."
              : anyFail
              ? "Troubleshoot: confirm npm run dev on backend, DATABASE_URL matches postgres password, CORS FRONTEND_URL = http://localhost:3000."
              : "Requests in-flight (usually < 500ms on localhost)."}
          </div>
        </div>
      </div>

      <ol className="space-y-3">
        {steps.map((s) => (
          <li key={s.key} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                  s.status === "ok"
                    ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400"
                    : s.status === "fail"
                    ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                    : s.status === "loading"
                    ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                    : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-400"
                )}
              >
                {s.status === "loading" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : s.status === "ok" ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : s.status === "fail" ? (
                  <XCircle className="w-5 h-5" />
                ) : (
                  <s.icon className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{s.title}</span>
                  {typeof s.latencyMs === "number" && (
                    <span className="text-xs font-mono text-muted">
                      {s.latencyMs} ms
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted mt-0.5">{s.description}</p>
                {s.detail && (
                  <pre
                    className={cn(
                      "mt-2 rounded-md text-xs p-2 overflow-x-auto font-mono whitespace-pre-wrap break-all",
                      s.status === "fail"
                        ? "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200"
                        : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300"
                    )}
                  >
                    {s.detail}
                  </pre>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3 pt-2">
        <Button variant="outline" onClick={() => rtk.refetch()}>
          {rtk.isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Re-run checks
        </Button>
        <Link href="/dashboard">
          <Button>Go to dashboard <ArrowRight className="w-4 h-4" /></Button>
        </Link>
      </div>
    </div>
  );
}
