"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Receipt, Plus, Hash, CreditCard, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { GlobalTable } from "@/components/tables/GlobalTable";
import { GlobalModal } from "@/components/feedback/GlobalModal";
import { GlobalInput } from "@/components/form/GlobalInput";
import { GlobalSelect } from "@/components/form/GlobalSelect";
import { GlobalDatePicker } from "@/components/form/GlobalDatePicker";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { MoneyDisplay } from "@/components/common/MoneyDisplay";
import { PermissionGate, useHasPermission } from "@/components/auth/PermissionGate";
import { createColumns, type TableFeatures } from "@/lib/table-utils";
import type { ColumnDef } from "@tanstack/react-table";
import {
  useListPaymentsQuery,
  useListOrdersQuery,
  useCreatePaymentMutation,
} from "@/lib/api/salesEndpoints";
import type {
  PaymentSummary,
  ListPaymentsArgs,
  PaymentMethod,
  OrderSummaryItem,
} from "@/lib/api/salesEndpoints";

const extract = <T,>(resp?: { success: true; data: { items: T[]; meta: unknown } }) =>
  resp?.data ?? { items: [] as T[], meta: undefined };

const PAYMENT_METHOD_TONE: Record<string, string> = {
  CASH: "emerald",
  CARD: "sky",
  MOBILE_BANKING: "violet",
  BANK_TRANSFER: "sky",
  CREDIT: "violet",
  WALLET: "teal",
  MOBILE_PAYMENT: "violet",
  CHECK: "slate",
  OTHER: "slate",
};

const PAYMENT_STATUS_TONE: Record<string, string> = {
  PAID: "emerald",
  COMPLETED: "emerald",
  UNPAID: "slate",
  PARTIAL: "violet",
  PARTIALLY_PAID: "violet",
  FAILED: "rose",
  REFUNDED: "rose",
  PENDING: "slate",
};

const methodFilterOptions = [
  { value: "", label: "All methods" },
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "MOBILE_BANKING", label: "Mobile Banking" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CREDIT", label: "Credit" },
  { value: "WALLET", label: "Wallet" },
  { value: "MOBILE_PAYMENT", label: "Mobile Payment" },
  { value: "CHECK", label: "Check" },
  { value: "OTHER", label: "Other" },
];

const statusFilterOptions = [
  { value: "", label: "All statuses" },
  { value: "PAID", label: "Paid" },
  { value: "PENDING", label: "Pending" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIAL", label: "Partial" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUNDED", label: "Refunded" },
];

const methodFormOptions = methodFilterOptions.filter((o) => o.value !== "");

