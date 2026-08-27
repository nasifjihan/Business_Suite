"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Search,
  CreditCard,
  Banknote,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/tables/SearchInput";
import { GlobalTable } from "@/components/tables/GlobalTable";
import { GlobalModal } from "@/components/feedback/GlobalModal";
import { GlobalInput } from "@/components/form/GlobalInput";
import { GlobalSelect } from "@/components/form/GlobalSelect";
import { MoneyDisplay } from "@/components/common/MoneyDisplay";
import { StatusBadge } from "@/components/common/StatusBadge";
import { createColumns, type TableFeatures } from "@/lib/table-utils";
import { cn } from "@/lib/utils";
import {
  useListProductsQuery,
  useListWarehousesQuery,
} from "@/lib/api/inventoryEndpoints";
import {
  useCheckoutOrderMutation,
  type PaymentMethod,
} from "@/lib/api/salesEndpoints";
import type { ProductItem, WarehouseItem } from "@/lib/api/inventoryEndpoints";

const extract = <T,>(resp?: { success: true; data: { items: T[]; meta: unknown } }) =>
  resp?.data ?? { items: [] as T[], meta: undefined };

type CartLineItem = {
  product: ProductItem;
  quantity: number;
  unitPrice: number;
};

const TAX_RATE_OPTIONS = [
  { value: "0", label: "0 %" },
  { value: "5", label: "5 %" },
  { value: "7.5", label: "7.5 %" },
  { value: "10", label: "10 %" },
  { value: "20", label: "20 %" },
];

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CREDIT", label: "Credit" },
];

const payFormSchema = z.object({
  method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "CREDIT"] as const),
  tendered: z.union([z.number(), z.string().trim()]).optional(),
  reference: z.string().trim().max(255).optional().or(z.literal("")),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});
type PayFormValues = z.infer<typeof payFormSchema>;

const PRODUCT_STATUS_TONE: Record<string, "emerald" | "rose" | "slate"> = {
  ACTIVE: "emerald",
  INACTIVE: "slate",
  DISCONTINUED: "rose",
  OUT_OF_STOCK: "slate",
};

