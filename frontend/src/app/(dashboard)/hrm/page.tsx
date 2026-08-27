"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Calendar,
  CheckCircle2,
  FileClock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { useGetHRReportSummaryQuery } from "@/lib/api/hrmEndpoints";
import type { AttendanceStatus } from "@/lib/api/hrmEndpoints";

const ATTENDANCE_CONFIG: Record<
  AttendanceStatus,
  { label: string; tone: "emerald" | "violet" | "rose" | "sky" | "teal" | "slate"; bar: string }
> = {
  PRESENT: { label: "PRESENT", tone: "emerald", bar: "bg-emerald-500" },
  LATE: { label: "LATE", tone: "violet", bar: "bg-violet-500" },
  ABSENT: { label: "ABSENT", tone: "rose", bar: "bg-rose-500" },
  HALF_DAY: { label: "HALF", tone: "sky", bar: "bg-sky-500" },
  LEAVE: { label: "LEAVE", tone: "teal", bar: "bg-teal-500" },
  HOLIDAY: { label: "HOLIDAY", tone: "slate", bar: "bg-slate-500" },
};

const ICON_WRAPPERS: Record<string, string> = {
  emerald:
    "h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-900/60",
  violet:
    "h-10 w-10 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-200 dark:border-violet-900/60",
  sky: "h-10 w-10 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-200 dark:border-sky-900/60",
  slate:
    "h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 flex items-center justify-center border border-slate-200 dark:border-slate-700",
};

export default function HrmOverviewPage() {
  const { data: summary, isFetching } = useGetHRReportSummaryQuery(
    {},
    { refetchOnMountOrArgChange: true }
  );

  const todayByStatus = useMemo(() => {
    const total =
      summary?.todayByStatus?.reduce(
        (sum, s) => sum + (s.count ?? 0),
        0
      ) ?? 0;
    const rows = (Object.keys(ATTENDANCE_CONFIG) as AttendanceStatus[]).map(
      (status) => {
        const found = summary?.todayByStatus?.find((s) => s.status === status);
        const count = found?.count ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return { status, count, pct };
      }
    );
    return { total, rows };
  }, [summary]);

  const upcomingAnniversaries = summary?.upcomingAnniversaries ?? [];
  const recentJoiners = summary?.recentJoiners ?? [];

  const headcount = summary?.headcount ?? 0;
  const onLeaveToday = summary?.onLeaveToday ?? 0;
  const attendanceTodayPct = summary?.attendanceTodayPct ?? 0;
  const pendingLeaves = summary?.pendingLeaves ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "HRM" }]}
        title="Human Resources"
        description="Overview & Reports"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Headcount
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {isFetching ? "—" : headcount}
              </p>
            </div>
            <div className={ICON_WRAPPERS.emerald}>
              <Users className="w-5 h-5" />
            </div>
          </div>
          <Link
            href="/hrm/employees"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700"
          >
            View employees <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                On Leave Today
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {isFetching ? "—" : onLeaveToday}
              </p>
            </div>
            <div className={ICON_WRAPPERS.violet}>
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            Employees out of office
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Attendance Today
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {isFetching ? "—" : `${attendanceTodayPct}%`}
              </p>
            </div>
            <div className={ICON_WRAPPERS.sky}>
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            Check-in completion rate
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Pending Leaves
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {isFetching ? "—" : pendingLeaves}
              </p>
            </div>
            <div className={ICON_WRAPPERS.slate}>
              <FileClock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            Awaiting approval
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Today&apos;s Attendance Breakdown
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {todayByStatus.total > 0
                ? `${todayByStatus.total} records`
                : "No records yet"}
            </p>
          </div>
          <Sparkles className="w-4 h-4 text-slate-400" />
        </div>
        <div className="space-y-3">
          {todayByStatus.rows.map(({ status, count, pct }) => {
            const cfg = ATTENDANCE_CONFIG[status];
            return (
              <div key={status} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <StatusBadge
                    tone={cfg.tone}
                    size="sm"
                    label={cfg.label}
                  />
                  <span className="text-slate-500 dark:text-slate-400">
                    {count} · {pct}%
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${cfg.bar} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-semibold text-foreground">
              Upcoming Anniversaries
            </h2>
            <span className="text-xs text-muted-foreground">Next 30 days</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {upcomingAnniversaries.length === 0
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={`ann-ph-${i}`}
                    className="rounded-xl border border-border bg-card p-4 shadow-sm opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                        <div className="h-2.5 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                ))
              : upcomingAnniversaries.slice(0, 8).map((a) => (
                  <div
                    key={a.id}
                    className="rounded-xl border border-border bg-card p-4 shadow-sm hover:border-violet-200 dark:hover:border-violet-900/60 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 shrink-0 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 flex items-center justify-center font-semibold text-sm border border-violet-200 dark:border-violet-900/60">
                        {a.name?.[0]?.toUpperCase() ?? "E"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate text-sm">
                          {a.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            {a.code}
                          </span>
                          <span className="text-slate-300 dark:text-slate-600">
                            ·
                          </span>
                          <StatusBadge
                            tone="violet"
                            size="sm"
                            label={`${a.yearsService}y`}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mt-2.5 pt-2.5 border-t border-border flex items-center justify-between">
                      <DateDisplay
                        date={a.joiningDate}
                        format="short"
                        className="text-xs"
                      />
                      <span className="text-[11px] text-violet-600 dark:text-violet-400 font-medium">
                        Anniversary
                      </span>
                    </div>
                  </div>
                ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-semibold text-foreground">
              Recent Joiners
            </h2>
            <Link
              href="/hrm/employees"
              className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
            >
              All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="rounded-xl border border-border bg-card divide-y divide-border shadow-sm overflow-hidden">
            {recentJoiners.length === 0
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={`rj-ph-${i}`}
                    className="p-4 flex items-center gap-3 opacity-60"
                  >
                    <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="h-3.5 w-28 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                      <div className="h-2.5 w-20 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                    </div>
                    <div className="h-2.5 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                  </div>
                ))
              : recentJoiners.slice(0, 5).map((j) => (
                  <div
                    key={j.id}
                    className="p-4 flex items-center gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-900/30 transition-colors"
                  >
                    <div className="h-9 w-9 shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-semibold text-sm border border-emerald-200 dark:border-emerald-900/60">
                      {j.name?.[0]?.toUpperCase() ?? "E"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate text-sm">
                        {j.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {j.code}
                        </span>
                        {j.departmentName && (
                          <>
                            <span className="text-slate-300 dark:text-slate-600">
                              ·
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[12ch]">
                              {j.departmentName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <DateDisplay
                      date={j.joiningDate}
                      format="short"
                      className="text-xs shrink-0"
                    />
                  </div>
                ))}
          </div>
        </div>
      </div>
    </div>
  );
}
