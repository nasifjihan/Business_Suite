"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as Switch from "@radix-ui/react-switch";
import Link from "next/link";
import { RotateCcw, Plus, Hash, Package, AlertTriangle, User } from "lucide-react";
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
  useListRefundsQuery,
  useListOrdersQuery,
  useListOrderItemsByOrderIdQuery,
  useCreateRefundMutation,
} from "@/lib/api/salesEndpoints";
import type {
  RefundSummary,
  ListRefundsArgs,
  OrderSummaryItem,
  OrderItem,
} from "@/lib/api/salesEndpoints";

const extract = <T,>(resp?: { success: true; data: { items: T[]; meta: unknown } }) =>
  resp?.data ?? { items: [] as T[], meta: undefined };

const REFUND_REASON_TONE: Record<string, "rose" | "slate" | "violet" | "sky"> = {
  DEFECTIVE: "rose",
  WRONG_ITEM: "slate",
  DAMAGED: "violet",
  CUSTOMER_CHANGE: "sky",
  OTHER: "slate",
};

const reasonFilterOptions = [
  { value: "", label: "All reasons" },
  { value: "DEFECTIVE", label: "Defective" },
  { value: "WRONG_ITEM", label: "Wrong Item" },
  { value: "DAMAGED", label: "Damaged" },
  { value: "CUSTOMER_CHANGE", label: "Customer Change" },
  { value: "OTHER", label: "Other" },
];

const reasonFormOptions = reasonFilterOptions.filter((o) => o.value !== "");

const refundFormSchema = z.object({
  orderId: z.string().trim().min(1, "Required"),
  orderItemId: z.string().trim().min(1, "Required"),
  qty: z.union([z.number(), z.string().trim()]).refine((v) => {
    const n = typeof v === "number" ? v : parseInt(v, 10);
    return isFinite(n) && n > 0;
  }, "Quantity must be greater than 0"),
  amount: z.union([z.number(), z.string().trim()]).refine((v) => {
    const n = typeof v === "number" ? v : parseFloat(v);
    return isFinite(n) && n > 0;
  }, "Amount must be greater than 0"),
  reason: z.string().min(1, "Required"),
  restock: z.boolean().default(true),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});
type RefundFormValues = z.infer<typeof refundFormSchema>;

