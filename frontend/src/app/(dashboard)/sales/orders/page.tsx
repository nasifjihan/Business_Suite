"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShoppingBag,
  PackageSearch,
  Eye,
  XCircle,
  Trash2,
  User,
  Hash,
  FilterX,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchInput } from "@/components/tables/SearchInput";
import { GlobalTable } from "@/components/tables/GlobalTable";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { GlobalSelect } from "@/components/form/GlobalSelect";
import { GlobalDatePicker } from "@/components/form/GlobalDatePicker";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { MoneyDisplay } from "@/components/common/MoneyDisplay";
import {
  PermissionGate,
  useHasPermission,
} from "@/components/auth/PermissionGate";
import { createColumns, type TableFeatures } from "@/lib/table-utils";
import { cn } from "@/lib/utils";
import {
  useListOrdersQuery,
  useRemoveOrderMutation,
  useUpdateOrderStatusMutation,
  type OrderStatus as OrderStatusEnum,
  type PaymentStatus as PaymentStatusEnum,
  type OrderSummaryItem,
  type ListOrdersArgs,
} from "@/lib/api/salesEndpoints";
import {
  useListCustomersQuery,
} from "@/lib/api/crmEndpoints";
import {
  useListWarehousesQuery,
} from "@/lib/api/inventoryEndpoints";

const extract = <T,>(resp?: { success: true; data: { items: T[]; meta: unknown } }) =>
  resp?.data ?? { items: [] as T[], meta: undefined };

const ORDER_STATUS_TONE: Record<
  OrderStatusEnum,
  "slate" | "sky" | "violet" | "teal" | "emerald" | "rose"
> = {
  DRAFT: "slate",
  PENDING: "slate",
  CONFIRMED: "sky",
  PROCESSING: "violet",
  SHIPPED: "teal",
  DELIVERED: "emerald",
  COMPLETED: "emerald",
  CANCELLED: "rose",
  REFUNDED: "rose",
};

const ORDER_STATUS_LABEL: Record<OrderStatusEnum, string> = {
  DRAFT: "Draft",
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

const PAYMENT_STATUS_TONE: Record<
  PaymentStatusEnum,
  "slate" | "emerald" | "violet" | "rose"
> = {
  UNPAID: "slate",
  PARTIALLY_PAID: "violet",
  PAID: "emerald",
  OVERPAID: "emerald",
  REFUNDED: "rose",
  PARTIALLY_REFUNDED: "rose",
};

const PAYMENT_STATUS_LABEL: Record<PaymentStatusEnum, string> = {
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partial",
  PAID: "Paid",
  OVERPAID: "Overpaid",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partial Rfd",
};

const ORDER_STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REFUNDED", label: "Refunded" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "", label: "All payments" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIALLY_PAID", label: "Partial" },
  { value: "PAID", label: "Paid" },
  { value: "OVERPAID", label: "Overpaid" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "PARTIALLY_REFUNDED", label: "Partial refund" },
];

