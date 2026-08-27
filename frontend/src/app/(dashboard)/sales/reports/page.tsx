"use client";

import { useMemo, useState } from "react";
import {
  Receipt,
  DollarSign,
  TrendingUp,
  Boxes,
  BarChart3,
  Award,
  Warehouse,
} from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { GlobalSelect } from "@/components/form/GlobalSelect";
import { GlobalDatePicker } from "@/components/form/GlobalDatePicker";
import { GlobalTable } from "@/components/tables/GlobalTable";
import { MoneyDisplay } from "@/components/common/MoneyDisplay";
import { DateDisplay } from "@/components/common/DateDisplay";
import { createColumns, type TableFeatures } from "@/lib/table-utils";
import type { ColumnDef } from "@tanstack/react-table";
import {
  useGetDailySummaryQuery,
  useListOrdersQuery,
} from "@/lib/api/salesEndpoints";
import { useListWarehousesQuery } from "@/lib/api/inventoryEndpoints";
import type { DailySummaryResult } from "@/lib/api/salesEndpoints";

const extract = <T,>(resp?: { success: true; data: { items: T[]; meta: unknown } }) =>
  resp?.data ?? { items: [] as T[], meta: undefined };

const METHOD_BG: Record<string, string> = {
  CASH: "bg-emerald-500",
  CARD: "bg-sky-500",
  MOBILE_BANKING: "bg-violet-500",
  BANK_TRANSFER: "bg-sky-500",
  CREDIT: "bg-violet-500",
  WALLET: "bg-teal-500",
  MOBILE_PAYMENT: "bg-violet-500",
  CHECK: "bg-slate-500",
  OTHER: "bg-slate-500",
};

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  MOBILE_BANKING: "Mobile Banking",
  BANK_TRANSFER: "Bank Transfer",
  CREDIT: "Credit",
  WALLET: "Wallet",
  MOBILE_PAYMENT: "Mobile Payment",
  CHECK: "Check",
  OTHER: "Other",
};

type TopProductRow = {
  rank: number;
  productId: string;
  sku: string;
  productName: string;
  quantitySold: number;
  totalRevenue: number | string;
};

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  tone: "emerald" | "sky" | "violet" | "teal";
  subtitle?: string;
}

