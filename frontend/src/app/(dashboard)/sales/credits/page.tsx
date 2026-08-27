"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Wallet,
  Plus,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Hash,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { GlobalTable } from "@/components/tables/GlobalTable";
import { GlobalModal } from "@/components/feedback/GlobalModal";
import { GlobalInput } from "@/components/form/GlobalInput";
import { GlobalSelect } from "@/components/form/GlobalSelect";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { MoneyDisplay } from "@/components/common/MoneyDisplay";
import { PermissionGate, useHasPermission } from "@/components/auth/PermissionGate";
import { createColumns, type TableFeatures } from "@/lib/table-utils";
import type { ColumnDef } from "@tanstack/react-table";
import {
  useListCreditsQuery,
  useAdjustCreditMutation,
} from "@/lib/api/salesEndpoints";
import type {
  CreditListItem,
  ListCreditsArgs,
} from "@/lib/api/salesEndpoints";
import { useListCustomersQuery } from "@/lib/api/crmEndpoints";
import type { CustomerItem } from "@/lib/api/crmEndpoints";

const extract = <T,>(resp?: { success: true; data: { items: T[]; meta: unknown } }) =>
  resp?.data ?? { items: [] as T[], meta: undefined };

const adjustFormSchema = z.object({
  customerId: z.string().trim().min(1, "Required"),
  deltaAmount: z.union([z.number(), z.string().trim()]).refine((v) => {
    const n = typeof v === "number" ? v : parseFloat(v);
    return isFinite(n) && n !== 0;
  }, "Amount must be non-zero (positive or negative)"),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});
type AdjustFormValues = z.infer<typeof adjustFormSchema>;

