"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Package,
  Warehouse,
  AlertTriangle,
  ArrowRightLeft,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { GlobalTable } from "@/components/tables/GlobalTable";
import { DateDisplay } from "@/components/common/DateDisplay";
import { createColumns, type TableFeatures } from "@/lib/table-utils";
import {
  useListProductsQuery,
  useListStockQuery,
  useListLowStockProductsQuery,
  useListMovementsQuery,
} from "@/lib/api/inventoryEndpoints";
import type {
  ProductItem,
  MovementItem,
  MovementType,
} from "@/lib/api/inventoryEndpoints";
import type { ColumnDef } from "@tanstack/react-table";

const extract = <T,>(resp?: { success: true; data: { items: T[]; meta: unknown } }) =>
  resp?.data ?? { items: [] as T[], meta: undefined };

const MOVEMENT_TYPE_TONE: Record<MovementType, "emerald" | "rose" | "slate" | "sky" | "violet" | "teal"> = {
  RECEIPT: "emerald",
  PURCHASE: "emerald",
  RETURN: "emerald",
  ISSUE: "rose",
  SALE: "rose",
  TRANSFER_IN: "sky",
  TRANSFER_OUT: "sky",
  ADJUSTMENT: "violet",
};

const PRODUCT_STATUS_TONE = {
  ACTIVE: "emerald",
  INACTIVE: "slate",
  DISCONTINUED: "rose",
  OUT_OF_STOCK: "rose",
} as const;