function DashboardCard({ label, value, icon, tone, subtitle }: KpiCardProps) {
  const toneClasses: Record<string, string> = {
    emerald:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60",
    sky: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-900/60",
    violet:
      "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border-violet-200 dark:border-violet-900/60",
    teal: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border-teal-200 dark:border-teal-900/60",
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5 min-w-0">
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <div className="flex items-baseline gap-2">{value}</div>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
        <div
          className={`h-11 w-11 shrink-0 rounded-xl border flex items-center justify-center ${toneClasses[tone]}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const today = new Date();
  const defaultFrom = format(startOfDay(today), "yyyy-MM-dd");
  const defaultTo = format(endOfDay(today), "yyyy-MM-dd");

  const [dateFrom, setDateFrom] = useState<string | null>(defaultFrom);
  const [dateTo, setDateTo] = useState<string | null>(defaultTo);
  const [warehouseId, setWarehouseId] = useState<string>("");

  const { data: warehousesRes } = useListWarehousesQuery({ pageSize: 100 });
  const warehouses = extract(warehousesRes as any).items as Array<{
    id: string;
    name: string;
    warehouseCode: string;
  }>;

  const warehouseOptions = useMemo(() => {
    const opts = [{ value: "", label: "All warehouses" }];
    warehouses.forEach((w) => opts.push({ value: w.id, label: w.name }));
    return opts;
  }, [warehouses]);

  const { data: summaryRes, isFetching } = useGetDailySummaryQuery(
    {
      dateFrom: dateFrom ?? defaultFrom,
      dateTo: dateTo ?? defaultTo,
      warehouseId: warehouseId || undefined,
    },
    { refetchOnMountOrArgChange: true }
  );

  const summary: DailySummaryResult | undefined = summaryRes?.data as
    | DailySummaryResult
    | undefined;

  const totalRevenueNum = useMemo(() => {
    const n = summary?.totalSalesAmount;
    if (n === undefined || n === null) return 0;
    return typeof n === "number" ? n : parseFloat(String(n));
  }, [summary]);

  const avgOrderValNum = useMemo(() => {
    const n = summary?.averageOrderValue;
    if (n === undefined || n === null) return 0;
    return typeof n === "number" ? n : parseFloat(String(n));
  }, [summary]);

  const paymentsBreakdown = useMemo(() => {
    const raw = summary?.paymentsByMethod ?? {};
    let totalAmt = 0;
    const rows = Object.entries(raw).map(([method, data]) => {
      const amt =
        typeof data.amount === "number"
          ? data.amount
          : parseFloat(String(data.amount ?? 0));
      totalAmt += amt;
      return { method, count: data.count ?? 0, amount: amt };
    });
    rows.sort((a, b) => b.amount - a.amount);
    return rows.map((r) => ({
      ...r,
      pct: totalAmt > 0 ? (r.amount / totalAmt) * 100 : 0,
    }));
  }, [summary]);

  const topProductsRows: TopProductRow[] = useMemo(() => {
    return (summary?.topProducts ?? []).map((p, idx) => ({
      rank: idx + 1,
      productId: p.productId,
      sku: p.sku,
      productName: p.productName,
      quantitySold: p.quantitySold,
      totalRevenue: p.totalRevenue,
    }));
  }, [summary]);

  const topProductsColumns: ColumnDef<TableFeatures, TopProductRow, any>[] =
    useMemo(() => {
      const col = createColumns<TopProductRow>();
      return [
        col.display({
          id: "rank",
          header: "Rank",
          cell: ({ row: { original: p } }) => {
            const isTop3 = p.rank <= 3;
            const rankTone =
              p.rank === 1
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60"
                : p.rank === 2
                ? "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900/60"
                : p.rank === 3
                ? "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-900/60"
                : "bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800";
            return (
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums ${rankTone}`}
                >
                  {p.rank}
                </span>
                {isTop3 && <Award className={`w-4 h-4 ${p.rank === 1 ? "text-emerald-500" : p.rank === 2 ? "text-sky-500" : "text-violet-500"}`} />}
              </div>
            );
          },
        }),
        col.display({
          id: "product",
          header: "Product",
          cell: ({ row: { original: p } }) => (
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{p.productName}</p>
              <p className="font-mono text-[11px] text-muted-foreground truncate max-w-[24ch]">
                SKU: {p.sku}
              </p>
            </div>
          ),
        }),
        col.display({
          id: "qty",
          header: "Qty Sold",
          cell: ({ row: { original: p } }) => (
            <span className="inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums min-w-[3ch]">
              {p.quantitySold.toLocaleString()}
            </span>
          ),
        }),
        col.display({
          id: "revenue",
          header: "Revenue",
          cell: ({ row: { original: p } }) => (
            <MoneyDisplay value={p.totalRevenue} positiveClass="text-emerald-600 dark:text-emerald-400 font-semibold" />
          ),
        }),
      ];
    }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Sales" }, { label: "Reports" }]}
        title="Sales Reports"
        description="Monitor KPIs, payment mix, and top-performing products across any date range."
      />

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <GlobalDatePicker
              label="Date from"
              value={dateFrom}
              onChange={setDateFrom}
              allowClear={false}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <GlobalDatePicker
              label="Date to"
              value={dateTo}
              onChange={setDateTo}
              allowClear={false}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground flex items-center gap-1">
                <Warehouse className="w-3.5 h-3.5 text-slate-400" />
                Warehouse
              </label>
              <GlobalSelect
                value={warehouseId}
                onChange={setWarehouseId}
                options={warehouseOptions}
                placeholder="All warehouses"
                label={undefined}
                className="!mt-0"
              />
            </div>
          </div>
          <div className="flex gap-2 pb-0.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDateFrom(defaultFrom);
                setDateTo(defaultTo);
              }}
            >
              Today
            </Button>
          </div>
        </div>
        {summary?.warehouseName && (
          <p className="mt-3 text-xs text-muted-foreground">
            Scope: <span className="font-medium text-foreground">{summary.warehouseName}</span>
            {" · "}
            Period:{" "}
            <span className="font-medium text-foreground">
              <DateDisplay date={summary.dateFrom} format="short" /> —{" "}
              <DateDisplay date={summary.dateTo} format="short" />
            </span>
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard
          label="Total Orders"
          icon={<Receipt className="w-5 h-5" />}
          tone="sky"
          subtitle="Orders placed in period"
          value={
            <span className="text-2xl font-semibold tabular-nums">
              {summary?.totalOrders?.toLocaleString() ?? "—"}
            </span>
          }
        />
        <DashboardCard
          label="Total Revenue"
          icon={<DollarSign className="w-5 h-5" />}
          tone="emerald"
          subtitle="Gross sales amount"
          value={
            <MoneyDisplay
              value={totalRevenueNum}
              align="left"
              className="!w-auto !text-2xl !font-semibold"
              positiveClass="text-emerald-600 dark:text-emerald-400"
            />
          }
        />
        <DashboardCard
          label="Avg Order Value"
          icon={<TrendingUp className="w-5 h-5" />}
          tone="violet"
          subtitle="Revenue ÷ orders"
          value={
            <MoneyDisplay
              value={avgOrderValNum}
              align="left"
              className="!w-auto !text-2xl !font-semibold"
            />
          }
        />
        <DashboardCard
          label="Items Sold"
          icon={<Boxes className="w-5 h-5" />}
          tone="teal"
          subtitle="Sum of line item qty"
          value={
            <span className="text-2xl font-semibold tabular-nums">
              {topProductsRows.reduce((s, r) => s + (r.quantitySold ?? 0), 0).toLocaleString()}
            </span>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-foreground flex items-center gap-1.5">
                <BarChart3 className="w-4.5 h-4.5 text-slate-500" />
                Payment Method Breakdown
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Share of revenue per method
              </p>
            </div>
          </div>
          {paymentsBreakdown.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No payment data in this range.
            </div>
          ) : (
            <div className="space-y-4">
              {paymentsBreakdown.slice(0, 5).map((row) => (
                <div key={row.method} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">
                      {METHOD_LABEL[row.method] ?? row.method}
                    </span>
                    <div className="flex items-center gap-3">
                      <MoneyDisplay
                        value={row.amount}
                        align="left"
                        className="!w-auto !text-sm font-semibold tabular-nums"
                      />
                      <span className="text-xs text-muted-foreground tabular-nums min-w-[3.5ch] text-right">
                        {row.pct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        METHOD_BG[row.method] ?? "bg-slate-400"
                      } transition-all duration-500 ease-out`}
                      style={{ width: `${Math.max(row.pct, row.pct > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {row.count.toLocaleString()} transaction
                    {row.count === 1 ? "" : "s"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-3 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-foreground flex items-center gap-1.5">
                <Award className="w-4.5 h-4.5 text-slate-500" />
                Top 10 Products
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ranked by revenue generated
              </p>
            </div>
          </div>
          <GlobalTable<TopProductRow>
            columns={topProductsColumns}
            data={topProductsRows}
            serverSide={false}
            pageSizeDefault={10}
            hidePagination
            defaultSortBy="rank"
            defaultSortOrder="asc"
            syncUrl={false}
            wrapperHeightClassName="relative max-h-[460px] overflow-auto"
            emptyTitle="No product data"
            emptyDescription="Top products will appear once orders exist in the selected range."
          />
        </div>
      </div>

      <div className="h-8" />
    </div>
  );
}
