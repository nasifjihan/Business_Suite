"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  DollarSign,
  ShoppingCart,
  Users,
  UserPlus,
  Target,
  UserCheck,
  TrendingUp,
  AlertTriangle,
  Package,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  CalendarDays,
} from "lucide-react";
import { LoadingSkeleton } from "@/components/feedback/LoadingSkeleton";
import DashboardCard from "@/components/dashboard/DashboardCard";
import { GlobalSelect } from "@/components/form/GlobalSelect";
import { DateDisplay } from "@/components/common/DateDisplay";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  useGetDashboardSummaryQuery,
  useGetDashboardSalesTrendQuery,
  useGetDashboardTopProductsQuery,
  useGetDashboardLeadPipelineQuery,
  useGetDashboardAttendanceSummaryQuery,
  useGetDashboardRecentOrdersQuery,
  useGetDashboardRecentActivitiesQuery,
  type DashboardPeriod,
} from "@/lib/api/dashboardEndpoints";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => <LoadingSkeleton count={4} />,
});

const CHART_COLORS = [
  "#0ea5e9",
  "#6366f1",
  "#10b981",
  "#8b5cf6",
  "#14b8a6",
  "#f43f5e",
];

const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "WON",
  "LOST",
] as const;

const ATTENDANCE_STATUSES = [
  { key: "PRESENT", label: "Present", color: CHART_COLORS[2] },
  { key: "LATE", label: "Late", color: CHART_COLORS[3] },
  { key: "ABSENT", label: "Absent", color: CHART_COLORS[5] },
  { key: "HALF_DAY", label: "Half Day", color: CHART_COLORS[0] },
  { key: "LEAVE", label: "Leave", color: CHART_COLORS[4] },
] as const;

const PERIOD_OPTIONS = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

function calcDelta(curr: number | undefined, prev: number | undefined): number {
  const c = Number(curr) || 0;
  const p = Number(prev) || 0;
  if (p <= 0) return 0;
  return ((c - p) / p) * 100;
}

