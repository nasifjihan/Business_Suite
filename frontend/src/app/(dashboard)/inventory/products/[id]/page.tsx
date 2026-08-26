"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as Tabs from "@radix-ui/react-tabs";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Package,
  Hash,
  Tag,
  Box,
  Warehouse,
  History,
  Plus,
  Minus,
  Info,
  User,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { GlobalTable } from "@/components/tables/GlobalTable";
import { GlobalModal } from "@/components/feedback/GlobalModal";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { GlobalInput } from "@/components/form/GlobalInput";
import { GlobalSelect } from "@/components/form/GlobalSelect";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { MoneyDisplay } from "@/components/common/MoneyDisplay";
import { PermissionGate, useHasPermission } from "@/components/auth/PermissionGate";
import { createColumns, type TableFeatures } from "@/lib/table-utils";
import type { ColumnDef } from "@tanstack/react-table";
import {
  useGetProductQuery,
  useGetProductStockSummaryQuery,
  useListMovementsQuery,
  useListCategoriesQuery,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useCreateMovementMutation,
} from "@/lib/api/inventoryEndpoints";
import type {
  ProductDetail,
  ProductStatus,
  CategoryItem,
  ProductStockSummary,
  MovementItem,
  MovementType,
  UpdateProductRequest,
} from "@/lib/api/inventoryEndpoints";

const extract = <T,>(resp?: { success: true; data: { items: T[]; meta: unknown } }) =>
  resp?.data ?? { items: [] as T[], meta: undefined };

const PRODUCT_STATUS_TONE: Record<ProductStatus, "emerald" | "rose" | "slate"> = {
  ACTIVE: "emerald",
  INACTIVE: "slate",
  DISCONTINUED: "rose",
  OUT_OF_STOCK: "slate",
};

const MOVEMENT_TYPE_TONE: Record<MovementType, "emerald" | "rose" | "sky" | "violet" | "teal" | "slate"> = {
  RECEIPT: "emerald",
  PURCHASE: "emerald",
  RETURN: "emerald",
  ISSUE: "rose",
  SALE: "rose",
  TRANSFER_IN: "sky",
  TRANSFER_OUT: "sky",
  ADJUSTMENT: "violet",
};

const MOVEMENT_TYPE_LABEL: Record<MovementType, string> = {
  RECEIPT: "Stock In",
  PURCHASE: "Purchase",
  RETURN: "Return In",
  ISSUE: "Stock Out",
  SALE: "Sale Out",
  TRANSFER_IN: "Transfer In",
  TRANSFER_OUT: "Transfer Out",
  ADJUSTMENT: "Adjustment",
};

const UNIT_OF_MEASURE_OPTIONS = [
  { value: "EACH", label: "Each" },
  { value: "BOX", label: "Box" },
  { value: "KG", label: "Kilogram" },
  { value: "M", label: "Meter" },
  { value: "L", label: "Liter" },
];

const productStatusFormOptions = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "DISCONTINUED", label: "Discontinued" },
];

const productFormSchema = z.object({
  name: z.string().trim().min(1, "Required").max(255),
  sku: z.string().trim().max(100).optional().or(z.literal("")),
  barcode: z.string().trim().max(255).optional().or(z.literal("")),
  categoryId: z.string().trim().max(100).optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE", "DISCONTINUED", "OUT_OF_STOCK"] as const).optional(),
  unit: z.string().trim().max(20).optional().or(z.literal("")),
  costPrice: z.union([z.number(), z.string().trim()]).optional(),
  sellingPrice: z.union([z.number(), z.string().trim()]).optional(),
  weight: z.union([z.number(), z.string().trim()]).optional(),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});
type ProductFormValues = z.infer<typeof productFormSchema>;