const paymentFormSchema = z.object({
  orderId: z.string().trim().min(1, "Required"),
  method: z.string().min(1, "Required"),
  amount: z.union([z.number(), z.string().trim()]).refine((v) => {
    const n = typeof v === "number" ? v : parseFloat(v);
    return isFinite(n) && n > 0;
  }, "Amount must be greater than 0"),
  reference: z.string().trim().max(255).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
type PaymentFormValues = z.infer<typeof paymentFormSchema>;

export default function PaymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canCreate = useHasPermission({ one: "sales.payments.create" });

  const filters: ListPaymentsArgs = useMemo(() => {
    const page = parseInt(searchParams?.get("page") ?? "1", 10) || 1;
    const pageSize = parseInt(searchParams?.get("pageSize") ?? "25", 10) || 25;
    return {
      page,
      pageSize,
      search: searchParams?.get("search") ?? "",
      paymentMethod:
        (searchParams?.get("method") as PaymentMethod | undefined) || undefined,
      status:
        (searchParams?.get("status") as
          | "PENDING"
          | "COMPLETED"
          | "FAILED"
          | "REFUNDED"
          | undefined) || undefined,
      orderId: searchParams?.get("orderId") || undefined,
      dateFrom: searchParams?.get("dateFrom") || undefined,
      dateTo: searchParams?.get("dateTo") || undefined,
      sortBy: searchParams?.get("sortBy") ?? "createdAt",
      sortOrder: (searchParams?.get("sortOrder") as "asc" | "desc") ?? "desc",
    };
  }, [searchParams]);

  const { data: paymentsRes, isFetching, refetch } = useListPaymentsQuery(filters, {
    refetchOnMountOrArgChange: true,
  });
  const { data: ordersRes } = useListOrdersQuery({ pageSize: 100 });

  const payments = extract(paymentsRes as any).items as PaymentSummary[];
  const meta = extract(paymentsRes as any).meta;
  const orders = extract(ordersRes as any).items as OrderSummaryItem[];

  const orderOptions = useMemo(() => {
    return orders.map((o) => ({ value: o.id, label: o.orderNumber }));
  }, [orders]);

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

  const [openCreate, setOpenCreate] = useState(false);
  const [createTrigger, createState] = useCreatePaymentMutation();

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema) as any,
    defaultValues: {
      orderId: "",
      method: "CASH",
      amount: "",
      reference: "",
      notes: "",
    },
    mode: "onTouched",
  });

  useEffect(() => {
    if (openCreate) {
      form.reset({
        orderId: "",
        method: "CASH",
        amount: "",
        reference: "",
        notes: "",
      });
    }
  }, [openCreate, form]);

  const closeModal = () => {
    setOpenCreate(false);
    form.reset();
  };

  const parseNum = (v: string | number | undefined): number => {
    const n = typeof v === "number" ? v : parseFloat(v ?? "0");
    return isFinite(n) ? n : 0;
  };

  const onSubmitCreate = async (v: any) => {
    const out = await createTrigger({
      orderId: v.orderId,
      paymentMethod: v.method as any,
      amount: parseNum(v.amount),
      referenceNumber: v.reference || undefined,
      notes: v.notes || undefined,
    });
    if ("data" in out && out.data?.success) {
      closeModal();
    }
  };

  const columns: ColumnDef<TableFeatures, PaymentSummary, any>[] = useMemo(() => {
    const col = createColumns<PaymentSummary>();

    return [
      col.display({
        id: "paymentNo",
        header: "Payment #",
        enableSorting: true,
        cell: ({ row: { original: p } }) => (
          <span className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-2 py-0.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
            <Hash className="w-3 h-3 mr-1 text-slate-400" />
            {p.paymentNumber}
          </span>
        ),
      }),
      col.display({
        id: "orderId",
        header: "Order",
        cell: ({ row: { original: p } }) => (
          <Link
            href={`/sales/orders/${(p as any).orderId ?? "#"}`}
            className="inline-flex items-center gap-1 rounded-md bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 px-2 py-0.5 text-xs font-medium border border-sky-200 dark:border-sky-900/60 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors"
          >
            <Receipt className="w-3 h-3" />
            {p.orderNumber}
          </Link>
        ),
      }),
      col.display({
        id: "method",
        header: "Method",
        cell: ({ row: { original: p } }) => {
          const pm = p.paymentMethod as any as string;
          return (
            <StatusBadge
              tone={(PAYMENT_METHOD_TONE[pm] ?? "slate") as any}
              size="md"
              icon={<CreditCard className="w-3 h-3" />}
              label={
                pm === "MOBILE_BANKING"
                  ? "Mobile Banking"
                  : pm === "BANK_TRANSFER"
                  ? "Bank Transfer"
                  : pm === "MOBILE_PAYMENT"
                  ? "Mobile Payment"
                  : pm.charAt(0) + pm.slice(1).toLowerCase()
              }
            />
          );
        },
      }),
      col.display({
        id: "amount",
        header: "Amount",
        cell: ({ row: { original: p } }) => <MoneyDisplay value={p.amount} />,
      }),
      col.display({
        id: "status",
        header: "Status",
        cell: ({ row: { original: p } }) => {
          const st = p.status as any as string;
          return (
            <StatusBadge
              tone={(PAYMENT_STATUS_TONE[st] ?? "slate") as any}
              size="md"
              dot={st === "COMPLETED" || st === "PAID"}
              label={
                st === "COMPLETED"
                  ? "Paid"
                  : st.charAt(0) + st.slice(1).toLowerCase()
              }
            />
          );
        },
      }),
      col.display({
        id: "reference",
        header: "Reference",
        cell: ({ row: { original: p } }) =>
          (p as any).referenceNumber ? (
            <span className="font-mono text-xs text-slate-600 dark:text-slate-400 truncate max-w-[14ch]">
              {(p as any).referenceNumber}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      }),
      col.display({
        id: "date",
        header: "Date",
        enableSorting: true,
        cell: ({ row: { original: p } }) => (
          <DateDisplay date={p.paymentDate} format="short" />
        ),
      }),
      col.display({
        id: "receivedBy",
        header: "Received by",
        cell: ({ row: { original: p } }) =>
          (p as any).processedBy ? (
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 shrink-0 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 flex items-center justify-center text-[10px] font-semibold border border-violet-200 dark:border-violet-900/60">
                {(p as any).processedBy?.firstName?.[0] ?? "U"}
                {(p as any).processedBy?.lastName?.[0] ?? ""}
              </div>
              <span className="text-sm text-foreground truncate">
                {(p as any).processedBy?.firstName}{" "}
                {(p as any).processedBy?.lastName}
              </span>
            </div>
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="w-3 h-3" /> System
            </span>
          ),
      }),
    ];
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Sales" }, { label: "Payments" }]}
        title="Payments"
        description="Track all payments received, their methods, statuses, and associated orders."
        action={
          <div className="flex items-center gap-2">
            <PermissionGate one="sales.payments.create">
              <Button size="sm" onClick={() => setOpenCreate(true)} disabled={!canCreate}>
                <Plus className="w-4 h-4" /> New Payment
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <TableToolbar
        searchTerm={filters.search ?? ""}
        onSearchChange={(v) => pushParams({ search: v })}
        searchPlaceholder="Search by reference, payment number…"
        onCreateNew={canCreate ? () => setOpenCreate(true) : undefined}
        disableCreateNew={!canCreate}
        startContent={
          <>
            <GlobalDatePicker
              value={filters.dateFrom ?? null}
              onChange={(v) => pushParams({ dateFrom: v ?? undefined })}
              placeholder="From date"
              className="w-40"
            />
            <GlobalDatePicker
              value={filters.dateTo ?? null}
              onChange={(v) => pushParams({ dateTo: v ?? undefined })}
              placeholder="To date"
              className="w-40"
            />
            <GlobalSelect
              value={filters.paymentMethod ?? ""}
              onChange={(v) => pushParams({ method: v })}
              options={methodFilterOptions}
              placeholder="Method"
              className="w-40"
            />
            <GlobalSelect
              value={filters.status ?? ""}
              onChange={(v) => pushParams({ status: v })}
              options={statusFilterOptions}
              placeholder="Status"
              className="w-40"
            />
            <GlobalInput
              placeholder="Order ID search…"
              value={filters.orderId ?? ""}
              onChange={(e) => pushParams({ orderId: e.target.value })}
              className="w-48"
              showSearchIcon
            />
          </>
        }
      />

      <GlobalTable<PaymentSummary>
        columns={columns}
        data={payments}
        meta={meta as any}
        serverSide
        pageSizeDefault={25}
        defaultSortBy="createdAt"
        defaultSortOrder="desc"
        queryResult={{
          data: paymentsRes?.data as any,
          isFetching,
        }}
        getRowId={(p) => p.id}
        emptyIcon={<Receipt className="w-10 h-10" />}
        emptyTitle="No payments found"
        emptyDescription="No payments match the current filters."
        emptyAction={
          <PermissionGate one="sales.payments.create">
            <Button size="sm" onClick={() => setOpenCreate(true)}>
              <Plus className="w-4 h-4" /> New Payment
            </Button>
          </PermissionGate>
        }
        errorOnRetry={() => refetch()}
      />

      <GlobalModal
        open={openCreate}
        onOpenChange={(o) => !o && closeModal()}
        title="Record New Payment"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <PermissionGate one="sales.payments.create">
              <Button
                type="submit"
                form="paymentForm"
                disabled={createState.isLoading || !canCreate}
              >
                {createState.isLoading ? "Recording…" : "Record Payment"}
              </Button>
            </PermissionGate>
          </div>
        }
      >
        <form
          id="paymentForm"
          onSubmit={form.handleSubmit(onSubmitCreate as any)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <GlobalSelect
              label="Order"
              required
              value={form.watch("orderId")}
              onChange={(v) => form.setValue("orderId", v, { shouldValidate: true })}
              options={orderOptions}
              placeholder="Select order…"
              error={form.formState.errors.orderId?.message}
            />
            <GlobalSelect
              label="Payment Method"
              required
              value={form.watch("method")}
              onChange={(v) => form.setValue("method", v, { shouldValidate: true })}
              options={methodFormOptions}
              placeholder="Select method…"
              error={form.formState.errors.method?.message as any}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Amount"
              required
              inputType="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              error={form.formState.errors.amount?.message as any}
              {...form.register("amount")}
            />
            <GlobalInput
              label="Reference / Check #"
              error={form.formState.errors.reference?.message}
              {...form.register("reference")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Notes</label>
            <textarea
              rows={3}
              className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Internal notes for this payment…"
              maxLength={2000}
              {...form.register("notes")}
            />
            {form.formState.errors.notes?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {form.formState.errors.notes.message}
              </p>
            )}
          </div>
          {createState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (createState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to record payment."
              )}
            </div>
          )}
        </form>
      </GlobalModal>
    </div>
  );
}