function parseNum(v: string | number | undefined | null): number {
  if (v === undefined || v === null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default function PosPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Map<string, CartLineItem>>(new Map());
  const [taxRateStr, setTaxRateStr] = useState("0");
  const [discount, setDiscount] = useState<number>(0);
  const [payOpen, setPayOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<"success" | "error">("success");

  const { data: productsRes, isFetching, refetch } = useListProductsQuery(
    { search, pageSize: 50, status: "ACTIVE" },
    { refetchOnMountOrArgChange: true }
  );
  const { data: whRes } = useListWarehousesQuery({ pageSize: 100, isActive: true });

  const products = extract(productsRes as any).items as ProductItem[];
  const warehouses = extract(whRes as any).items as WarehouseItem[];
  const defaultWarehouseId = warehouses[0]?.id;

  const [checkoutTrigger, checkoutState] = useCheckoutOrderMutation();

  const cartLines = useMemo(() => Array.from(cart.values()), [cart]);
  const itemCount = useMemo(
    () => cartLines.reduce((sum, l) => sum + l.quantity, 0),
    [cartLines]
  );
  const taxRate = parseNum(taxRateStr);

  const subtotal = useMemo(
    () =>
      cartLines.reduce(
        (sum, l) => sum + round2(l.unitPrice * l.quantity),
        0
      ),
    [cartLines]
  );
  const discountAmount = round2(discount);
  const afterDiscount = round2(Math.max(0, subtotal - discountAmount));
  const taxAmount = round2((afterDiscount * taxRate) / 100);
  const grandTotal = round2(afterDiscount + taxAmount);

  const addToCart = useCallback((product: ProductItem) => {
    setCart((prev) => {
      const next = new Map(prev);
      const price = parseNum(product.sellingPrice);
      const existing = next.get(product.id);
      if (existing) {
        next.set(product.id, {
          ...existing,
          quantity: existing.quantity + 1,
        });
      } else {
        next.set(product.id, {
          product,
          quantity: 1,
          unitPrice: price,
        });
      }
      return next;
    });
  }, []);

  const updateQty = useCallback((productId: string, delta: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(productId);
      if (!existing) return prev;
      const newQty = existing.quantity + delta;
      if (newQty <= 0) {
        next.delete(productId);
      } else {
        next.set(productId, { ...existing, quantity: newQty });
      }
      return next;
    });
  }, []);

  const removeLine = useCallback((productId: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(productId);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart(new Map());
    setDiscount(0);
    setTaxRateStr("0");
  }, []);

  const showToast = useCallback((msg: string, kind: "success" | "error" = "success") => {
    setToastMsg(msg);
    setToastKind(kind);
    const id = setTimeout(() => setToastMsg(null), 3500);
    return () => clearTimeout(id);
  }, []);

  const productColumns: ColumnDef<TableFeatures, ProductItem, any>[] = useMemo(() => {
    const col = createColumns<ProductItem>();
    return [
      col.display({
        id: "sku",
        header: "SKU",
        cell: ({ row: { original: p } }) => (
          <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
            {p.sku}
          </span>
        ),
      }),
      col.display({
        id: "name",
        header: "Product",
        cell: ({ row: { original: p } }) => (
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{p.name}</p>
            {p.description && (
              <p className="text-xs text-muted-foreground truncate max-w-[36ch]">
                {p.description}
              </p>
            )}
          </div>
        ),
      }),
      col.display({
        id: "status",
        header: "Status",
        cell: ({ row: { original: p } }) => (
          <StatusBadge
            tone={PRODUCT_STATUS_TONE[p.status] ?? "slate"}
            size="sm"
            label={p.status.charAt(0) + p.status.slice(1).toLowerCase()}
          />
        ),
      }),
      col.display({
        id: "price",
        header: "Price",
        cell: ({ row: { original: p } }) => (
          <MoneyDisplay
            value={p.sellingPrice}
            currency={p.currency ?? "USD"}
            className="font-semibold !w-auto"
            align="left"
          />
        ),
      }),
      col.display({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row: { original: p } }) => (
          <div className="flex justify-end">
            <Button
              variant="default"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                addToCart(p);
              }}
              className="h-7 px-2.5 text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-0.5" /> Add
            </Button>
          </div>
        ),
      }),
    ];
  }, [addToCart]);

  const payForm = useForm<PayFormValues>({
    resolver: zodResolver(payFormSchema),
    defaultValues: {
      method: "CASH",
      tendered: "",
      reference: "",
      note: "",
    },
    mode: "onTouched",
  });

  const watchMethod = payForm.watch("method");
  const watchTendered = parseNum(payForm.watch("tendered"));
  const changeDue = round2(watchTendered - grandTotal);
  const isInsufficient = watchMethod === "CASH" && changeDue < 0;

  useEffect(() => {
    if (!payOpen) {
      payForm.reset({
        method: "CASH",
        tendered: grandTotal > 0 ? grandTotal : "",
        reference: "",
        note: "",
      });
    }
  }, [payOpen, payForm, grandTotal]);

  const onSubmitPay = async (v: PayFormValues) => {
    if (itemCount === 0) return;
    if (v.method === "CASH" && isInsufficient) {
      showToast("Tendered amount is insufficient", "error");
      return;
    }
    const paymentAmount =
      v.method === "CASH" ? Math.max(grandTotal, watchTendered) : grandTotal;

    const body = {
      warehouseId: defaultWarehouseId,
      items: cartLines.map((l) => ({
        productId: l.product.id,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        warehouseId: defaultWarehouseId,
      })),
      discountAmount: discountAmount,
      taxAmount,
      subtotal,
      totalAmount: grandTotal,
      payments: [
        {
          paymentMethod: v.method,
          amount: paymentAmount,
          referenceNumber: (v.reference ?? undefined) as string | undefined,
          notes: (v.note ?? undefined) as string | undefined,
        },
      ],
    };

    const out = await checkoutTrigger(body as any);
    if ("data" in out && out.data?.success) {
      const orderId = out.data.data.order?.id;
      showToast("Order completed successfully", "success");
      setPayOpen(false);
      clearCart();
      if (orderId) {
        setTimeout(() => router.push(`/sales/orders/${orderId}`), 400);
      }
    } else {
      const err =
        (out as { error?: { data?: { error?: { message?: string } } } }).error
          ?.data?.error?.message ?? "Failed to process payment";
      showToast(err, "error");
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 relative">
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
            <Banknote className="w-5 h-5 shrink-0" />
          )}
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/sales/orders")}
            className="text-slate-600 hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Orders
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Quick Sale POS
          </h1>
        </div>
        {warehouses.length > 1 && (
          <div className="w-56">
            <GlobalSelect
              value={defaultWarehouseId ?? ""}
              onChange={() => {}}
              options={warehouses.map((w) => ({
                value: w.id,
                label: w.name,
              }))}
              placeholder="Warehouse"
              disabled
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            <SearchInput
              value={search}
              onChange={setSearch}
              debounceMs={300}
              placeholder="Search products by name, SKU, or barcode…"
              className="!max-w-md w-full"
            />
            <div className="text-xs text-muted-foreground tabular-nums shrink-0">
              {products.length} results
            </div>
          </div>

          <GlobalTable<ProductItem>
            columns={productColumns}
            data={products}
            meta={extract(productsRes as any).meta as any}
            serverSide
            pageSizeDefault={50}
            syncUrl={false}
            defaultSortBy="name"
            defaultSortOrder="asc"
            queryResult={{
              data: productsRes?.data as any,
              isFetching,
            }}
            getRowId={(p) => p.id}
            wrapperHeightClassName="relative max-h-[calc(100vh-220px)] overflow-hidden"
            onRowClick={(p) => addToCart(p)}
            emptyIcon={<Search className="w-10 h-10" />}
            emptyTitle="No products found"
            emptyDescription="Try a different search term."
            errorOnRetry={() => refetch()}
          />
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-88px)]">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border bg-slate-50/60 dark:bg-slate-900/40">
            <div className="flex items-center gap-2 min-w-0">
              <ShoppingCart className="w-5 h-5 text-primary shrink-0" />
              <h2 className="font-semibold text-foreground">Cart</h2>
              {itemCount > 0 && (
                <span className="rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-0.5 tabular-nums">
                  {itemCount}
                </span>
              )}
            </div>
            {itemCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCart}
                className="text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 h-7 px-2 text-xs"
              >
                Clear
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {cartLines.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                  <ShoppingCart className="w-7 h-7" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  Cart is empty
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click "Add" on products to build the order.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {cartLines.map((line) => {
                  const lineTotal = round2(line.unitPrice * line.quantity);
                  return (
                    <li
                      key={line.product.id}
                      className="px-4 py-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-foreground truncate">
                            {line.product.name}
                          </p>
                          <p className="text-[11px] font-mono text-slate-500">
                            {line.product.sku}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLine(line.product.id)}
                          aria-label="Remove item"
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => updateQty(line.product.id, -1)}
                            aria-label="Decrease quantity"
                            className="h-7 w-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
                            disabled={line.quantity <= 1}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-9 text-center text-sm font-medium tabular-nums text-foreground bg-slate-50 dark:bg-slate-900/60 h-7 flex items-center justify-center border-x border-slate-200 dark:border-slate-700">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQty(line.product.id, +1)}
                            aria-label="Increase quantity"
                            className="h-7 w-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <MoneyDisplay
                          value={lineTotal}
                          currency={line.product.currency ?? "USD"}
                          className="font-semibold !w-auto"
                          align="left"
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>
                          <MoneyDisplay
                            value={line.unitPrice}
                            currency={line.product.currency ?? "USD"}
                            align="left"
                            className="!text-[11px] !w-auto"
                          />
                          {"  ×  " + line.quantity}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-border bg-slate-50/60 dark:bg-slate-900/40 px-5 py-4 space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <MoneyDisplay
                  value={subtotal}
                  align="left"
                  className="font-medium !w-auto"
                />
              </div>
              <GlobalSelect
                label="Tax rate"
                value={taxRateStr}
                onChange={setTaxRateStr}
                options={TAX_RATE_OPTIONS}
                placeholder="Select tax"
                className="space-y-1"
              />
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Discount
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount === 0 ? "" : String(discount)}
                  onChange={(e) => setDiscount(parseNum(e.target.value))}
                  placeholder="0.00"
                  className="w-full h-10 rounded-lg border bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Discount</span>
                <MoneyDisplay
                  value={-discountAmount}
                  align="left"
                  className="!text-xs !w-auto"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Tax ({taxRateStr}%)</span>
                <MoneyDisplay
                  value={taxAmount}
                  align="left"
                  className="!text-xs !w-auto"
                />
              </div>
            </div>

            <div className="flex items-end justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-sm font-medium text-foreground">
                Grand Total
              </span>
              <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                <MoneyDisplay
                  value={grandTotal}
                  align="left"
                  className="!text-2xl !font-bold !w-auto"
                />
              </span>
            </div>

            <Button
              size="lg"
              className="w-full"
              disabled={itemCount === 0 || checkoutState.isLoading}
              onClick={() => setPayOpen(true)}
            >
              <CreditCard className="w-5 h-5" />
              {checkoutState.isLoading
                ? "Processing…"
                : `Pay ${new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(grandTotal)}`}
            </Button>
          </div>
        </aside>
      </div>

      <GlobalModal
        open={payOpen}
        onOpenChange={(o) => !checkoutState.isLoading && setPayOpen(o)}
        size="lg"
        title="Payment"
        description="Complete the quick sale by processing the payment below."
        dismissable={!checkoutState.isLoading}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPayOpen(false)}
              disabled={checkoutState.isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="posPayForm"
              disabled={checkoutState.isLoading || (watchMethod === "CASH" && isInsufficient)}
            >
              {checkoutState.isLoading ? "Processing…" : "Complete sale"}
            </Button>
          </div>
        }
      >
        <form
          id="posPayForm"
          onSubmit={payForm.handleSubmit(onSubmitPay)}
          className="space-y-4"
          noValidate
        >
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Grand Total</span>
              <span className="text-xl font-bold text-foreground tabular-nums">
                <MoneyDisplay
                  value={grandTotal}
                  align="left"
                  className="!text-xl !font-bold !w-auto"
                />
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlobalSelect
              label="Payment method"
              required
              value={payForm.watch("method")}
              onChange={(v) =>
                payForm.setValue("method", v as any, { shouldValidate: true })
              }
              options={PAYMENT_METHOD_OPTIONS}
              placeholder="Select method"
              error={payForm.formState.errors.method?.message}
            />
            {watchMethod === "CASH" && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  Amount tendered
                  <span className="ml-0.5 text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  {...payForm.register("tendered")}
                  placeholder="0.00"
                  className={cn(
                    "w-full h-10 rounded-lg border bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 tabular-nums",
                    isInsufficient &&
                      "border-rose-400 focus-visible:ring-rose-400"
                  )}
                />
                {payForm.formState.errors.tendered?.message && (
                  <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                    {String(payForm.formState.errors.tendered.message)}
                  </p>
                )}
              </div>
            )}
          </div>

          {watchMethod === "CASH" && (
            <div
              className={cn(
                "rounded-xl border px-4 py-3 flex items-center justify-between",
                isInsufficient
                  ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900"
                  : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900"
              )}
            >
              <span
                className={cn(
                  "text-sm font-medium",
                  isInsufficient
                    ? "text-rose-700 dark:text-rose-300"
                    : "text-emerald-700 dark:text-emerald-300"
                )}
              >
                {isInsufficient ? "Amount due (short)" : "Change due"}
              </span>
              <span
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  isInsufficient
                    ? "text-rose-700 dark:text-rose-300"
                    : "text-emerald-700 dark:text-emerald-300"
                )}
              >
                <MoneyDisplay
                  value={Math.abs(changeDue)}
                  align="left"
                  className={cn(
                    "!text-lg !font-semibold !w-auto",
                    isInsufficient && "!text-rose-700 dark:!text-rose-300"
                  )}
                />
              </span>
            </div>
          )}

          <GlobalInput
            label="Reference"
            placeholder="Cheque, transfer, or authorization ID"
            error={payForm.formState.errors.reference?.message}
            {...payForm.register("reference")}
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Note
            </label>
            <textarea
              rows={3}
              placeholder="Optional note printed on the receipt"
              maxLength={2000}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              {...payForm.register("note")}
            />
            {payForm.formState.errors.note?.message && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {String(payForm.formState.errors.note.message)}
              </p>
            )}
          </div>

          {checkoutState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (checkoutState.error as {
                  data?: { error?: { message?: string } };
                })?.data?.error?.message ?? "Failed to process checkout."
              )}
            </div>
          )}
        </form>
      </GlobalModal>
    </div>
  );
}