type WarehouseStockRow = {
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  reserved: number;
  available: number;
  minimumLevel: number;
};

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const canUpdate = useHasPermission({ one: "inventory.products.update" });

  const { data: productRes, isFetching, refetch } = useGetProductQuery(id, { skip: !id });
  const productDetail: ProductDetail | undefined = productRes?.data as ProductDetail | undefined;

  const { data: stockRes, refetch: refetchStock } = useGetProductStockSummaryQuery(id, { skip: !id });
  const stockSummary: ProductStockSummary | undefined = stockRes?.data as ProductStockSummary | undefined;

  const { data: movementsRes } = useListMovementsQuery(
    { productId: id, pageSize: 25 },
    { skip: !id }
  );

  const { data: categoriesRes } = useListCategoriesQuery({ pageSize: 100 });
  const categories: CategoryItem[] = extract(categoriesRes as any).items as CategoryItem[];
  const categoryFormOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories]
  );

  const movements: MovementItem[] = extract(movementsRes as any).items as MovementItem[];
  const movementsMeta = extract(movementsRes as any).meta;

  const [editProductOpen, setEditProductOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [updateProductTrigger, updateProductState] = useUpdateProductMutation();
  const [deleteProductTrigger, deleteProductState] = useDeleteProductMutation();
  const [createMovementTrigger, createMovementState] = useCreateMovementMutation();

  const productForm = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      sku: "",
      barcode: "",
      categoryId: "",
      status: "ACTIVE",
      unit: "EACH",
      costPrice: 0,
      sellingPrice: 0,
      weight: "",
      description: "",
    },
    mode: "onTouched",
  });

  useEffect(() => {
    if (editProductOpen && productDetail) {
      productForm.reset({
        name: productDetail.name,
        sku: productDetail.sku,
        barcode: productDetail.barcode ?? "",
        categoryId: productDetail.categoryId ?? "",
        status: productDetail.status,
        unit: productDetail.unit ?? "EACH",
        costPrice: productDetail.costPrice ?? 0,
        sellingPrice: productDetail.sellingPrice ?? 0,
        weight: productDetail.weight ?? "",
        description: productDetail.description ?? "",
      });
    }
  }, [editProductOpen, productDetail, productForm]);

  const parseNum = (v: string | number | undefined): number | undefined => {
    if (v === undefined || v === "") return undefined;
    const n = typeof v === "number" ? v : parseFloat(v);
    return isNaN(n) ? undefined : n;
  };

  const onSubmitEditProduct = async (v: ProductFormValues) => {
    if (!id) return;
    const body: UpdateProductRequest = {
      name: v.name,
      sku: v.sku || undefined,
      barcode: v.barcode || undefined,
      categoryId: v.categoryId || undefined,
      status: v.status,
      unit: v.unit || undefined,
      costPrice: parseNum(v.costPrice),
      sellingPrice: parseNum(v.sellingPrice),
      weight: parseNum(v.weight),
      description: v.description || undefined,
    };
    const out = await updateProductTrigger({ id, body });
    if ("data" in out && out.data?.success) {
      setEditProductOpen(false);
      refetch();
    }
  };

  const handleDeleteProduct = async () => {
    if (!id) return;
    await deleteProductTrigger(id);
    router.push("/inventory/products");
  };

  const warehouseRows: WarehouseStockRow[] = useMemo(() => {
    if (!stockSummary?.warehouses) return [];
    return stockSummary.warehouses.map((w) => ({
      warehouseId: w.warehouseId,
      warehouseName: w.warehouseName,
      quantity: w.quantity,
      reserved: w.reserved,
      available: w.available,
      minimumLevel: productDetail?.minStockLevel ?? 0,
    }));
  }, [stockSummary?.warehouses, productDetail?.minStockLevel]);

  const handleQuickMovement = useCallback(
    async (warehouseId: string, movementType: "RECEIPT" | "ISSUE", quantity: number) => {
      if (!id) return;
      await createMovementTrigger({
        productId: id,
        warehouseId,
        movementType,
        quantity,
      });
      refetchStock();
      refetch();
    },
    [id, createMovementTrigger, refetchStock, refetch]
  );

  const stockColumns: ColumnDef<TableFeatures, WarehouseStockRow, any>[] = useMemo(() => {
    const col = createColumns<WarehouseStockRow>();
    return [
      col.display({
        id: "warehouse",
        header: "Warehouse",
        cell: ({ row: { original: w } }) => (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-200 dark:border-sky-900/60">
              <Warehouse className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium text-foreground truncate max-w-[20ch]">
              {w.warehouseName}
            </span>
          </div>
        ),
      }),
      col.display({
        id: "quantity",
        header: "Current Qty",
        cell: ({ row: { original: w } }) => (
          <span className="inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-0.5 text-xs font-semibold text-foreground tabular-nums min-w-[4ch]">
            {w.quantity.toLocaleString()}
          </span>
        ),
      }),
      col.display({
        id: "available",
        header: "Available",
        cell: ({ row: { original: w } }) => (
          <span className="inline-flex items-center justify-center rounded-md border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums min-w-[4ch]">
            {w.available.toLocaleString()}
          </span>
        ),
      }),
      col.display({
        id: "minimumLevel",
        header: "Min Level",
        cell: ({ row: { original: w } }) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {w.minimumLevel > 0 ? w.minimumLevel.toLocaleString() : "—"}
          </span>
        ),
      }),
      col.display({
        id: "status",
        header: "Stock Level",
        cell: ({ row: { original: w } }) => {
          const isLow = w.minimumLevel > 0 && w.quantity < w.minimumLevel;
          return (
            <StatusBadge
              tone={isLow ? "rose" : "emerald"}
              size="md"
              dot={!isLow}
              label={isLow ? "Low Stock" : "In Stock"}
            />
          );
        },
      }),
      col.display({
        id: "actions",
        header: "Quick Actions",
        enableSorting: false,
        cell: ({ row: { original: w } }) => (
          <div className="flex items-center justify-end gap-1.5">
            <PermissionGate one="inventory.stock.update">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickMovement(w.warehouseId, "RECEIPT", 10)}
                disabled={createMovementState.isLoading}
                className="h-8 px-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900"
              >
                <Plus className="w-3.5 h-3.5 mr-0.5" /> 10
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickMovement(w.warehouseId, "ISSUE", 10)}
                disabled={createMovementState.isLoading}
                className="h-8 px-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900"
              >
                <Minus className="w-3.5 h-3.5 mr-0.5" /> 10
              </Button>
            </PermissionGate>
          </div>
        ),
      }),
    ];
  }, [handleQuickMovement, createMovementState.isLoading]);

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
            label={MOVEMENT_TYPE_LABEL[m.movementType]}
          />
        ),
      }),
      col.display({
        id: "warehouse",
        header: "Warehouse",
        cell: ({ row: { original: m } }) => (
          <span className="text-sm text-foreground truncate max-w-[18ch]">
            {m.warehouse?.name ??
              m.toWarehouse?.name ??
              m.fromWarehouse?.name ??
              "—"}
          </span>
        ),
      }),
      col.display({
        id: "quantity",
        header: "Qty",
        cell: ({ row: { original: m } }) => {
          const isIn =
            m.movementType === "RECEIPT" ||
            m.movementType === "PURCHASE" ||
            m.movementType === "RETURN" ||
            m.movementType === "TRANSFER_IN";
          return (
            <span
              className={`text-sm font-semibold tabular-nums ${
                isIn
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {isIn ? "+" : "−"}
              {m.quantity.toLocaleString()}
            </span>
          );
        },
      }),
      col.display({
        id: "reference",
        header: "Reference",
        cell: ({ row: { original: m } }) =>
          m.reference ? (
            <span className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-2 py-0.5 font-mono text-[11px] text-slate-700 dark:text-slate-300 max-w-[14ch] truncate">
              {m.reference}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      }),
      col.display({
        id: "user",
        header: "By",
        cell: () => <span className="text-xs text-muted-foreground">—</span>,
      }),
      col.accessor("createdAt" as any, {
        id: "createdAt",
        header: "Date",
        enableSorting: true,
        cell: ({ row: { original: m } }) => (
          <DateDisplay date={m.createdAt} format="short" />
        ),
      }),
    ];
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Inventory" },
          { label: "Products", href: "/inventory/products" },
          { label: productDetail?.name ?? "..." },
        ]}
        title={productDetail?.name ?? "Loading…"}
        description={
          productDetail
            ? `${productDetail.sku} · Manage product details, stock levels, and movement history`
            : "Loading product details…"
        }
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/inventory/products">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>
            </Button>
            <PermissionGate one="inventory.products.update">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditProductOpen(true)}
                disabled={!canUpdate || !productDetail}
              >
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
            </PermissionGate>
            <PermissionGate one="inventory.products.delete">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirmOpen(true)}
                className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <Tabs.Root defaultValue="info" className="space-y-4">
        <Tabs.List className="flex items-center gap-1 p-1 rounded-xl border border-border bg-slate-50 dark:bg-slate-900/50 w-fit">
          <Tabs.Trigger
            value="info"
            className="px-4 py-2 text-sm font-medium rounded-lg transition-all text-slate-600 dark:text-slate-400 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <span className="inline-flex items-center gap-2">
              <Info className="w-4 h-4" /> Info
            </span>
          </Tabs.Trigger>
          <Tabs.Trigger
            value="stock"
            className="px-4 py-2 text-sm font-medium rounded-lg transition-all text-slate-600 dark:text-slate-400 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <span className="inline-flex items-center gap-2">
              <Warehouse className="w-4 h-4" /> Stock
              {stockSummary?.warehouseCount !== undefined && (
                <span className="rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 text-[10px] font-semibold">
                  {stockSummary.warehouseCount}
                </span>
              )}
            </span>
          </Tabs.Trigger>
          <Tabs.Trigger
            value="movements"
            className="px-4 py-2 text-sm font-medium rounded-lg transition-all text-slate-600 dark:text-slate-400 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <span className="inline-flex items-center gap-2">
              <History className="w-4 h-4" /> Movement History
            </span>
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="info" className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4 min-w-0">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="h-16 w-16 shrink-0 rounded-2xl bg-gradient-to-br from-sky-500 to-violet-600 text-white flex items-center justify-center shadow-lg">
                    <Package className="w-8 h-8" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-2 py-0.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        <Hash className="w-3 h-3 mr-1 text-slate-400" />
                        {productDetail?.sku ?? "—"}
                      </span>
                      {productDetail && (
                        <StatusBadge
                          tone={PRODUCT_STATUS_TONE[productDetail.status]}
                          size="md"
                          dot={productDetail.status === "ACTIVE"}
                          label={
                            productDetail.status === "OUT_OF_STOCK"
                              ? "Out of Stock"
                              : productDetail.status === "DISCONTINUED"
                              ? "Discontinued"
                              : productDetail.status.charAt(0) +
                                productDetail.status.slice(1).toLowerCase()
                          }
                        />
                      )}
                      {productDetail?.category?.name && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 px-2 py-0.5 text-xs border border-sky-200 dark:border-sky-900/60">
                          <Tag className="w-3 h-3" />
                          {productDetail.category.name}
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground truncate">
                      {productDetail?.name ?? "…"}
                    </h2>
                    {productDetail?.description ? (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {productDetail.description}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        No description added.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/30 p-4 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Box className="w-3.5 h-3.5" />
                      Unit / Weight
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {productDetail?.unit ?? "—"}
                      {productDetail?.weight !== null &&
                        productDetail?.weight !== undefined &&
                        productDetail?.weight !== "" && (
                          <span className="text-xs text-muted-foreground ml-2">
                            · {Number(productDetail.weight).toLocaleString()} kg
                          </span>
                        )}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/30 p-4 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Warehouse className="w-3.5 h-3.5" />
                      Total Stock
                    </div>
                    <p className="text-sm font-semibold text-foreground tabular-nums">
                      {stockSummary?.totalQuantity?.toLocaleString() ?? "—"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs text-slate-500 mb-1.5">Cost Price (Buy)</p>
                    <MoneyDisplay
                      value={productDetail?.costPrice}
                      currency={productDetail?.currency ?? "USD"}
                      align="left"
                      className="!w-auto !text-lg !font-semibold"
                    />
                  </div>
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 p-4">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1.5">
                      Unit Price (Sell)
                    </p>
                    <MoneyDisplay
                      value={productDetail?.sellingPrice}
                      currency={productDetail?.currency ?? "USD"}
                      align="left"
                      className="!w-auto !text-lg !font-semibold !text-emerald-700 dark:!text-emerald-300"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-border space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 inline-flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Created by
                    </span>
                    <span className="text-foreground truncate max-w-[20ch]">—</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Created
                    </span>
                    <DateDisplay date={productDetail?.createdAt} format="short" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Updated
                    </span>
                    <DateDisplay date={productDetail?.updatedAt} format="short" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="stock" className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="px-1">
                <h3 className="text-sm font-semibold text-foreground">Stock per Warehouse</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stockSummary
                    ? `${stockSummary.totalQuantity?.toLocaleString() ?? 0} total units across ${stockSummary.warehouseCount ?? 0} ${
                        stockSummary.warehouseCount === 1 ? "warehouse" : "warehouses"
                      }`
                    : "Loading stock summary…"}
                </p>
              </div>
            </div>

            <GlobalTable<WarehouseStockRow>
              columns={stockColumns}
              data={warehouseRows}
              hidePagination
              syncUrl={false}
              getRowId={(w) => w.warehouseId}
              emptyIcon={<Warehouse className="w-8 h-8" />}
              emptyTitle="No warehouse stock"
              emptyDescription="This product has no stock recorded in any warehouse yet."
              wrapperHeightClassName=""
            />
          </div>
        </Tabs.Content>

        <Tabs.Content value="movements" className="space-y-4">
          <GlobalTable<MovementItem>
            columns={movementColumns}
            data={movements}
            meta={movementsMeta as any}
            serverSide
            pageSizeDefault={25}
            defaultSortBy="createdAt"
            defaultSortOrder="desc"
            queryResult={{
              data: movementsRes?.data as any,
              isFetching: false,
            }}
            getRowId={(m) => m.id}
            emptyIcon={<History className="w-10 h-10" />}
            emptyTitle="No movement history"
            emptyDescription="No stock movements have been recorded for this product yet."
          />
        </Tabs.Content>
      </Tabs.Root>

      <GlobalModal
        open={editProductOpen}
        onOpenChange={(o) => !o && setEditProductOpen(false)}
        title="Edit product"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditProductOpen(false)}>
              Cancel
            </Button>
            <PermissionGate one="inventory.products.update">
              <Button
                type="submit"
                form="editProductDetailForm"
                disabled={updateProductState.isLoading || !canUpdate}
              >
                {updateProductState.isLoading ? "Saving…" : "Save changes"}
              </Button>
            </PermissionGate>
          </div>
        }
      >
        <form
          id="editProductDetailForm"
          onSubmit={productForm.handleSubmit(onSubmitEditProduct)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="SKU"
              disabled
              error={productForm.formState.errors.sku?.message}
              {...productForm.register("sku")}
            />
            <GlobalInput
              label="Name"
              required
              error={productForm.formState.errors.name?.message}
              {...productForm.register("name")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalSelect
              label="Category"
              value={productForm.watch("categoryId")}
              onChange={(v) =>
                productForm.setValue("categoryId", v, { shouldValidate: true })
              }
              options={categoryFormOptions}
              placeholder="Select category…"
              error={productForm.formState.errors.categoryId?.message}
            />
            <GlobalSelect
              label="Status"
              value={productForm.watch("status")}
              onChange={(v) =>
                productForm.setValue("status", v as any, { shouldValidate: true })
              }
              options={productStatusFormOptions}
              placeholder="Select status…"
              error={productForm.formState.errors.status?.message}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalSelect
              label="Unit of measure"
              value={productForm.watch("unit")}
              onChange={(v) => productForm.setValue("unit", v, { shouldValidate: true })}
              options={UNIT_OF_MEASURE_OPTIONS}
              placeholder="Select unit…"
              error={productForm.formState.errors.unit?.message}
            />
            <GlobalInput
              label="Barcode"
              error={productForm.formState.errors.barcode?.message}
              {...productForm.register("barcode")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Cost price (buy)"
              inputType="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              error={productForm.formState.errors.costPrice?.message as any}
              {...productForm.register("costPrice")}
            />
            <GlobalInput
              label="Unit price (sell)"
              inputType="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              error={productForm.formState.errors.sellingPrice?.message as any}
              {...productForm.register("sellingPrice")}
            />
          </div>
          <GlobalInput
            label="Weight (kg)"
            inputType="number"
            inputMode="decimal"
            step="0.001"
            min="0"
            error={productForm.formState.errors.weight?.message as any}
            {...productForm.register("weight")}
          />
          <div>
            <label className="block text-sm font-medium text-foreground">Description</label>
            <textarea
              rows={3}
              className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Product description, notes, or specifications…"
              maxLength={2000}
              {...productForm.register("description")}
            />
            {productForm.formState.errors.description?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {productForm.formState.errors.description.message}
              </p>
            )}
          </div>
          {updateProductState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (updateProductState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to update product."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={(o) => !o && setDeleteConfirmOpen(false)}
        title="Delete product"
        variant="destructive"
        description={
          productDetail
            ? `Deleting "${productDetail.name}" is permanent and will remove all associated stock levels and movement history. This action cannot be undone.`
            : ""
        }
        confirmText={deleteProductState.isLoading ? "Deleting…" : "Delete product"}
        loading={deleteProductState.isLoading}
        icon={<Trash2 className="w-5 h-5" />}
        onConfirm={handleDeleteProduct}
      />
    </div>
  );
}