type ModalState =
  | { kind: "none" }
  | { kind: "cancel"; order: OrderSummaryItem }
  | { kind: "delete"; order: OrderSummaryItem };

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canUpdate = useHasPermission({ one: "sales.orders.update" });
  const canDelete = useHasPermission({ one: "sales.orders.delete" });

  const filters: ListOrdersArgs = useMemo(() => {
    const page = parseInt(searchParams?.get("page") ?? "1", 10) || 1;
    const pageSize = parseInt(searchParams?.get("pageSize") ?? "25", 10) || 25;
    return {
      page,
      pageSize,
      search: searchParams?.get("search") ?? "",
      status: (searchParams?.get("status") as OrderStatusEnum | undefined) || undefined,
      paymentStatus: (searchParams?.get("paymentStatus") as PaymentStatusEnum | undefined) || undefined,
      customerId: searchParams?.get("customerId") || undefined,
      warehouseId: searchParams?.get("warehouseId") || undefined,
      dateFrom: searchParams?.get("dateFrom") || undefined,
      dateTo: searchParams?.get("dateTo") || undefined,
      sortBy: searchParams?.get("sortBy") ?? "createdAt",
      sortOrder: (searchParams?.get("sortOrder") as "asc" | "desc") ?? "desc",
    };
  }, [searchParams]);

  const { data: ordersRes, isFetching, refetch } = useListOrdersQuery(filters, {
    refetchOnMountOrArgChange: true,
  });
  const { data: customersRes } = useListCustomersQuery({ pageSize: 200 });
  const { data: whRes } = useListWarehousesQuery({ pageSize: 100 });

  const orders = extract(ordersRes as any).items as OrderSummaryItem[];
  const meta = extract(ordersRes as any).meta;
  const customers = extract(customersRes as any).items as any[];
  const warehouses = extract(whRes as any).items as any[];

  const customerOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      { value: "", label: "All customers" },
    ];
    customers.forEach((c: any) =>
      opts.push({ value: c.id, label: c.name || c.customerCode || c.id })
    );
    return opts;
  }, [customers]);

  const warehouseOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      { value: "", label: "All warehouses" },
    ];
    warehouses.forEach((w: any) =>
      opts.push({ value: w.id, label: w.name || w.warehouseCode || w.id })
    );
    return opts;
  }, [warehouses]);

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

  const resetFilters = () => {
    router.push("", { scroll: false });
  };

  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [removeTrigger, removeState] = useRemoveOrderMutation();
  const [updateStatusTrigger, updateStatusState] = useUpdateOrderStatusMutation();

  const handleCancel = async () => {
    if (modal.kind !== "cancel") return;
    await updateStatusTrigger({
      id: modal.order.id,
      body: { status: "CANCELLED" as OrderStatusEnum },
    });
    setModal({ kind: "none" });
  };

  const handleDelete = async () => {
    if (modal.kind !== "delete") return;
    await removeTrigger(modal.order.id);
    setModal({ kind: "none" });
  };

  const columns: ColumnDef<TableFeatures, OrderSummaryItem, any>[] = useMemo(() => {
    const col = createColumns<OrderSummaryItem>();
    return [
      col.display({
        id: "orderNumber",
        header: "No.",
        enableSorting: true,
        cell: ({ row: { original: o } }) => (
          <span className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-2 py-0.5 font-mono text-[11px] text-slate-700 dark:text-slate-300 max-w-[18ch] truncate">
            <Hash className="w-3 h-3 mr-1 text-slate-400" />
            {o.orderNumber}
          </span>
        ),
      }),
      col.display({
        id: "customer",
        header: "Customer",
        cell: ({ row: { original: o } }) => (
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 shrink-0 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center text-xs font-semibold">
              {initials(o.customerName)}
            </div>
            <span className="font-medium text-foreground truncate min-w-0">
              {o.customerName || <span className="text-muted-foreground">— Walk-in —</span>}
            </span>
          </div>
        ),
      }),
      col.display({
        id: "status",
        header: "Status",
        cell: ({ row: { original: o } }) => (
          <StatusBadge
            tone={ORDER_STATUS_TONE[o.status] ?? "slate"}
            size="md"
            dot={o.status === "PROCESSING" || o.status === "SHIPPED"}
            label={ORDER_STATUS_LABEL[o.status] ?? o.status}
          />
        ),
      }),
      col.display({
        id: "paymentStatus",
        header: "Payment",
        cell: ({ row: { original: o } }) => (
          <StatusBadge
            tone={PAYMENT_STATUS_TONE[o.paymentStatus] ?? "slate"}
            size="md"
            dot={o.paymentStatus === "PAID" || o.paymentStatus === "OVERPAID"}
            label={PAYMENT_STATUS_LABEL[o.paymentStatus] ?? o.paymentStatus}
          />
        ),
      }),
      col.display({
        id: "totalAmount",
        header: "Total",
        cell: ({ row: { original: o } }) => (
          <MoneyDisplay
            value={o.totalAmount}
            className="font-semibold !w-auto"
            align="left"
          />
        ),
      }),
      col.display({
        id: "items",
        header: "Items",
        cell: () => (
          <span className="inline-flex items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2 py-0.5 text-[11px] font-semibold tabular-nums min-w-[2ch]">
            —
          </span>
        ),
      }),
      col.display({
        id: "createdAt",
        header: "Date",
        cell: ({ row: { original: o } }) => (
          <DateDisplay
            date={(o as any).createdAt}
            className="text-xs text-muted-foreground tabular-nums"
          />
        ),
      }),
      col.display({
        id: "createdBy",
        header: "By",
        cell: () => (
          <div className="h-7 w-7 inline-flex items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-[11px] font-semibold">
            <User className="w-3.5 h-3.5" />
          </div>
        ),
      }),
      col.display({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row: { original: o } }) => {
          const cancellable =
            o.status !== "CANCELLED" &&
            o.status !== "REFUNDED" &&
            o.status !== "DELIVERED" &&
            o.status !== "COMPLETED";
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/sales/orders/${o.id}`)}
                className="text-slate-600 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 h-7 px-2"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline ml-1">View</span>
              </Button>
              <PermissionGate one="sales.orders.update">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModal({ kind: "cancel", order: o })}
                  disabled={!canUpdate || !cancellable}
                  className={cn(
                    "h-7 px-2 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900",
                    "hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  )}
                  title="Mark as cancelled"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </Button>
              </PermissionGate>
              <PermissionGate one="sales.orders.delete">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModal({ kind: "delete", order: o })}
                  disabled={!canDelete}
                  className={cn(
                    "h-7 px-2 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900",
                    "hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  )}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </PermissionGate>
            </div>
          );
        },
      }),
    ];
  }, [canUpdate, canDelete, router]);

  const filtersActive =
    filters.status ||
    filters.paymentStatus ||
    filters.customerId ||
    filters.warehouseId ||
    filters.dateFrom ||
    filters.dateTo;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Sales", href: "/sales/orders" },
          { label: "Orders" },
        ]}
        title="Sales Orders"
        description="Track and manage all customer orders, payments, and fulfilment status."
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => router.push("/sales/pos")}>
              <ShoppingBag className="w-4 h-4" /> Quick Sale (POS)
            </Button>
          </div>
        }
      />

      <div className="rounded-xl border border-border bg-card p-3 shadow-sm space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <SearchInput
            value={filters.search ?? ""}
            onChange={(v) => pushParams({ search: v })}
            placeholder="Search order no. or customer…"
            className="w-full sm:max-w-xs"
          />
          <GlobalDatePicker
            label="From"
            value={filters.dateFrom ?? null}
            onChange={(v) => pushParams({ dateFrom: v ?? undefined })}
            allowClear
            className="w-44"
          />
          <GlobalDatePicker
            label="To"
            value={filters.dateTo ?? null}
            onChange={(v) => pushParams({ dateTo: v ?? undefined })}
            allowClear
            className="w-44"
          />
          <GlobalSelect
            label="Status"
            value={filters.status ?? ""}
            onChange={(v) => pushParams({ status: v })}
            options={ORDER_STATUS_OPTIONS}
            placeholder="Any"
            className="w-40"
          />
          <GlobalSelect
            label="Payment"
            value={filters.paymentStatus ?? ""}
            onChange={(v) => pushParams({ paymentStatus: v })}
            options={PAYMENT_STATUS_OPTIONS}
            placeholder="Any"
            className="w-40"
          />
          <GlobalSelect
            label="Customer"
            value={filters.customerId ?? ""}
            onChange={(v) => pushParams({ customerId: v })}
            options={customerOptions}
            placeholder="Any"
            className="w-48"
          />
          <GlobalSelect
            label="Warehouse"
            value={filters.warehouseId ?? ""}
            onChange={(v) => pushParams({ warehouseId: v })}
            options={warehouseOptions}
            placeholder="Any"
            className="w-44"
          />
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-slate-500 h-10"
            >
              <FilterX className="w-4 h-4 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      <GlobalTable<OrderSummaryItem>
        columns={columns}
        data={orders}
        meta={meta as any}
        serverSide
        pageSizeDefault={25}
        defaultSortBy="createdAt"
        defaultSortOrder="desc"
        queryResult={{
          data: ordersRes?.data as any,
          isFetching,
        }}
        getRowId={(o) => o.id}
        onRowClick={(o) => router.push(`/sales/orders/${o.id}`)}
        emptyIcon={<PackageSearch className="w-10 h-10" />}
        emptyTitle="No orders found"
        emptyDescription="No sales orders match the current filters."
        emptyAction={
          <Button size="sm" onClick={() => router.push("/sales/pos")}>
            <ShoppingBag className="w-4 h-4" /> New order (POS)
          </Button>
        }
        errorOnRetry={() => refetch()}
      />

      <ConfirmDialog
        open={modal.kind === "cancel"}
        onOpenChange={(o) => !o && setModal({ kind: "none" })}
        title="Cancel order"
        variant="destructive"
        description={
          modal.kind === "cancel"
            ? `Cancelling order ${modal.order.orderNumber} will release reserved stock and mark the order as permanently cancelled. This action cannot be undone.`
            : ""
        }
        confirmText={updateStatusState.isLoading ? "Cancelling…" : "Cancel order"}
        loading={updateStatusState.isLoading}
        icon={<XCircle className="w-5 h-5" />}
        onConfirm={handleCancel}
      />

      <ConfirmDialog
        open={modal.kind === "delete"}
        onOpenChange={(o) => !o && setModal({ kind: "none" })}
        title="Permanently delete order"
        variant="destructive"
        description={
          modal.kind === "delete"
            ? `Deleting order ${modal.order.orderNumber} will remove all associated line items, payments, and audit data. This operation cannot be undone.`
            : ""
        }
        confirmText={removeState.isLoading ? "Deleting…" : "Delete order"}
        loading={removeState.isLoading}
        icon={<Trash2 className="w-5 h-5" />}
        onConfirm={handleDelete}
      />
    </div>
  );
}