export default function CreditsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canUpdate = useHasPermission({ one: "sales.credits.update" });

  const filters: ListCreditsArgs = useMemo(() => {
    const page = parseInt(searchParams?.get("page") ?? "1", 10) || 1;
    const pageSize = parseInt(searchParams?.get("pageSize") ?? "25", 10) || 25;
    return {
      page,
      pageSize,
      search: searchParams?.get("search") ?? "",
      sortBy: searchParams?.get("sortBy") ?? "creditBalance",
      sortOrder: (searchParams?.get("sortOrder") as "asc" | "desc") ?? "desc",
    };
  }, [searchParams]);

  const { data: creditsRes, isFetching, refetch } = useListCreditsQuery(filters, {
    refetchOnMountOrArgChange: true,
  });
  const { data: customersRes } = useListCustomersQuery({ pageSize: 200 });

  const credits = extract(creditsRes as any).items as CreditListItem[];
  const meta = extract(creditsRes as any).meta;
  const customers = extract(customersRes as any).items as CustomerItem[];

  const customerOptions = useMemo(() => {
    return customers.map((c) => ({
      value: c.id,
      label: `${c.customerCode} — ${c.name}`,
    }));
  }, [customers]);

  const buildParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      Object.entries(patch).forEach(([k, v]) => {
        if (v === undefined || v === "" || v === null) {
          params.delete(k);
        } else {
          params.set(k, v);
        }
      });
      params.delete("page");
      return params.toString();
    },
    [searchParams]
  );

  const pushParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const qs = buildParams(patch);
      router.push(`?${qs}`, { scroll: false });
    },
    [buildParams, router]
  );

  const [openAdjust, setOpenAdjust] = useState(false);
  const [adjustTrigger, adjustState] = useAdjustCreditMutation();

  const form = useForm<AdjustFormValues>({
    resolver: zodResolver(adjustFormSchema),
    defaultValues: {
      customerId: "",
      deltaAmount: "",
      note: "",
    },
    mode: "onTouched",
  });

  useEffect(() => {
    if (openAdjust) {
      form.reset({
        customerId: "",
        deltaAmount: "",
        note: "",
      });
    }
  }, [openAdjust, form]);

  const deltaRaw = form.watch("deltaAmount");
  const deltaNum = useMemo(() => {
    const n =
      typeof deltaRaw === "number" ? deltaRaw : parseFloat(deltaRaw ?? "0");
    return isFinite(n) ? n : 0;
  }, [deltaRaw]);

  const closeModal = () => {
    setOpenAdjust(false);
    form.reset();
  };

  const onSubmitAdjust = async (v: AdjustFormValues) => {
    const n =
      typeof v.deltaAmount === "number"
        ? v.deltaAmount
        : parseFloat(v.deltaAmount ?? "0");
    const out = await adjustTrigger({
      customerId: v.customerId,
      adjustmentType: n > 0 ? "INCREASE" : "DECREASE",
      amount: Math.abs(n),
      reason: v.note || "Manual adjustment",
      notes: v.note || undefined,
    });
    if ("data" in out && out.data?.success) {
      closeModal();
    }
  };

  const columns: ColumnDef<TableFeatures, CreditListItem, any>[] = useMemo(() => {
    const col = createColumns<CreditListItem>();

    return [
      col.display({
        id: "customerCode",
        header: "Customer Code",
        enableSorting: true,
        cell: ({ row: { original: c } }) => (
          <span className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-2 py-0.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
            <Hash className="w-3 h-3 mr-1 text-slate-400" />
            {c.customerCode}
          </span>
        ),
      }),
      col.display({
        id: "name",
        header: "Customer",
        cell: ({ row: { original: c } }) => {
          const initials = `${c.name?.[0] ?? ""}`.toUpperCase() || "C";
          return (
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 shrink-0 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 flex items-center justify-center font-semibold text-sm border border-sky-200 dark:border-sky-900/60">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{c.name}</p>
              </div>
            </div>
          );
        },
      }),
      col.display({
        id: "creditBalance",
        header: "Credit Balance",
        enableSorting: true,
        cell: ({ row: { original: c } }) => {
          const n =
            typeof c.creditBalance === "number"
              ? c.creditBalance
              : parseFloat(String(c.creditBalance ?? 0));
          let tone: "emerald" | "slate" | "rose" = "slate";
          if (n > 0) tone = "emerald";
          else if (n < 0) tone = "rose";
          const icon =
            n > 0 ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : n < 0 ? (
              <ArrowDownRight className="w-3 h-3" />
            ) : (
              <CreditCard className="w-3 h-3" />
            );
          return (
            <StatusBadge
              tone={tone}
              size="md"
              icon={icon}
              label={
                <MoneyDisplay
                  value={c.creditBalance}
                  align="left"
                  className="!w-auto !text-xs"
                />
              }
            />
          );
        },
      }),
      col.display({
        id: "orderCount",
        header: "Orders",
        enableSorting: true,
        cell: ({ row: { original: c } }) => (
          <span className="inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums min-w-[3ch]">
            {c.orderCount?.toLocaleString() ?? 0}
          </span>
        ),
      }),
      col.display({
        id: "totalSpent",
        header: "Total Spent",
        enableSorting: true,
        cell: ({ row: { original: c } }) => (
          <MoneyDisplay value={c.totalSpent} />
        ),
      }),
      col.display({
        id: "lastOrderDate",
        header: "Last Order Date",
        enableSorting: true,
        cell: ({ row: { original: c } }) => {
          const d = (c as any).lastOrderDate ?? (c as any).lastTransactionAt;
          return d ? (
            <DateDisplay date={d} format="short" />
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" /> No orders
            </span>
          );
        },
      }),
    ];
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Sales" }, { label: "Credits" }]}
        title="Customer Credits"
        description="Monitor running credit balances per customer and make manual adjustments."
        action={
          <div className="flex items-center gap-2">
            <PermissionGate one="sales.credits.update">
              <Button
                size="sm"
                onClick={() => setOpenAdjust(true)}
                disabled={!canUpdate}
              >
                <Plus className="w-4 h-4" /> Adjust Credit
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <TableToolbar
        searchTerm={filters.search ?? ""}
        onSearchChange={(v) => pushParams({ search: v })}
        searchPlaceholder="Search by customer name or code…"
        onCreateNew={canUpdate ? () => setOpenAdjust(true) : undefined}
        createNewLabel="Adjust Credit"
        disableCreateNew={!canUpdate}
      />

      <GlobalTable<CreditListItem>
        columns={columns}
        data={credits}
        meta={meta as any}
        serverSide
        pageSizeDefault={25}
        defaultSortBy="creditBalance"
        defaultSortOrder="desc"
        queryResult={{
          data: creditsRes?.data as any,
          isFetching,
        }}
        getRowId={(c) => c.id}
        emptyIcon={<Wallet className="w-10 h-10" />}
        emptyTitle="No credits found"
        emptyDescription="No customers have credit balances yet."
        errorOnRetry={() => refetch()}
      />

      <GlobalModal
        open={openAdjust}
        onOpenChange={(o) => !o && closeModal()}
        title="Adjust Customer Credit"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <PermissionGate one="sales.credits.update">
              <Button
                type="submit"
                form="adjustCreditForm"
                disabled={adjustState.isLoading || !canUpdate}
              >
                {adjustState.isLoading ? "Applying…" : "Apply Adjustment"}
              </Button>
            </PermissionGate>
          </div>
        }
      >
        <form
          id="adjustCreditForm"
          onSubmit={form.handleSubmit(onSubmitAdjust)}
          className="space-y-4"
          noValidate
        >
          <GlobalSelect
            label="Customer"
            required
            value={form.watch("customerId")}
            onChange={(v) =>
              form.setValue("customerId", v, { shouldValidate: true })
            }
            options={customerOptions}
            placeholder="Select customer…"
            error={form.formState.errors.customerId?.message}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Adjustment Amount{" "}
                <span className="ml-0.5 text-rose-500">*</span>
              </label>
              <div className="relative">
                <GlobalInput
                  inputType="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="+50.00 or -25.00"
                  error={form.formState.errors.deltaAmount?.message as any}
                  {...form.register("deltaAmount")}
                  className="pr-20"
                />
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                  {deltaNum !== 0 && (
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                        deltaNum > 0
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60"
                          : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60"
                      }`}
                    >
                      {deltaNum > 0 ? "INCREASE" : "DECREASE"}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Use positive (+) to add credit, negative (-) to reduce it.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Preview</p>
              <p className="text-sm text-foreground">
                Balance change:{" "}
                <span
                  className={`font-semibold tabular-nums ${
                    deltaNum > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : deltaNum < 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-muted-foreground"
                  }`}
                >
                  <MoneyDisplay
                    value={deltaNum}
                    align="left"
                    className="!w-auto !text-sm"
                  />
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                {deltaNum === 0
                  ? "Enter a non-zero amount above."
                  : deltaNum > 0
                  ? "Customer credit will increase."
                  : "Customer credit will decrease."}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground">
              Adjustment note
            </label>
            <textarea
              rows={3}
              className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Reason for the adjustment, reference #, or context…"
              maxLength={2000}
              {...form.register("note")}
            />
            {form.formState.errors.note?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {form.formState.errors.note.message}
              </p>
            )}
          </div>

          {adjustState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (adjustState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to apply adjustment."
              )}
            </div>
          )}
        </form>
      </GlobalModal>
    </div>
  );
}