export default function RefundsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canCreate = useHasPermission({ one: "sales.refunds.create" });

  const filters: ListRefundsArgs = useMemo(() => {
    const page = parseInt(searchParams?.get("page") ?? "1", 10) || 1;
    const pageSize = parseInt(searchParams?.get("pageSize") ?? "25", 10) || 25;
    return {
      page,
      pageSize,
      search: searchParams?.get("search") ?? "",
      orderId: searchParams?.get("orderId") || undefined,
      dateFrom: searchParams?.get("dateFrom") || undefined,
      dateTo: searchParams?.get("dateTo") || undefined,
      sortBy: searchParams?.get("sortBy") ?? "createdAt",
      sortOrder: (searchParams?.get("sortOrder") as "asc" | "desc") ?? "desc",
    };
  }, [searchParams]);

  const reasonFilter = searchParams?.get("reason") || "";

  const { data: refundsRes, isFetching, refetch } = useListRefundsQuery(
    { ...filters, status: reasonFilter ? undefined : undefined },
    {
      refetchOnMountOrArgChange: true,
    }
  );
  const { data: ordersRes } = useListOrdersQuery({ pageSize: 100 });

  const refunds = extract(refundsRes as any).items as RefundSummary[];
  const meta = extract(refundsRes as any).meta;
  const orders = extract(ordersRes as any).items as OrderSummaryItem[];

  const filteredRefunds = useMemo(() => {
    if (!reasonFilter) return refunds;
    return refunds.filter((r) => (r as any).reason === reasonFilter);
  }, [refunds, reasonFilter]);

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
  const [createTrigger, createState] = useCreateRefundMutation();

  const form = useForm<RefundFormValues>({
    resolver: zodResolver(refundFormSchema) as any,
    defaultValues: {
      orderId: "",
      orderItemId: "",
      qty: 1,
      amount: "",
      reason: "OTHER",
      restock: true,
      note: "",
    },
    mode: "onTouched",
  });

  const selectedOrderId = form.watch("orderId");
  const { data: orderItemsRes } = useListOrderItemsByOrderIdQuery(selectedOrderId, {
    skip: !selectedOrderId,
  });

  const orderItems = (orderItemsRes?.data as any)?.items as OrderItem[] | undefined;

  const orderItemOptions = useMemo(() => {
    if (!orderItems) return [];
    return orderItems.map((oi) => ({
      value: oi.id,
      label: `${oi.product?.name ?? "Item"} (${oi.quantity} available)`,
    }));
  }, [orderItems]);

  useEffect(() => {
    if (openCreate) {
      form.reset({
        orderId: "",
        orderItemId: "",
        qty: 1,
        amount: "",
        reason: "OTHER",
        restock: true,
        note: "",
      });
    }
  }, [openCreate, form]);

  useEffect(() => {
    if (selectedOrderId) {
      form.setValue("orderItemId", "", { shouldValidate: true });
      form.setValue("qty", 1);
      form.setValue("amount", "");
    }
  }, [selectedOrderId, form]);

  const closeModal = () => {
    setOpenCreate(false);
    form.reset();
  };

  const parseNum = (v: string | number | undefined): number => {
    const n = typeof v === "number" ? v : parseFloat(v ?? "0");
    return isFinite(n) ? n : 0;
  };
  const parseIntNum = (v: string | number | undefined): number => {
    const n = typeof v === "number" ? v : parseInt(v ?? "0", 10);
    return isFinite(n) ? n : 0;
  };

  const onSubmitCreate = async (v: any) => {
    const selectedItem = orderItems?.find((oi) => oi.id === v.orderItemId);
    const out = await createTrigger({
      orderId: v.orderId,
      reason: v.reason,
      items: [
        {
          orderItemId: v.orderItemId,
          productId: selectedItem?.productId ?? "",
          quantity: parseIntNum(v.qty),
          refundAmount: parseNum(v.amount),
          reason: v.reason,
          restock: v.restock,
        },
      ],
      refundAmount: parseNum(v.amount),
      notes: v.note || undefined,
    });
    if ("data" in out && out.data?.success) {
      closeModal();
    }
  };

  const columns: ColumnDef<TableFeatures, RefundSummary, any>[] = useMemo(() => {
    const col = createColumns<RefundSummary>();

    return [
      col.display({
        id: "refundNo",
        header: "Refund #",
        enableSorting: true,
        cell: ({ row: { original: r } }) => (
          <span className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-2 py-0.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
            <Hash className="w-3 h-3 mr-1 text-slate-400" />
            {r.refundNumber}
          </span>
        ),
      }),
      col.display({
        id: "orderId",
        header: "Order",
        cell: ({ row: { original: r } }) => (
          <Link
            href={`/sales/orders/${(r as any).orderId ?? "#"}`}
            className="inline-flex items-center gap-1 rounded-md bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 px-2 py-0.5 text-xs font-medium border border-sky-200 dark:border-sky-900/60 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            {r.orderNumber}
          </Link>
        ),
      }),
      col.display({
        id: "product",
        header: "Product",
        cell: ({ row: { original: r } }) =>
          (r as any).productName ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 shrink-0 rounded-md bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 flex items-center justify-center border border-teal-200 dark:border-teal-900/60">
                <Package className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm text-foreground truncate">
                {(r as any).productName}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Multiple items
            </span>
          ),
      }),
      col.display({
        id: "reason",
        header: "Reason",
        cell: ({ row: { original: r } }) => {
          const reasonVal = (r as any).reason ?? "OTHER";
          return (
            <StatusBadge
              tone={(REFUND_REASON_TONE[reasonVal] ?? "slate") as any}
              size="md"
              icon={<AlertTriangle className="w-3 h-3" />}
              label={
                reasonVal === "CUSTOMER_CHANGE"
                  ? "Customer Change"
                  : reasonVal === "WRONG_ITEM"
                  ? "Wrong Item"
                  : reasonVal.charAt(0) + reasonVal.slice(1).toLowerCase()
              }
            />
          );
        },
      }),
      col.display({
        id: "qty",
        header: "Qty",
        cell: ({ row: { original: r } }) => (
          <span className="inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300 tabular-nums min-w-[3ch]">
            {(r as any).quantity ?? 1}
          </span>
        ),
      }),
      col.display({
        id: "amount",
        header: "Amount",
        cell: ({ row: { original: r } }) => (
          <MoneyDisplay value={r.totalRefundAmount} negativeClass="text-rose-600 dark:text-rose-400 font-medium" />
        ),
      }),
      col.display({
        id: "processedBy",
        header: "Processed by",
        cell: ({ row: { original: r } }) =>
          (r as any).processedBy ? (
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 shrink-0 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 flex items-center justify-center text-[10px] font-semibold border border-violet-200 dark:border-violet-900/60">
                {(r as any).processedBy?.firstName?.[0] ?? "U"}
                {(r as any).processedBy?.lastName?.[0] ?? ""}
              </div>
              <span className="text-sm text-foreground truncate">
                {(r as any).processedBy?.firstName}{" "}
                {(r as any).processedBy?.lastName}
              </span>
            </div>
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="w-3 h-3" /> Pending
            </span>
          ),
      }),
      col.display({
        id: "refundDate",
        header: "Refund Date",
        enableSorting: true,
        cell: ({ row: { original: r } }) => (
          <DateDisplay date={r.refundDate} format="short" />
        ),
      }),
    ];
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Sales" }, { label: "Refunds" }]}
        title="Refunds"
        description="Process and track product refunds, return reasons, and inventory restocking."
        action={
          <div className="flex items-center gap-2">
            <PermissionGate one="sales.refunds.create">
              <Button size="sm" onClick={() => setOpenCreate(true)} disabled={!canCreate}>
                <Plus className="w-4 h-4" /> Create Refund
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <TableToolbar
        searchTerm={filters.search ?? ""}
        onSearchChange={(v) => pushParams({ search: v })}
        searchPlaceholder="Search by refund number…"
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
              value={reasonFilter}
              onChange={(v) => pushParams({ reason: v })}
              options={reasonFilterOptions}
              placeholder="Reason"
              className="w-44"
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

      <GlobalTable<RefundSummary>
        columns={columns}
        data={filteredRefunds}
        meta={meta as any}
        serverSide
        pageSizeDefault={25}
        defaultSortBy="createdAt"
        defaultSortOrder="desc"
        queryResult={{
          data: refundsRes?.data as any,
          isFetching,
        }}
        getRowId={(r) => r.id}
        emptyIcon={<RotateCcw className="w-10 h-10" />}
        emptyTitle="No refunds found"
        emptyDescription="No refunds match the current filters."
        emptyAction={
          <PermissionGate one="sales.refunds.create">
            <Button size="sm" onClick={() => setOpenCreate(true)}>
              <Plus className="w-4 h-4" /> Create Refund
            </Button>
          </PermissionGate>
        }
        errorOnRetry={() => refetch()}
      />

      <GlobalModal
        open={openCreate}
        onOpenChange={(o) => !o && closeModal()}
        title="Create Refund"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <PermissionGate one="sales.refunds.create">
              <Button
                type="submit"
                form="refundForm"
                disabled={createState.isLoading || !canCreate}
              >
                {createState.isLoading ? "Processing…" : "Process Refund"}
              </Button>
            </PermissionGate>
          </div>
        }
      >
        <form
          id="refundForm"
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
              label="Order Item"
              required
              disabled={!selectedOrderId}
              value={form.watch("orderItemId")}
              onChange={(v) => form.setValue("orderItemId", v, { shouldValidate: true })}
              options={orderItemOptions}
              placeholder={selectedOrderId ? "Select item…" : "Select order first"}
              error={form.formState.errors.orderItemId?.message}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <GlobalInput
              label="Quantity"
              required
              inputType="number"
              inputMode="numeric"
              step="1"
              min="1"
              error={form.formState.errors.qty?.message as any}
              {...form.register("qty")}
            />
            <GlobalInput
              label="Refund Amount"
              required
              inputType="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              error={form.formState.errors.amount?.message as any}
              {...form.register("amount")}
            />
            <GlobalSelect
              label="Reason"
              required
              value={form.watch("reason")}
              onChange={(v) =>
                form.setValue("reason", v as any, { shouldValidate: true })
              }
              options={reasonFormOptions}
              placeholder="Select reason…"
              error={form.formState.errors.reason?.message}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Restock item</p>
              <p className="text-xs text-muted-foreground">
                Return quantity to available stock in warehouse
              </p>
            </div>
            <Switch.Root
              checked={form.watch("restock")}
              onCheckedChange={(v) => form.setValue("restock", v)}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/70 focus:ring-offset-2 bg-slate-200 dark:bg-slate-700 data-[state=checked]:bg-primary"
            >
              <Switch.Thumb className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-md transition-transform data-[state=checked]:translate-x-5" />
            </Switch.Root>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Note</label>
            <textarea
              rows={3}
              className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Refund explanation, customer feedback, or internal notes…"
              maxLength={2000}
              {...form.register("note")}
            />
            {form.formState.errors.note?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {form.formState.errors.note.message}
              </p>
            )}
          </div>
          {createState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (createState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to process refund."
              )}
            </div>
          )}
        </form>
      </GlobalModal>
    </div>
  );
}
