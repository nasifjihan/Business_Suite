"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as Switch from "@radix-ui/react-switch";
import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  Warehouse,
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
import { PermissionGate, useHasPermission } from "@/components/auth/PermissionGate";
import { createColumns, type TableFeatures } from "@/lib/table-utils";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import {
  useListStockQuery,
  useCreateMovementMutation,
  useListWarehousesQuery,
} from "@/lib/api/inventoryEndpoints";
import type {
  StockItem,
  MovementType,
  ListStockArgs,
  WarehouseItem,
} from "@/lib/api/inventoryEndpoints";

const extract = <T,>(resp?: { success: true; data: { items: T[]; meta: unknown } }) =>
  resp?.data ?? { items: [] as T[], meta: undefined };

type UiMovementType = "IN" | "OUT";

const quickMovementSchema = z.object({
  quantity: z.coerce.number().int().min(1, "Must be at least 1"),
  reference: z.string().trim().max(255).optional().or(z.literal("")),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});
type QuickMovementFormValues = z.infer<typeof quickMovementSchema>;

const uiToApiMovementType: Record<UiMovementType, MovementType> = {
  IN: "RECEIPT",
  OUT: "ISSUE",
};

export default function StockListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canCreateMovement = useHasPermission({ one: "inventory.movements.create" });

  const filters: ListStockArgs & { search?: string } = useMemo(() => {
    const page = parseInt(searchParams?.get("page") ?? "1", 10) || 1;
    const pageSize = parseInt(searchParams?.get("pageSize") ?? "25", 10) || 25;
    const lowOnlyParam = searchParams?.get("lowOnly");
    return {
      page,
      pageSize,
      search: searchParams?.get("search") ?? "",
      warehouseId: searchParams?.get("warehouseId") || undefined,
      lowOnly: lowOnlyParam === "true" ? true : lowOnlyParam === "false" ? false : undefined,
      sortBy: searchParams?.get("sortBy") ?? "updatedAt",
      sortOrder: (searchParams?.get("sortOrder") as "asc" | "desc") ?? "desc",
    };
  }, [searchParams]);

  const { data: stockRes, isFetching, refetch } = useListStockQuery(
    {
      page: filters.page,
      pageSize: filters.pageSize,
      warehouseId: filters.warehouseId,
      lowOnly: filters.lowOnly,
    },
    { refetchOnMountOrArgChange: true }
  );

  const { data: warehousesRes } = useListWarehousesQuery({ pageSize: 100 });

  const stockItems = (extract(stockRes as any).items ?? []) as StockItem[];
  const meta = extract(stockRes as any).meta;
  const warehouses = (extract(warehousesRes as any).items ?? []) as WarehouseItem[];

  const warehouseOptions = useMemo(
    () => [
      { value: "", label: "All warehouses" },
      ...warehouses.map((w) => ({ value: w.id, label: w.name })),
    ],
    [warehouses]
  );

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

  type QuickModalState =
    | { kind: "none" }
    | { kind: "in"; stock: StockItem }
    | { kind: "out"; stock: StockItem };

  const [quickModal, setQuickModal] = useState<QuickModalState>({ kind: "none" });
  const [createMovementTrigger, createMovementState] = useCreateMovementMutation();

  const quickForm = useForm<QuickMovementFormValues>({
    resolver: zodResolver(quickMovementSchema),
    defaultValues: {
      quantity: 1,
      reference: "",
      note: "",
    },
    mode: "onTouched",
  });

  useEffect(() => {
    if (quickModal.kind !== "none") {
      quickForm.reset({
        quantity: 1,
        reference: "",
        note: "",
      });
    }
  }, [quickModal, quickForm]);

  const closeQuickModal = () => {
    setQuickModal({ kind: "none" });
    quickForm.reset();
  };

  const onSubmitQuick = async (v: QuickMovementFormValues) => {
    if (quickModal.kind === "none") return;
    const stock = quickModal.stock;
    const uiType: UiMovementType = quickModal.kind === "in" ? "IN" : "OUT";
    const out = await createMovementTrigger({
      movementType: uiToApiMovementType[uiType],
      productId: stock.productId,
      warehouseId: stock.warehouseId,
      quantity: v.quantity,
      reference: v.reference || undefined,
      note: v.note || undefined,
    });
    if ("data" in out && out.data?.success) {
      closeQuickModal();
    }
  };

  const lowOnlyChecked = filters.lowOnly === true;

  const columns: ColumnDef<TableFeatures, StockItem, any>[] = useMemo(() => {
    const col = createColumns<StockItem>();

    return [
      col.display({
        id: "product",
        header: "Product",
        cell: ({ row: { original: s } }) => (
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">
              {s.product?.name ?? "—"}
            </p>
            {s.product?.sku && (
              <span className="inline-flex mt-1 items-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:text-slate-400">
                {s.product.sku}
              </span>
            )}
          </div>
        ),
      }),
      col.display({
        id: "warehouse",
        header: "Warehouse",
        cell: ({ row: { original: s } }) => (
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">
              {s.warehouse?.name ?? "—"}
            </p>
            {s.warehouse?.address && (
              <p className="text-xs text-muted-foreground truncate">
                {s.warehouse.address}
                {s.warehouse.city ? `, ${s.warehouse.city}` : ""}
              </p>
            )}
          </div>
        ),
      }),
      col.display({
        id: "quantity",
        header: "Quantity",
        cell: ({ row: { original: s } }) => (
          <span className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-1 text-base font-semibold text-foreground tabular-nums">
            {s.quantity}
          </span>
        ),
      }),
      col.display({
        id: "minimumLevel",
        header: "Minimum Level",
        cell: ({ row: { original: s } }) => (
          <span className="text-sm text-foreground tabular-nums">
            {s.product?.minStockLevel ?? 0}
          </span>
        ),
      }),
      col.display({
        id: "status",
        header: "Status",
        cell: ({ row: { original: s } }) => {
          const min = s.product?.minStockLevel ?? 0;
          const isLow = s.quantity < min;
          return (
            <StatusBadge
              tone={isLow ? "rose" : "emerald"}
              size="md"
              dot={!isLow}
              label={isLow ? "LOW" : "OK"}
            />
          );
        },
      }),
      col.accessor("updatedAt" as any, {
        id: "updatedAt",
        header: "Updated",
        enableSorting: true,
        cell: ({ row: { original: s } }) => (
          <DateDisplay date={s.updatedAt} format="short" />
        ),
      }),
      col.display({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row: { original: s } }) => (
          <div className="flex items-center justify-end gap-1.5">
            <PermissionGate one="inventory.movements.create">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickModal({ kind: "in", stock: s })}
                disabled={!canCreateMovement}
                className="h-8 px-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                <span className="hidden sm:inline ml-1">Stock In</span>
              </Button>
            </PermissionGate>
            <PermissionGate one="inventory.movements.create">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickModal({ kind: "out", stock: s })}
                disabled={!canCreateMovement}
                className="h-8 px-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900"
              >
                <ArrowUpFromLine className="w-3.5 h-3.5" />
                <span className="hidden sm:inline ml-1">Stock Out</span>
              </Button>
            </PermissionGate>
          </div>
        ),
      }),
    ];
  }, [canCreateMovement]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Inventory" }, { label: "Stock" }]}
        title="Stock Levels"
        description="Track product quantities across warehouses and perform quick stock adjustments."
      />

      <TableToolbar
        searchTerm={filters.search ?? ""}
        onSearchChange={(v) => pushParams({ search: v })}
        searchPlaceholder="Search by product name, SKU, or warehouse…"
        startContent={
          <>
            <GlobalSelect
              value={filters.warehouseId ?? ""}
              onChange={(v) => pushParams({ warehouseId: v })}
              options={warehouseOptions}
              placeholder="Warehouse"
              className="w-48"
            />
            <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 h-10">
              <span className="text-sm text-foreground font-medium whitespace-nowrap">
                Low stock only
              </span>
              <Switch.Root
                checked={lowOnlyChecked}
                onCheckedChange={(v) =>
                  pushParams({ lowOnly: v ? "true" : "false" })
                }
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/70 focus:ring-offset-2",
                  lowOnlyChecked
                    ? "bg-primary"
                    : "bg-slate-200 dark:bg-slate-700"
                )}
              >
                <Switch.Thumb
                  className={cn(
                    "inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform",
                    lowOnlyChecked
                      ? "translate-x-5"
                      : "translate-x-0.5"
                  )}
                />
              </Switch.Root>
            </div>
          </>
        }
      />

      <GlobalTable<StockItem>
        columns={columns}
        data={stockItems}
        meta={meta as any}
        serverSide
        pageSizeDefault={25}
        defaultSortBy="updatedAt"
        defaultSortOrder="desc"
        queryResult={{
          data: stockRes?.data as any,
          isFetching,
        }}
        getRowId={(s) => s.id}
        emptyIcon={<Package className="w-10 h-10" />}
        emptyTitle="No stock found"
        emptyDescription="No stock entries match the current filters."
        errorOnRetry={() => refetch()}
      />

      <GlobalModal
        open={quickModal.kind === "in"}
        onOpenChange={(o) => !o && closeQuickModal()}
        title={
          quickModal.kind === "in"
            ? `Stock In — ${quickModal.stock.product?.name ?? ""}`
            : ""
        }
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeQuickModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="quickInForm"
              disabled={createMovementState.isLoading || !canCreateMovement}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {createMovementState.isLoading ? "Processing…" : "Confirm Stock In"}
            </Button>
          </div>
        }
      >
        <form
          id="quickInForm"
          onSubmit={quickForm.handleSubmit(onSubmitQuick)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Product
              </label>
              <p className="text-sm text-foreground truncate">
                {quickModal.kind === "in" ? quickModal.stock.product?.name : ""}
              </p>
              {quickModal.kind === "in" && quickModal.stock.product?.sku && (
                <p className="font-mono text-xs text-muted-foreground mt-0.5">
                  {quickModal.stock.product.sku}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Warehouse
              </label>
              <p className="text-sm text-foreground truncate">
                {quickModal.kind === "in" ? quickModal.stock.warehouse?.name : ""}
              </p>
            </div>
          </div>
          <GlobalInput
            label="Quantity"
            required
            inputType="number"
            placeholder="Enter quantity"
            hint="Positive integer"
            error={quickForm.formState.errors.quantity?.message}
            {...quickForm.register("quantity")}
          />
          <GlobalInput
            label="Reference"
            placeholder="PO#, invoice, ticket #… (optional)"
            error={quickForm.formState.errors.reference?.message}
            {...quickForm.register("reference")}
          />
          <div>
            <label className="block text-sm font-medium text-foreground">Note</label>
            <textarea
              className="mt-1.5 w-full min-h-[80px] rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Optional note about this stock movement…"
              maxLength={2000}
              {...quickForm.register("note")}
            />
            {quickForm.formState.errors.note?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {quickForm.formState.errors.note.message}
              </p>
            )}
          </div>
          {createMovementState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (createMovementState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to record movement."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <GlobalModal
        open={quickModal.kind === "out"}
        onOpenChange={(o) => !o && closeQuickModal()}
        title={
          quickModal.kind === "out"
            ? `Stock Out — ${quickModal.stock.product?.name ?? ""}`
            : ""
        }
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeQuickModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="quickOutForm"
              disabled={createMovementState.isLoading || !canCreateMovement}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {createMovementState.isLoading ? "Processing…" : "Confirm Stock Out"}
            </Button>
          </div>
        }
      >
        <form
          id="quickOutForm"
          onSubmit={quickForm.handleSubmit(onSubmitQuick)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Product
              </label>
              <p className="text-sm text-foreground truncate">
                {quickModal.kind === "out" ? quickModal.stock.product?.name : ""}
              </p>
              {quickModal.kind === "out" && quickModal.stock.product?.sku && (
                <p className="font-mono text-xs text-muted-foreground mt-0.5">
                  {quickModal.stock.product.sku}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Warehouse
              </label>
              <p className="text-sm text-foreground truncate">
                {quickModal.kind === "out" ? quickModal.stock.warehouse?.name : ""}
              </p>
            </div>
          </div>
          <GlobalInput
            label="Quantity"
            required
            inputType="number"
            placeholder="Enter quantity"
            hint="Positive integer"
            error={quickForm.formState.errors.quantity?.message}
            {...quickForm.register("quantity")}
          />
          <GlobalInput
            label="Reference"
            placeholder="Order #, ticket #… (optional)"
            error={quickForm.formState.errors.reference?.message}
            {...quickForm.register("reference")}
          />
          <div>
            <label className="block text-sm font-medium text-foreground">Note</label>
            <textarea
              className="mt-1.5 w-full min-h-[80px] rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Optional note about this stock movement…"
              maxLength={2000}
              {...quickForm.register("note")}
            />
            {quickForm.formState.errors.note?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {quickForm.formState.errors.note.message}
              </p>
            )}
          </div>
          {createMovementState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (createMovementState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to record movement."
              )}
            </div>
          )}
        </form>
      </GlobalModal>
    </div>
  );
}