export default function InventoryOverviewPage() {
  const { data: productsRes } = useListProductsQuery({ page: 1, pageSize: 1 });
  const { data: stockRes } = useListStockQuery({ page: 1, pageSize: 1000 });
  const { data: lowStockRes } = useListLowStockProductsQuery({ page: 1, pageSize: 1 });
  const { data: movementsMetaRes } = useListMovementsQuery({ page: 1, pageSize: 1 });

  const { data: recentMovementsRes, isFetching: movementsFetching } = useListMovementsQuery({
    page: 1,
    pageSize: 10,
  });

  const { data: lowStockTableRes, isFetching: lowStockFetching } = useListLowStockProductsQuery({
    page: 1,
    pageSize: 10,
  });

  const productsMeta = extract(productsRes as any).meta as { totalItems?: number } | undefined;
  const lowStockMeta = extract(lowStockRes as any).meta as { totalItems?: number } | undefined;
  const movementsMeta = extract(movementsMetaRes as any).meta as { totalItems?: number } | undefined;

  const stockItems = extract(stockRes as any).items as Array<{ quantity: number | string }>;
  const totalStock = useMemo(() => {
    return stockItems.reduce((sum: number, item) => {
      const qty = typeof item.quantity === "number" ? item.quantity : parseFloat(String(item.quantity ?? "0"));
      return sum + (isFinite(qty) ? qty : 0);
    }, 0);
  }, [stockItems]);

  const recentMovements = extract(recentMovementsRes as any).items as MovementItem[];
  const lowStockProducts = extract(lowStockTableRes as any).items as Array<
    ProductItem & { currentStock: number; reorderPoint: number }
  >;

  const movementColumns: ColumnDef<TableFeatures, MovementItem, any>[] = useMemo(() => {
    const col = createColumns<MovementItem>();
    return [
      col.display({
        id: "movementType",
        header: "Type",
        cell: ({ row: { original: m } }) => (
          <StatusBadge
            tone={MOVEMENT_TYPE_TONE[m.movementType]}
            size="md"
            label={m.movementType.charAt(0) + m.movementType.slice(1).toLowerCase().replace("_", " ")}
          />
        ),
      }),
      col.display({
        id: "productId",
        header: "Product",
        cell: ({ row: { original: m } }) => (
          <span className="font-medium text-sm text-foreground truncate max-w-[16ch] block">
            {m.product?.name ?? m.productId}
          </span>
        ),
      }),
      col.display({
        id: "warehouseId",
        header: "Warehouse",
        cell: ({ row: { original: m } }) => (
          <span className="text-sm text-muted-foreground truncate max-w-[14ch] block">
            {m.warehouse?.name ?? m.warehouseId}
          </span>
        ),
      }),
      col.display({
        id: "quantity",
        header: "Qty",
        cell: ({ row: { original: m } }) => (
          <span className="font-mono text-sm font-medium text-foreground tabular-nums">
            {m.quantity}
          </span>
        ),
      }),
      col.accessor("createdAt" as any, {
        id: "date",
        header: "Date",
        enableSorting: true,
        cell: ({ row: { original: m } }) => (
          <DateDisplay date={m.createdAt} format="short" />
        ),
      }),
    ];
  }, []);

  const lowStockColumns: ColumnDef<TableFeatures, ProductItem & { currentStock: number; reorderPoint: number }, any>[] = useMemo(() => {
    const col = createColumns<ProductItem & { currentStock: number; reorderPoint: number }>();
    return [
      col.display({
        id: "sku",
        header: "SKU",
        cell: ({ row: { original: p } }) => (
          <span className="font-mono text-xs text-slate-600 dark:text-slate-400 truncate max-w-[10ch]">
            {p.sku}
          </span>
        ),
      }),
      col.display({
        id: "name",
        header: "Product",
        cell: ({ row: { original: p } }) => (
          <p className="font-medium text-sm text-foreground truncate max-w-[20ch]">{p.name}</p>
        ),
      }),
      col.display({
        id: "category",
        header: "Category",
        cell: ({ row: { original: p } }) => (
          <span className="text-xs text-muted-foreground truncate max-w-[12ch] block">
            {p.category?.name ?? "—"}
          </span>
        ),
      }),
      col.display({
        id: "currentStock",
        header: "Current Stock",
        cell: ({ row: { original: p } }) => (
          <span className="font-mono text-sm font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
            {p.currentStock}
          </span>
        ),
      }),
      col.display({
        id: "reorderPoint",
        header: "Reorder Point",
        cell: ({ row: { original: p } }) => (
          <span className="font-mono text-sm text-muted-foreground tabular-nums">
            {p.reorderPoint}
          </span>
        ),
      }),
      col.display({
        id: "status",
        header: "Status",
        cell: ({ row: { original: p } }) => (
          <StatusBadge
            tone={PRODUCT_STATUS_TONE[p.status]}
            size="sm"
            label={p.status.charAt(0) + p.status.slice(1).toLowerCase().replace("_", " ")}
          />
        ),
      }),
      col.accessor("createdAt" as any, {
        id: "createdAt",
        header: "Created",
        enableSorting: true,
        cell: ({ row: { original: p } }) => (
          <DateDisplay date={p.createdAt} format="short" />
        ),
      }),
    ];
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Inventory" }]}
        title="Inventory Overview"
        description="Inventory dashboard"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total SKUs</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {productsMeta?.totalItems ?? "—"}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-900/60">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <Link
            href="#"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700"
          >
            View products <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Stock</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
                {totalStock ? totalStock.toLocaleString() : "—"}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-200 dark:border-sky-900/60">
              <Warehouse className="w-5 h-5" />
            </div>
          </div>
          <Link
            href="#"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700"
          >
            View stock <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Low Stock Items</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {lowStockMeta?.totalItems ?? "—"}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-900/60">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <Link
            href="#"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700"
          >
            View low stock <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Movements</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {movementsMeta?.totalItems ?? "—"}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-200 dark:border-violet-900/60">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
          </div>
          <Link
            href="#"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700"
          >
            View movements <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-semibold text-foreground">Last 10 Movements</h2>
            <span className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1">
              Recent
            </span>
          </div>
          <GlobalTable<MovementItem>
            columns={movementColumns}
            data={recentMovements}
            hidePagination
            syncUrl={false}
            defaultSortBy="createdAt"
            defaultSortOrder="desc"
            emptyIcon={<ArrowRightLeft className="w-10 h-10" />}
            emptyTitle="No movements yet"
            emptyDescription="Stock movements will appear here as they are recorded."
            queryResult={{
              data: recentMovementsRes?.data as any,
              isFetching: movementsFetching,
            }}
            getRowId={(m) => m.id}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-semibold text-foreground">Low Stock Products</h2>
            <span className="text-xs font-medium text-rose-600 dark:text-rose-400 inline-flex items-center gap-1">
              Needs attention
            </span>
          </div>
          <GlobalTable<ProductItem & { currentStock: number; reorderPoint: number }>
            columns={lowStockColumns}
            data={lowStockProducts}
            hidePagination
            syncUrl={false}
            defaultSortBy="createdAt"
            defaultSortOrder="desc"
            emptyIcon={<AlertTriangle className="w-10 h-10" />}
            emptyTitle="No low stock products"
            emptyDescription="All products are above their reorder point."
            queryResult={{
              data: lowStockTableRes?.data as any,
              isFetching: lowStockFetching,
            }}
            getRowId={(p) => p.id}
          />
        </div>
      </div>
    </div>
  );
}
