"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as Tabs from "@radix-ui/react-tabs";
import {
  ArrowLeft,
  FileText,
  CreditCard,
  RefreshCcw,
  Printer,
  Plus,
  Trash2,
  Mail,
  Phone,
  MapPin,
  User,
  CheckCircle2,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { GlobalTable } from "@/components/tables/GlobalTable";
import { GlobalModal } from "@/components/feedback/GlobalModal";
import { GlobalSelect } from "@/components/form/GlobalSelect";
import { GlobalInput } from "@/components/form/GlobalInput";
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
  useGetOrderByIdQuery,
  useUpdateOrderStatusMutation,
  useCreatePaymentMutation,
  useCreateRefundMutation,
  type OrderStatus,
  type PaymentMethod,
  type OrderDetail,
  type OrderItem,
  type PaymentDetail,
  type RefundDetail,
  type RefundStatus,
} from "@/lib/api/salesEndpoints";

function parseNum(v: string | number | undefined | null): number {
  if (v === undefined || v === null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const ORDER_STATUS_TONE: Record<
  OrderStatus,
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

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
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

const ORDER_STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REFUNDED", label: "Refunded" },
];

const PAYMENT_STATUS_TONE: Record<string, "slate" | "emerald" | "violet" | "rose"> = {
  PENDING: "slate",
  COMPLETED: "emerald",
  FAILED: "rose",
  REFUNDED: "rose",
};

const REFUND_STATUS_TONE: Record<
  RefundStatus,
  "slate" | "emerald" | "violet" | "rose"
> = {
  PENDING: "slate",
  APPROVED: "violet",
  REJECTED: "rose",
  PROCESSED: "emerald",
  COMPLETED: "emerald",
};

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CREDIT", label: "Credit" },
  { value: "CHECK", label: "Check" },
  { value: "MOBILE_PAYMENT", label: "Mobile" },
  { value: "OTHER", label: "Other" },
];