function formatCurrency(v: number | string | undefined): string {
  const n = Number(v) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function CardShell({
  title,
  subtitle,
  isLoading,
  children,
}: {
  title: string;
  subtitle?: string;
  isLoading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {isLoading ? <LoadingSkeleton count={4} /> : children}
    </div>
  );
}

export default function DashboardIndexPage() {
  const [period, setPeriod] = useState<DashboardPeriod>("week");

  const { data: summary, isLoading: summaryLoading } =
    useGetDashboardSummaryQuery();
  const { data: salesTrend, isLoading: trendLoading } =
    useGetDashboardSalesTrendQuery(period);
  const { data: topProducts, isLoading: topProductsLoading } =
    useGetDashboardTopProductsQuery(10);
  const { data: leadPipeline, isLoading: leadPipelineLoading } =
    useGetDashboardLeadPipelineQuery();
  const { data: attendanceSummary, isLoading: attendanceLoading } =
    useGetDashboardAttendanceSummaryQuery();
  const { data: recentOrders, isLoading: recentOrdersLoading } =
    useGetDashboardRecentOrdersQuery(10);
  const { data: recentActivities, isLoading: activitiesLoading } =
    useGetDashboardRecentActivitiesQuery(15);

  const salesToday = Number(summary?.salesToday ?? 0);
  const salesYesterday = Number(summary?.salesYesterday ?? 0);
  const salesThisMonth = Number(summary?.salesThisMonth ?? 0);
  const salesLastMonth = Number(summary?.salesLastMonth ?? 0);
  const ordersToday = Number(summary?.ordersToday ?? 0);
  const ordersYesterday = Number(summary?.ordersYesterday ?? 0);
  const newCustomersThisMonth = Number(summary?.newCustomersThisMonth ?? 0);
  const newCustomersLastMonth = Number(summary?.newCustomersLastMonth ?? 0);
  const openLeadsCount = Number(summary?.openLeadsCount ?? 0);
  const openLeadsPrevWeek = Number(summary?.openLeadsPrevWeek ?? 0);
  const presentToday = Number(summary?.presentToday ?? 0);
  const presentYesterday = Number(summary?.presentYesterday ?? 0);
  const lowStockCount = Number(summary?.lowStockCount ?? 0);

  const salesTrendOption = useMemo(() => {
    const trendData = Array.isArray(salesTrend) ? salesTrend : [];
    const dates = trendData.map((p: any) => p.date ?? p.label ?? "");
    const values = trendData.map((p: any) =>
      Number(p.revenue ?? p.value ?? p.amount ?? 0)
    );
    if (trendData.length === 0) return null;
    return {
      color: [CHART_COLORS[0]],
      tooltip: {
        trigger: "axis",
        formatter: (params: any[]) => {
          const p = params[0];
          return `${p.axisValue}<br/><b>${formatCurrency(p.value)}</b>`;
        },
      },
      grid: { left: 48, right: 16, top: 16, bottom: 28 },
      xAxis: {
        type: "category",
        data: dates,
        axisLine: { lineStyle: { color: "#e2e8f0" } },
        axisLabel: { color: "#64748b", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
        axisLabel: {
          color: "#64748b",
          fontSize: 11,
          formatter: (v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`,
        },
      },
      series: [
        {
          type: "line",
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2.5 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${CHART_COLORS[0]}33` },
                { offset: 1, color: `${CHART_COLORS[0]}00` },
              ],
            },
          },
          data: values,
        },
      ],
    };
  }, [salesTrend]);

  const leadPipelineOption = useMemo(() => {
    const pipeData = Array.isArray(leadPipeline) ? leadPipeline : [];
    const rows = LEAD_STATUSES.map((status, idx) => {
      const found = pipeData.find(
        (r: any) => (r.status ?? r.name) === status
      );
      return {
        name: status.charAt(0) + status.slice(1).toLowerCase(),
        value: Number(found?.count ?? found?.total ?? 0),
        raw: found ?? {},
        itemStyle: { color: CHART_COLORS[idx % CHART_COLORS.length] },
      };
    });
    const total = rows.reduce((s, r) => s + r.value, 0);
    return {
      tooltip: {
        trigger: "item",
        formatter: (p: any) => {
          const raw = rows[p.dataIndex]?.raw ?? {};
          const val = formatCurrency(raw.value ?? raw.amount ?? 0);
          const count = p.value;
          return `<b>${p.name}</b><br/>Count: ${count}<br/>Value: ${val}`;
        },
      },
      legend: {
        bottom: 0,
        icon: "circle",
        textStyle: { color: "#64748b", fontSize: 11 },
        itemWidth: 8,
        itemHeight: 8,
      },
      series: [
        {
          type: "pie",
          radius: ["55%", "78%"],
          avoidLabelOverlap: true,
          itemStyle: { borderWidth: 2, borderColor: "#ffffff" },
          label: { show: false },
          labelLine: { show: false },
          data: rows,
        },
      ],
      graphic: total === 0 ? [] : [],
    };
  }, [leadPipeline]);

  const topProductsOption = useMemo(() => {
    const prods = Array.isArray(topProducts) ? topProducts : [];
    const items = prods.slice(0, 10);
    if (items.length === 0) return null;
    const names = items.map((p: any) => p.name ?? p.productName ?? "-");
    const revenues = items.map((p: any) =>
      Number(p.revenue ?? p.totalRevenue ?? p.amount ?? 0)
    );
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: any[]) => {
          const p = params[0];
          return `${names[p.dataIndex]}<br/><b>${formatCurrency(p.value)}</b>`;
        },
      },
      grid: { left: 120, right: 24, top: 8, bottom: 28 },
      xAxis: {
        type: "value",
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
        axisLabel: {
          color: "#64748b",
          fontSize: 11,
          formatter: (v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`,
        },
      },
      yAxis: {
        type: "category",
        data: names.slice().reverse(),
        axisLine: { lineStyle: { color: "#e2e8f0" } },
        axisTick: { show: false },
        axisLabel: { color: "#475569", fontSize: 11 },
      },
      series: [
        {
          type: "bar",
          data: revenues.slice().reverse(),
          barWidth: 14,
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: `${CHART_COLORS[1]}55` },
                { offset: 1, color: CHART_COLORS[1] },
              ],
            },
          },
        },
      ],
    };
  }, [topProducts]);

  const attendanceOption = useMemo(() => {
    const att = Array.isArray(attendanceSummary) ? attendanceSummary : [];
    const counts = ATTENDANCE_STATUSES.map((s) => {
      const found = att.find(
        (r: any) => (r.status ?? r.name ?? r.key) === s.key
      );
      return Number(found?.count ?? found?.value ?? 0);
    });
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: any[]) => {
          const p = params[0];
          return `${ATTENDANCE_STATUSES[p.dataIndex].label}: <b>${p.value}</b>`;
        },
      },
      grid: { left: 32, right: 16, top: 16, bottom: 28 },
      xAxis: {
        type: "category",
        data: ATTENDANCE_STATUSES.map((s) => s.label),
        axisLine: { lineStyle: { color: "#e2e8f0" } },
        axisTick: { show: false },
        axisLabel: { color: "#475569", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
        axisLabel: { color: "#64748b", fontSize: 11 },
      },
      series: [
        {
          type: "bar",
          data: counts.map((v, i) => ({
            value: v,
            itemStyle: {
              color: ATTENDANCE_STATUSES[i].color,
              borderRadius: [4, 4, 0, 0],
            },
          })),
          barWidth: 28,
        },
      ],
    };
  }, [attendanceSummary]);

  const periodBadge =
    PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "Week";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome 👋</h1>
          <p className="text-muted mt-1 text-sm">
            Here&apos;s what&apos;s happening across your business today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GlobalSelect
            value={period}
            onChange={(v) => setPeriod(v as DashboardPeriod)}
            options={PERIOD_OPTIONS}
            placeholder="Period"
            className="w-36"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <DashboardCard
          icon={DollarSign}
          label="Sales Today"
          value={summaryLoading ? "—" : formatCurrency(salesToday)}
          delta={summaryLoading ? undefined : calcDelta(salesToday, salesYesterday)}
          deltaLabel="vs yesterday"
          tone="emerald"
        />
        <DashboardCard
          icon={TrendingUp}
          label="Sales MTD"
          value={summaryLoading ? "—" : formatCurrency(salesThisMonth)}
          delta={summaryLoading ? undefined : calcDelta(salesThisMonth, salesLastMonth)}
          deltaLabel="vs last month"
          tone="sky"
        />
        <DashboardCard
          icon={ShoppingCart}
          label="Orders Today"
          value={summaryLoading ? "—" : ordersToday}
          delta={summaryLoading ? undefined : calcDelta(ordersToday, ordersYesterday)}
          deltaLabel="vs yesterday"
          tone="violet"
        />
        <DashboardCard
          icon={UserPlus}
          label="New Customers"
          value={summaryLoading ? "—" : newCustomersThisMonth}
          delta={summaryLoading ? undefined : calcDelta(newCustomersThisMonth, newCustomersLastMonth)}
          deltaLabel="vs last month"
          tone="teal"
        />
        <DashboardCard
          icon={Target}
          label="Open Leads"
          value={summaryLoading ? "—" : openLeadsCount}
          delta={summaryLoading ? undefined : calcDelta(openLeadsCount, openLeadsPrevWeek)}
          deltaLabel="vs last week"
          tone="slate"
          neutralDelta
        />
        <DashboardCard
          icon={UserCheck}
          label="Present Today"
          value={summaryLoading ? "—" : presentToday}
          delta={summaryLoading ? undefined : calcDelta(presentToday, presentYesterday)}
          deltaLabel="vs yesterday"
          tone="emerald"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <CardShell
          title="Sales Trend"
          subtitle={`Current period: ${periodBadge}`}
          isLoading={trendLoading}
        >
          {salesTrendOption ? (
            <div className="h-72">
              <ReactECharts option={salesTrendOption} style={{ height: "100%" }} />
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
              No data for this period
            </div>
          )}
        </CardShell>

        <CardShell
          title="Lead Pipeline"
          subtitle="By status"
          isLoading={leadPipelineLoading}
        >
          {(Array.isArray(leadPipeline) && leadPipeline.length > 0) ||
          leadPipelineLoading ? (
            <div className="h-72">
              <ReactECharts option={leadPipelineOption} style={{ height: "100%" }} />
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
              No lead data
            </div>
          )}
        </CardShell>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <CardShell
          title="Top Products"
          subtitle="By revenue"
          isLoading={topProductsLoading}
        >
          {topProductsOption ? (
            <div className="h-80">
              <ReactECharts option={topProductsOption} style={{ height: "100%" }} />
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center text-sm text-muted-foreground">
              No product data yet
            </div>
          )}
        </CardShell>

        <CardShell
          title="Attendance Summary"
          subtitle="Today's breakdown"
          isLoading={attendanceLoading}
        >
          <div className="h-80">
            <ReactECharts option={attendanceOption} style={{ height: "100%" }} />
          </div>
        </CardShell>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <CardShell
          title="Recent Orders"
          subtitle="Last 10 orders"
          isLoading={recentOrdersLoading}
        >
          {Array.isArray(recentOrders) && recentOrders.length > 0 ? (
            <div className="divide-y divide-border -mx-5 -mb-5">
              {recentOrders.map((o: any) => {
                const id = o.id ?? o.orderId ?? "-";
                const orderCode = o.code ?? o.orderNumber ?? id;
                const customer =
                  o.customerName ??
                  o.customer?.name ??
                  (`${o.customer?.firstName ?? ""} ${o.customer?.lastName ?? ""}`.trim() ||
                  "Guest");
                const amount = formatCurrency(o.totalAmount ?? o.amount ?? o.total ?? 0);
                const status = (o.status ?? "PENDING") as string;
                const statusLower = status.toLowerCase();
                const tone: any =
                  statusLower === "paid" || statusLower === "completed"
                    ? "emerald"
                    : statusLower === "cancelled" || statusLower === "refunded"
                    ? "rose"
                    : statusLower === "pending"
                    ? "violet"
                    : "slate";
                return (
                  <Link
                    key={id}
                    href={`/sales/orders/${id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 dark:hover:bg-slate-900/30 transition-colors"
                  >
                    <div className="h-9 w-9 shrink-0 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center">
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground text-sm truncate">
                          #{orderCode}
                        </p>
                        <StatusBadge tone={tone} size="sm" label={status} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {customer}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-foreground text-sm">
                        {amount}
                      </p>
                      {o.createdAt && (
                        <DateDisplay
                          date={o.createdAt}
                          format="datetime"
                          className="text-xs text-muted-foreground mt-0.5"
                        />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : recentOrdersLoading ? null : (
            <div className="py-12 flex items-center justify-center text-sm text-muted-foreground">
              No recent orders
            </div>
          )}
        </CardShell>

        <CardShell
          title="Stock & Alerts"
          subtitle={
            lowStockCount > 0
              ? `${lowStockCount} item${lowStockCount === 1 ? "" : "s"} need attention`
              : "Inventory status"
          }
          isLoading={summaryLoading}
        >
          <div className="space-y-3">
            {lowStockCount > 0 ? (
              <Link
                href="/inventory/products"
                className="flex items-start gap-3 p-3 rounded-lg border border-violet-200 dark:border-violet-900/60 bg-violet-50/60 dark:bg-violet-950/30 hover:bg-violet-50 dark:hover:bg-violet-950/50 transition-colors"
              >
                <div className="h-9 w-9 shrink-0 rounded-lg bg-violet-500/15 text-violet-600 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground text-sm">
                    Low Stock Alert
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {lowStockCount} product
                    {lowStockCount === 1 ? "" : "s"} below reorder threshold.
                    Review inventory now.
                  </p>
                </div>
              </Link>
            ) : (
              <div className="flex items-start gap-3 p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30">
                <div className="h-9 w-9 shrink-0 rounded-lg bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground text-sm text-emerald-700 dark:text-emerald-400">
                    All stock levels healthy
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    No products are currently below the reorder threshold.
                  </p>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between px-1 mb-2">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                  Recent Activity
                </h4>
              </div>
              {activitiesLoading ? (
                <LoadingSkeleton count={4} />
              ) : Array.isArray(recentActivities) && recentActivities.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {recentActivities.map((a: any, i: number) => {
                    const id = a.id ?? i;
                    const icon = a.actionType === "CREATE" ? UserPlus : Clock;
                    const Icon = icon;
                    return (
                      <div
                        key={id}
                        className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                      >
                        <div className="h-8 w-8 shrink-0 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground leading-snug">
                            {a.message ?? a.description ?? a.activity ??
                              "Activity recorded"}
                          </p>
                          {(a.createdAt || a.timestamp) && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              <DateDisplay
                                date={a.createdAt ?? a.timestamp}
                                format="datetime"
                              />
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 flex items-center justify-center text-sm text-muted-foreground">
                  No recent activity
                </div>
              )}
            </div>
          </div>
        </CardShell>
      </div>
    </div>
  );
}