const paymentFormSchema = z.object({
  paymentMethod: z.enum([
    "CASH",
    "CARD",
    "BANK_TRANSFER",
    "CREDIT",
    "CHECK",
    "MOBILE_PAYMENT",
    "OTHER",
  ] as const),
  amount: z.union([z.number(), z.string().trim()]),
  referenceNumber: z.string().trim().max(255).optional().or(z.literal("")),
  paymentDate: z.string().trim().optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
type PaymentFormValues = z.infer<typeof paymentFormSchema>;

const refundFormSchema = z.object({
  reason: z.string().trim().max(1000).optional().or(z.literal("")),
  refundAmount: z.union([z.number(), z.string().trim()]),
  refundDate: z.string().trim().optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
type RefundFormValues = z.infer<typeof refundFormSchema>;

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = typeof params?.id === "string" ? params.id : "";
  const router = useRouter();
  const canUpdateStatus = useHasPermission({ one: "sales.orders.update" });
  const canCreatePayment = useHasPermission({ one: "sales.payments.create" });
  const canCreateRefund = useHasPermission({ one: "sales.refunds.create" });

  const { data, isFetching, isError, refetch } = useGetOrderByIdQuery(orderId, {
    refetchOnMountOrArgChange: true,
    skip: !orderId,
  });
  const order: OrderDetail | undefined = data?.success ? (data.data as OrderDetail) : undefined;

  const [updateStatusTrigger, updateStatusState] = useUpdateOrderStatusMutation();
  const [createPaymentTrigger, createPaymentState] = useCreatePaymentMutation();
  const [createRefundTrigger, createRefundState] = useCreateRefundMutation();

  const [payOpen, setPayOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<"success" | "error">("success");

  const showToast = useCallback(
    (msg: string, kind: "success" | "error" = "success") => {
      setToastMsg(msg);
      setToastKind(kind);
      const id = setTimeout(() => setToastMsg(null), 3500);
      return () => clearTimeout(id);
    },
    []
  );

  const totalPaid = useMemo(() => {
    return (order?.payments ?? [])
      .filter((p) => p.status === "COMPLETED")
      .reduce((sum, p) => sum + parseNum(p.amount), 0);
  }, [order?.payments]);

  const totalRefunded = useMemo(() => {
    return (order as any)?.refunds?.reduce(
      (sum: number, r: RefundDetail) => sum + parseNum(r.totalRefundAmount),
      0
    ) ?? 0;
  }, [order]);

  const handleChangeStatus = async (next: string) => {
    if (!order) return;
    const out = await updateStatusTrigger({
      id: order.id,
      body: { status: next as OrderStatus },
    });
    if ("data" in out && out.data?.success) {
      showToast(`Order status updated to ${ORDER_STATUS_LABEL[next as OrderStatus] ?? next}`, "success");
    } else {
      const err =
        (out as any)?.error?.data?.error?.message ?? "Failed to update status";
      showToast(err, "error");
    }
  };

  const payForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      paymentMethod: "CASH",
      amount: parseNum(order?.amountDue ?? order?.totalAmount ?? 0),
      referenceNumber: "",
      paymentDate: new Date().toISOString().slice(0, 10),
      notes: "",
    },
    mode: "onTouched",
  });

  const onSubmitPayment = async (v: PaymentFormValues) => {
    if (!order) return;
    const out = await createPaymentTrigger({
      orderId: order.id,
      customerId: order.customerId ?? undefined,
      paymentMethod: v.paymentMethod,
      amount: parseNum(v.amount),
      referenceNumber: (v.referenceNumber ?? undefined) as string | undefined,
      paymentDate: v.paymentDate,
      notes: (v.notes ?? undefined) as string | undefined,
    });
    if ("data" in out && out.data?.success) {
      showToast("Payment recorded successfully", "success");
      setPayOpen(false);
      payForm.reset({
        paymentMethod: "CASH",
        amount: 0,
        referenceNumber: "",
        paymentDate: new Date().toISOString().slice(0, 10),
        notes: "",
      });
    } else {
      const err =
        (out as any)?.error?.data?.error?.message ?? "Failed to record payment";
      showToast(err, "error");
    }
  };

  const refundForm = useForm<RefundFormValues>({
    resolver: zodResolver(refundFormSchema),
    defaultValues: {
      reason: "",
      refundAmount: parseNum(totalPaid - totalRefunded),
      refundDate: new Date().toISOString().slice(0, 10),
      notes: "",
    },
    mode: "onTouched",
  });

  const onSubmitRefund = async (v: RefundFormValues) => {
    if (!order) return;
    const items = (order.items ?? []).slice(0, 0);
    const out = await createRefundTrigger({
      orderId: order.id,
      reason: (v.reason ?? undefined) as string | undefined,
      refundAmount: parseNum(v.refundAmount),
      refundDate: v.refundDate,
      notes: (v.notes ?? undefined) as string | undefined,
      items: items as any,
    });
    if ("data" in out && out.data?.success) {
      showToast("Refund issued successfully", "success");
      setRefundOpen(false);
      refundForm.reset({
        reason: "",
        refundAmount: 0,
        refundDate: new Date().toISOString().slice(0, 10),
        notes: "",
      });
    } else {
      const err =
        (out as any)?.error?.data?.error?.message ?? "Failed to issue refund";
      showToast(err, "error");
    }
  };

  const items: OrderItem[] = order?.items ?? [];
  const payments: PaymentDetail[] = order?.payments ?? [];
  const refunds: RefundDetail[] = (order as any)?.refunds ?? [];

  const receiptColumns: ColumnDef<TableFeatures, OrderItem, any>[] = useMemo(() => {
    const col = createColumns<OrderItem>();
    return [
      col.display({
        id: "product",
        header: "Item",
        cell: ({ row: { original: it } }) => (
          <div className="min-w-0">
            <p className="font-medium text-foreground text-sm truncate">
              {it.product?.name ?? "—"}
            </p>
            {it.product?.sku && (
              <p className="text-[11px] font-mono text-muted-foreground">
                {it.product.sku}
              </p>
            )}
          </div>
        ),
      }),
      col.display({
        id: "qty",
        header: "Qty",
        cell: ({ row: { original: it } }) => (
          <span className="tabular-nums text-sm font-medium inline-block min-w-[3ch] text-center">
            {it.quantity}
          </span>
        ),
      }),
      col.display({
        id: "unit",
        header: "Unit Price",
        cell: ({ row: { original: it } }) => (
          <MoneyDisplay
            value={it.unitPrice}
            align="left"
            className="tabular-nums !text-sm !w-auto"
          />
        ),
      }),
      col.display({
        id: "tax",
        header: "Tax",
        cell: ({ row: { original: it } }) => (
          <MoneyDisplay
            value={it.taxAmount}
            align="left"
            className="tabular-nums !text-sm !w-auto text-muted-foreground"
          />
        ),
      }),
      col.display({
        id: "lineTotal",
        header: "Total",
        cell: ({ row: { original: it } }) => (
          <MoneyDisplay
            value={it.totalAmount}
            align="left"
            className="tabular-nums !text-sm !w-auto !font-semibold"
          />
        ),
      }),
    ];
  }, []);

  const paymentsColumns: ColumnDef<TableFeatures, PaymentDetail, any>[] = useMemo(() => {
    const col = createColumns<PaymentDetail>();
    return [
      col.display({
        id: "paymentNumber",
        header: "No.",
        cell: ({ row: { original: p } }) => (
          <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
            {p.paymentNumber}
          </span>
        ),
      }),
      col.display({
        id: "paymentDate",
        header: "Date",
        cell: ({ row: { original: p } }) => (
          <DateDisplay date={p.paymentDate} className="text-xs tabular-nums" />
        ),
      }),
      col.display({
        id: "method",
        header: "Method",
        cell: ({ row: { original: p } }) => (
          <StatusBadge
            tone="slate"
            size="sm"
            label={p.paymentMethod.replace("_", " ")}
          />
        ),
      }),
      col.display({
        id: "status",
        header: "Status",
        cell: ({ row: { original: p } }) => (
          <StatusBadge
            tone={PAYMENT_STATUS_TONE[p.status] ?? "slate"}
            size="sm"
            dot={p.status === "COMPLETED"}
            label={p.status.charAt(0) + p.status.slice(1).toLowerCase()}
          />
        ),
      }),
      col.display({
        id: "reference",
        header: "Reference",
        cell: ({ row: { original: p } }) => (
          <span className="text-xs text-muted-foreground font-mono truncate max-w-[20ch]">
            {p.referenceNumber || "—"}
          </span>
        ),
      }),
      col.display({
        id: "amount",
        header: "Amount",
        cell: ({ row: { original: p } }) => (
          <MoneyDisplay
            value={p.amount}
            align="left"
            className="tabular-nums !text-sm !w-auto !font-semibold"
          />
        ),
      }),
    ];
  }, []);

  const refundsColumns: ColumnDef<TableFeatures, RefundDetail, any>[] = useMemo(() => {
    const col = createColumns<RefundDetail>();
    return [
      col.display({
        id: "refundNumber",
        header: "No.",
        cell: ({ row: { original: r } }) => (
          <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
            {r.refundNumber}
          </span>
        ),
      }),
      col.display({
        id: "refundDate",
        header: "Date",
        cell: ({ row: { original: r } }) => (
          <DateDisplay date={r.refundDate} className="text-xs tabular-nums" />
        ),
      }),
      col.display({
        id: "status",
        header: "Status",
        cell: ({ row: { original: r } }) => (
          <StatusBadge
            tone={REFUND_STATUS_TONE[r.status] ?? "slate"}
            size="sm"
            label={r.status.charAt(0) + r.status.slice(1).toLowerCase()}
          />
        ),
      }),
      col.display({
        id: "reason",
        header: "Reason",
        cell: ({ row: { original: r } }) => (
          <span className="text-xs text-muted-foreground truncate max-w-[28ch]">
            {r.reason || "—"}
          </span>
        ),
      }),
      col.display({
        id: "amount",
        header: "Amount",
        cell: ({ row: { original: r } }) => (
          <MoneyDisplay
            value={r.totalRefundAmount}
            negativeClass="!text-rose-600 dark:!text-rose-400"
            align="left"
            className="tabular-nums !text-sm !w-auto !font-semibold"
          />
        ),
      }),
    ];
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 relative">
      {toastMsg && (
        <div
          className={cn(
            "fixed top-5 right-5 z-[100] animate-in slide-in-from-right-10 fade-in",
            "flex items-center gap-3 rounded-xl border shadow-lg px-4 py-3 min-w-[280px] max-w-md",
            toastKind === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200"
          )}
        >
          {toastKind === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <Trash2 className="w-5 h-5 shrink-0" />
          )}
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      <PageHeader
        breadcrumbs={[
          { label: "Sales", href: "/sales/orders" },
          { label: "Orders", href: "/sales/orders" },
          { label: order?.orderNumber ?? "Order" },
        ]}
        title={order?.orderNumber ?? "Order"}
        description={
          order
            ? `Created ${new Date(order.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}`
            : ""
        }
        action={
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/sales/orders")}
              className="text-slate-600 hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> All orders
            </Button>
            {order && (
              <PermissionGate one="sales.orders.update">
                <div className="w-56">
                  <GlobalSelect
                    value={order.status}
                    onChange={handleChangeStatus}
                    options={ORDER_STATUS_OPTIONS}
                    placeholder="Change status"
                    disabled={!canUpdateStatus || updateStatusState.isLoading}
                    className="space-y-0"
                  />
                </div>
              </PermissionGate>
            )}
          </div>
        }
      />

      {order && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm space-y-1">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Order Status
              </div>
              <StatusBadge
                tone={ORDER_STATUS_TONE[order.status]}
                size="md"
                dot={
                  order.status === "PROCESSING" || order.status === "SHIPPED"
                }
                label={ORDER_STATUS_LABEL[order.status] ?? order.status}
              />
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm space-y-1">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Total
              </div>
              <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                <MoneyDisplay
                  value={order.totalAmount}
                  align="left"
                  className="!text-2xl !font-bold !w-auto"
                />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm space-y-1">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Paid
              </div>
              <div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                <MoneyDisplay
                  value={totalPaid}
                  align="left"
                  positiveClass="!text-emerald-600 dark:!text-emerald-400"
                  className="!text-xl !font-semibold !w-auto"
                />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm space-y-1">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Due
              </div>
              <div
                className={cn(
                  "text-xl font-semibold tabular-nums",
                  parseNum(order.amountDue) > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-emerald-600 dark:text-emerald-400"
                )}
              >
                <MoneyDisplay
                  value={order.amountDue}
                  align="left"
                  className={cn(
                    "!text-xl !font-semibold !w-auto",
                    parseNum(order.amountDue) > 0
                      ? "!text-rose-600 dark:!text-rose-400"
                      : "!text-emerald-600 dark:!text-emerald-400"
                  )}
                />
              </div>
            </div>
          </div>

          <Tabs.Root defaultValue="receipt" className="space-y-4">
            <Tabs.List className="flex items-center gap-1 p-1 rounded-xl border border-border bg-slate-50 dark:bg-slate-900/50 w-fit">
              <Tabs.Trigger
                value="receipt"
                className="px-4 py-2 text-sm font-medium rounded-lg transition-all text-slate-600 dark:text-slate-400 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <span className="inline-flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Receipt
                </span>
              </Tabs.Trigger>
              <Tabs.Trigger
                value="payments"
                className="px-4 py-2 text-sm font-medium rounded-lg transition-all text-slate-600 dark:text-slate-400 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <span className="inline-flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> Payments
                  <span className="rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
                    {payments.length}
                  </span>
                </span>
              </Tabs.Trigger>
              <Tabs.Trigger
                value="refunds"
                className="px-4 py-2 text-sm font-medium rounded-lg transition-all text-slate-600 dark:text-slate-400 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCcw className="w-4 h-4" /> Refunds
                  <span className="rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
                    {refunds.length}
                  </span>
                </span>
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="receipt" className="space-y-4">
              <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
                      Receipt / Invoice
                    </div>
                    <h2 className="text-xl font-semibold text-foreground">
                      Order {order.orderNumber}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      tone={ORDER_STATUS_TONE[order.status]}
                      size="md"
                      label={ORDER_STATUS_LABEL[order.status] ?? order.status}
                    />
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                      <Printer className="w-4 h-4 mr-1" /> Print
                    </Button>
                  </div>
                </div>

                <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-200 dark:border-slate-800">
                  <div className="space-y-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">
                        Bill to
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center text-sm font-bold">
                          {initials(order.customer?.name ?? order.customerName)}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="font-semibold text-foreground">
                            {order.customer?.name ?? order.customerName ?? "— Walk-in Customer —"}
                          </div>
                          {order.customer?.customerCode && (
                            <div className="text-xs font-mono text-muted-foreground">
                              {order.customer.customerCode}
                            </div>
                          )}
                          {(order.customer?.email || order.customerEmail) && (
                            <div className="inline-flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400 mt-1">
                              <Mail className="w-3 h-3" />
                              {order.customer?.email || order.customerEmail}
                            </div>
                          )}
                          {(order.customer?.phone || order.customerPhone) && (
                            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                              <Phone className="w-3 h-3" />
                              {order.customer?.phone || order.customerPhone}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">
                        Ship / Fulfil from
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="font-semibold text-foreground">
                            {order.warehouse?.name ?? "— Default warehouse —"}
                          </div>
                          {order.warehouse?.warehouseCode && (
                            <div className="text-xs font-mono text-muted-foreground">
                              {order.warehouse.warehouseCode}
                            </div>
                          )}
                          {order.notes && (
                            <div className="text-xs text-muted-foreground mt-1.5 max-w-[42ch]">
                              {order.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">
                        Salesperson
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="h-7 w-7 inline-flex items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-xs font-semibold">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-foreground">
                          {order.salesperson
                            ? `${order.salesperson.firstName} ${order.salesperson.lastName}`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-6">
                  <GlobalTable<OrderItem>
                    columns={receiptColumns}
                    data={items}
                    serverSide={false}
                    syncUrl={false}
                    hidePagination
                    defaultSortBy="product"
                    defaultSortOrder="asc"
                    wrapperHeightClassName="relative"
                    emptyTitle="No line items"
                    emptyDescription="This order has no line items."
                    getRowId={(it) => it.id}
                    tableClassName="min-w-full"
                  />

                  <div className="mt-4 ml-auto w-full sm:max-w-sm">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-200 dark:divide-slate-800">
                      <div className="px-4 py-2.5 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <MoneyDisplay
                          value={order.subtotal}
                          align="left"
                          className="tabular-nums !w-auto"
                        />
                      </div>
                      <div className="px-4 py-2.5 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Discount</span>
                        <MoneyDisplay
                          value={-parseNum(order.discountAmount)}
                          align="left"
                          className="tabular-nums !w-auto"
                        />
                      </div>
                      <div className="px-4 py-2.5 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Tax</span>
                        <MoneyDisplay
                          value={order.taxAmount}
                          align="left"
                          className="tabular-nums !w-auto"
                        />
                      </div>
                      {parseNum(order.shippingAmount) > 0 && (
                        <div className="px-4 py-2.5 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Shipping</span>
                          <MoneyDisplay
                            value={order.shippingAmount}
                            align="left"
                            className="tabular-nums !w-auto"
                          />
                        </div>
                      )}
                      <div className="px-4 py-3 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/50">
                        <span className="font-semibold text-foreground">
                          Grand Total
                        </span>
                        <span className="text-xl font-bold text-foreground tabular-nums">
                          <MoneyDisplay
                            value={order.totalAmount}
                            align="left"
                            className="!text-xl !font-bold !w-auto"
                          />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Tabs.Content>

            <Tabs.Content value="payments" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground tabular-nums">
                    {payments.length}
                  </span>{" "}
                  payment{payments.length === 1 ? "" : "s"} attached to this order
                </div>
                <PermissionGate one="sales.payments.create">
                  <Button
                    size="sm"
                    onClick={() => {
                      payForm.reset({
                        paymentMethod: "CASH",
                        amount: parseNum(order.amountDue ?? 0),
                        referenceNumber: "",
                        paymentDate: new Date().toISOString().slice(0, 10),
                        notes: "",
                      });
                      setPayOpen(true);
                    }}
                    disabled={!canCreatePayment || parseNum(order.amountDue ?? 0) <= 0}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add payment
                  </Button>
                </PermissionGate>
              </div>

              <GlobalTable<PaymentDetail>
                columns={paymentsColumns}
                data={payments}
                serverSide={false}
                syncUrl={false}
                hidePagination
                defaultSortBy="paymentDate"
                defaultSortOrder="desc"
                getRowId={(p) => p.id}
                emptyIcon={<CreditCard className="w-10 h-10" />}
                emptyTitle="No payments yet"
                emptyDescription="Record a payment using the button above."
              />
            </Tabs.Content>

            <Tabs.Content value="refunds" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground tabular-nums">
                    {refunds.length}
                  </span>{" "}
                  refund{refunds.length === 1 ? "" : "s"} issued
                  {totalRefunded > 0 && (
                    <>
                      {" · "}
                      <span>
                        Total refunded:{" "}
                        <MoneyDisplay
                          value={totalRefunded}
                          className="!text-sm !font-semibold !w-auto !text-rose-600 dark:!text-rose-400"
                          align="left"
                        />
                      </span>
                    </>
                  )}
                </div>
                <PermissionGate one="sales.refunds.create">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    onClick={() => {
                      refundForm.reset({
                        reason: "",
                        refundAmount: parseNum(
                          Math.max(0, totalPaid - totalRefunded)
                        ),
                        refundDate: new Date().toISOString().slice(0, 10),
                        notes: "",
                      });
                      setRefundOpen(true);
                    }}
                    disabled={
                      !canCreateRefund ||
                      parseNum(Math.max(0, totalPaid - totalRefunded)) <= 0
                    }
                  >
                    <RefreshCcw className="w-4 h-4 mr-1" /> Issue refund
                  </Button>
                </PermissionGate>
              </div>

              <GlobalTable<RefundDetail>
                columns={refundsColumns}
                data={refunds}
                serverSide={false}
                syncUrl={false}
                hidePagination
                defaultSortBy="refundDate"
                defaultSortOrder="desc"
                getRowId={(r) => r.id}
                emptyIcon={<RefreshCcw className="w-10 h-10" />}
                emptyTitle="No refunds issued"
                emptyDescription="Refunds will appear here once processed."
              />
            </Tabs.Content>
          </Tabs.Root>
        </>
      )}

      {!order && !isError && (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3 animate-pulse">
            <FileText className="w-7 h-7" />
          </div>
          <p className="text-sm font-medium text-foreground">Loading order…</p>
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-6 text-center">
          <p className="text-sm font-medium text-rose-700 dark:text-rose-300 mb-2">
            Could not load this order
          </p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      <GlobalModal
        open={payOpen}
        onOpenChange={(o) => !createPaymentState.isLoading && setPayOpen(o)}
        size="lg"
        title="Record payment"
        description="Apply a payment to this sales order."
        dismissable={!createPaymentState.isLoading}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPayOpen(false)}
              disabled={createPaymentState.isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="paymentForm"
              disabled={createPaymentState.isLoading}
            >
              {createPaymentState.isLoading ? "Saving…" : "Record payment"}
            </Button>
          </div>
        }
      >
        <form
          id="paymentForm"
          onSubmit={payForm.handleSubmit(onSubmitPayment)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlobalDatePicker
              label="Payment date"
              value={payForm.watch("paymentDate") ?? null}
              onChange={(v) =>
                payForm.setValue(
                  "paymentDate",
                  v ?? new Date().toISOString().slice(0, 10),
                  { shouldValidate: true }
                )
              }
            />
            <GlobalSelect
              label="Payment method"
              required
              value={payForm.watch("paymentMethod")}
              onChange={(v) =>
                payForm.setValue(
                  "paymentMethod",
                  v as PaymentMethod,
                  { shouldValidate: true }
                )
              }
              options={PAYMENT_METHOD_OPTIONS}
              placeholder="Select method"
              error={payForm.formState.errors.paymentMethod?.message}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Amount
              <span className="ml-0.5 text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              {...payForm.register("amount")}
              placeholder="0.00"
              className={cn(
                "w-full h-10 rounded-lg border bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 tabular-nums"
              )}
            />
            {payForm.formState.errors.amount?.message && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {String(payForm.formState.errors.amount.message)}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Balance due:{" "}
              <MoneyDisplay
                value={order?.amountDue ?? 0}
                align="left"
                className="!text-[11px] !font-medium !w-auto"
              />
            </p>
          </div>
          <GlobalInput
            label="Reference number"
            placeholder="Cheque, transfer, authorization, or receipt ID"
            error={payForm.formState.errors.referenceNumber?.message}
            {...payForm.register("referenceNumber")}
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Notes
            </label>
            <textarea
              rows={3}
              maxLength={2000}
              placeholder="Optional internal notes for this payment"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              {...payForm.register("notes")}
            />
            {payForm.formState.errors.notes?.message && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {String(payForm.formState.errors.notes.message)}
              </p>
            )}
          </div>
          {createPaymentState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (createPaymentState.error as {
                  data?: { error?: { message?: string } };
                })?.data?.error?.message ?? "Failed to record payment."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <GlobalModal
        open={refundOpen}
        onOpenChange={(o) => !createRefundState.isLoading && setRefundOpen(o)}
        size="lg"
        title="Issue refund"
        description="Record a refund against this order."
        dismissable={!createRefundState.isLoading}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRefundOpen(false)}
              disabled={createRefundState.isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="refundForm"
              variant="destructive"
              disabled={createRefundState.isLoading}
            >
              {createRefundState.isLoading ? "Processing…" : "Issue refund"}
            </Button>
          </div>
        }
      >
        <form
          id="refundForm"
          onSubmit={refundForm.handleSubmit(onSubmitRefund)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlobalDatePicker
              label="Refund date"
              value={refundForm.watch("refundDate") ?? null}
              onChange={(v) =>
                refundForm.setValue(
                  "refundDate",
                  v ?? new Date().toISOString().slice(0, 10),
                  { shouldValidate: true }
                )
              }
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Refund amount
                <span className="ml-0.5 text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                {...refundForm.register("refundAmount")}
                placeholder="0.00"
                className={cn(
                  "w-full h-10 rounded-lg border bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 tabular-nums border-rose-200 dark:border-rose-900"
                )}
              />
              {refundForm.formState.errors.refundAmount?.message && (
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                  {String(refundForm.formState.errors.refundAmount.message)}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Paid (net of prior refunds):{" "}
                <MoneyDisplay
                  value={Math.max(0, totalPaid - totalRefunded)}
                  align="left"
                  className="!text-[11px] !font-medium !w-auto"
                />
              </p>
            </div>
          </div>
          <GlobalInput
            label="Reason"
            placeholder="Customer returned, damaged item, etc."
            error={refundForm.formState.errors.reason?.message}
            {...refundForm.register("reason")}
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Notes
            </label>
            <textarea
              rows={3}
              maxLength={2000}
              placeholder="Optional internal notes"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              {...refundForm.register("notes")}
            />
            {refundForm.formState.errors.notes?.message && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {String(refundForm.formState.errors.notes.message)}
              </p>
            )}
          </div>
          {createRefundState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (createRefundState.error as {
                  data?: { error?: { message?: string } };
                })?.data?.error?.message ?? "Failed to issue refund."
              )}
            </div>
          )}
        </form>
      </GlobalModal>
    </div>
  );
}
