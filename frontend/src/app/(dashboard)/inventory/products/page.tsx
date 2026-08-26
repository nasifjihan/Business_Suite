"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  PackagePlus,
  Package,
  Pencil,
  Trash2,
  Hash,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { TableToolbar } from "@/components/tables/TableToolbar";
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
  useListProductsQuery,
  useListCategoriesQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
} from "@/lib/api/inventoryEndpoints";
import type {
  ProductItem,
  ListProductsArgs,
  ProductStatus,
  CategoryItem,
  CreateProductRequest,
} from "@/lib/api/inventoryEndpoints";

const extract = <T,>(resp?: { success: true; data: { items: T[]; meta: unknown } }) =>
  resp?.data ?? { items: [] as T[], meta: undefined };

const PRODUCT_STATUS_TONE: Record<ProductStatus, "emerald" | "rose" | "slate"> = {
  ACTIVE: "emerald",
  INACTIVE: "slate",
  DISCONTINUED: "rose",
  OUT_OF_STOCK: "slate",
};

const UNIT_OF_MEASURE_OPTIONS = [
  { value: "EACH", label: "Each" },
  { value: "BOX", label: "Box" },
  { value: "KG", label: "Kilogram" },
  { value: "M", label: "Meter" },
  { value: "L", label: "Liter" },
];

const productStatusOptions = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "DISCONTINUED", label: "Discontinued" },
];

const productStatusFormOptions = productStatusOptions.filter((o) => o.value !== "");

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

export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canCreate = useHasPermission({ one: "inventory.products.create" });
  const canUpdate = useHasPermission({ one: "inventory.products.update" });

  const filters: ListProductsArgs = useMemo(() => {
    const page = parseInt(searchParams?.get("page") ?? "1", 10) || 1;
    const pageSize = parseInt(searchParams?.get("pageSize") ?? "25", 10) || 25;
    return {
      page,
      pageSize,
      search: searchParams?.get("search") ?? "",
      status: (searchParams?.get("status") as ProductStatus | undefined) || undefined,
      categoryId: searchParams?.get("categoryId") || undefined,
      sortBy: searchParams?.get("sortBy") ?? "createdAt",
      sortOrder: (searchParams?.get("sortOrder") as "asc" | "desc") ?? "desc",
    };
  }, [searchParams]);

  const { data: productsRes, isFetching, refetch } = useListProductsQuery(filters, {
    refetchOnMountOrArgChange: true,
  });
  const { data: categoriesRes } = useListCategoriesQuery({ pageSize: 100 });

  const products = extract(productsRes as any).items as ProductItem[];
  const meta = extract(productsRes as any).meta;
  const categories: CategoryItem[] = extract(categoriesRes as any).items as CategoryItem[];

  const categoryOptions = useMemo(() => {
    const opts = [{ value: "", label: "All categories" }];
    categories.forEach((c) => opts.push({ value: c.id, label: c.name }));
    return opts;
  }, [categories]);

  const categoryFormOptions = useMemo(() => {
    return categories.map((c) => ({ value: c.id, label: c.name }));
  }, [categories]);

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

  type ModalState =
    | { kind: "none" }
    | { kind: "create" }
    | { kind: "edit"; product: ProductItem }
    | { kind: "delete"; product: ProductItem };
  const [modal, setModal] = useState<ModalState>({ kind: "none" });

  const [createTrigger, createState] = useCreateProductMutation();
  const [updateTrigger, updateState] = useUpdateProductMutation();
  const [deleteTrigger, deleteState] = useDeleteProductMutation();

  const form = useForm<ProductFormValues>({
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
    if (modal.kind === "edit") {
      form.reset({
        name: modal.product.name,
        sku: modal.product.sku,
        barcode: modal.product.barcode ?? "",
        categoryId: modal.product.categoryId ?? "",
        status: modal.product.status,
        unit: modal.product.unit ?? "EACH",
        costPrice: modal.product.costPrice ?? 0,
        sellingPrice: modal.product.sellingPrice ?? 0,
        weight: modal.product.weight ?? "",
        description: modal.product.description ?? "",
      });
    } else if (modal.kind === "create") {
      form.reset({
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
      });
    }
  }, [modal, form]);

  const closeModal = () => {
    setModal({ kind: "none" });
    form.reset();
  };

  const parseNum = (v: string | number | undefined): number | undefined => {
    if (v === undefined || v === "") return undefined;
    const n = typeof v === "number" ? v : parseFloat(v);
    return isNaN(n) ? undefined : n;
  };

  const onSubmitCreate = async (v: ProductFormValues) => {
    const body: CreateProductRequest = {
      name: v.name,
      sku: (v.sku ?? undefined) as string | undefined,
      barcode: (v.barcode ?? undefined) as string | undefined,
      categoryId: (v.categoryId ?? undefined) as string | undefined,
      status: v.status,
      unitOfMeasure: v.unit || undefined,
      costPrice: parseNum(v.costPrice),
      unitPrice: parseNum(v.sellingPrice),
      weightKg: parseNum(v.weight),
      description: (v.description ?? undefined) as string | undefined,
    };
    const out = await createTrigger(body);
    if ("data" in out && out.data?.success) {
      closeModal();
    }
  };

  const onSubmitEdit = async (v: ProductFormValues) => {
    if (modal.kind !== "edit") return;
    const out = await updateTrigger({
      id: modal.product.id,
      body: {
        name: v.name,
        sku: (v.sku ?? undefined) as string | undefined,
        barcode: (v.barcode ?? undefined) as string | undefined,
        categoryId: (v.categoryId ?? undefined) as string | undefined,
        status: v.status,
        unitOfMeasure: v.unit || undefined,
        costPrice: parseNum(v.costPrice),
        unitPrice: parseNum(v.sellingPrice),
        weightKg: parseNum(v.weight),
        description: (v.description ?? undefined) as string | undefined,
      },
    });
    if ("data" in out && out.data?.success) {
      closeModal();
    }
  };

  const handleDelete = async () => {
    if (modal.kind !== "delete") return;
    await deleteTrigger(modal.product.id);
    setModal({ kind: "none" });
  };

  const onOpenCreate = () => setModal({ kind: "create" });

  const columns: ColumnDef<TableFeatures, ProductItem, any>[] = useMemo(() => {
    const col = createColumns<ProductItem>();

    return [
      col.display({
        id: "sku",
        header: "SKU",
        enableSorting: true,
        cell: ({ row: { original: p } }) => (
          <span className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-2 py-0.5 font-mono text-[11px] text-slate-700 dark:text-slate-300 max-w-[14ch] truncate">
            <Hash className="w-3 h-3 mr-1 text-slate-400" />
            {p.sku}
          </span>
        ),
      }),
      col.display({
        id: "name",
        header: "Product",
        cell: ({ row: { original: p } }) => (
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{p.name}</p>
            {p.description && (
              <p className="text-xs text-muted-foreground truncate max-w-[36ch] mt-0.5">
                {p.description}
              </p>
            )}
            {!p.description && p.barcode && (
              <p className="text-xs text-muted-foreground truncate font-mono">
                {p.barcode}
              </p>
            )}
          </div>
        ),
      }),
      col.display({
        id: "category",
        header: "Category",
        cell: ({ row: { original: p } }) =>
          p.category?.name ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 px-2 py-0.5 text-xs border border-sky-200 dark:border-sky-900/60">
              <Tag className="w-3 h-3" />
              {p.category.name}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      }),
      col.display({
        id: "status",
        header: "Status",
        cell: ({ row: { original: p } }) => (
          <StatusBadge
            tone={PRODUCT_STATUS_TONE[p.status]}
            size="md"
            dot={p.status === "ACTIVE"}
            label={
              p.status === "OUT_OF_STOCK"
                ? "Out of Stock"
                : p.status === "DISCONTINUED"
                ? "Discontinued"
                : p.status.charAt(0) + p.status.slice(1).toLowerCase()
            }
          />
        ),
      }),
      col.display({
        id: "price",
        header: "Pricing",
        cell: ({ row: { original: p } }) => (
          <div className="space-y-0.5 text-right">
            <div className="flex items-center justify-end gap-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wide mr-1">Buy</span>
              <MoneyDisplay
                value={p.costPrice}
                currency={p.currency ?? "USD"}
                align="left"
                className="!w-auto !text-xs text-slate-600 dark:text-slate-400"
              />
            </div>
            <div className="flex items-center justify-end gap-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wide mr-1">Sell</span>
              <MoneyDisplay
                value={p.sellingPrice}
                currency={p.currency ?? "USD"}
                align="left"
                className="!w-auto !text-xs font-semibold text-foreground"
              />
            </div>
          </div>
        ),
      }),
      col.display({
        id: "totalStock",
        header: "Stock",
        cell: ({ row: { original: p } }) => (
          <span className="inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300 tabular-nums min-w-[3ch]">
            —
          </span>
        ),
      }),
      col.display({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row: { original: p } }) => (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/inventory/products/${p.id}`)}
              className="text-slate-600 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              View
            </Button>
            <PermissionGate one="inventory.products.update">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal({ kind: "edit", product: p })}
                disabled={!canUpdate}
              >
                <Pencil className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
            </PermissionGate>
            <PermissionGate one="inventory.products.delete">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal({ kind: "delete", product: p })}
                className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </PermissionGate>
          </div>
        ),
      }),
    ];
  }, [canUpdate, router]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Inventory" }, { label: "Products" }]}
        title="Products"
        description="Manage your product catalog, inventory items, pricing, and stock levels."
        action={
          <div className="flex items-center gap-2">
            <PermissionGate one="inventory.products.create">
              <Button size="sm" onClick={onOpenCreate} disabled={!canCreate}>
                <PackagePlus className="w-4 h-4" /> New product
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <TableToolbar
        searchTerm={filters.search ?? ""}
        onSearchChange={(v) => pushParams({ search: v })}
        searchPlaceholder="Search by name, SKU, or barcode…"
        onCreateNew={canCreate ? onOpenCreate : undefined}
        disableCreateNew={!canCreate}
        startContent={
          <>
            <GlobalSelect
              value={filters.status ?? ""}
              onChange={(v) => pushParams({ status: v })}
              options={productStatusOptions}
              placeholder="Status"
              className="w-40"
            />
            <GlobalSelect
              value={filters.categoryId ?? ""}
              onChange={(v) => pushParams({ categoryId: v })}
              options={categoryOptions}
              placeholder="Category"
              className="w-44"
            />
          </>
        }
      />

      <GlobalTable<ProductItem>
        columns={columns}
        data={products}
        meta={meta as any}
        serverSide
        pageSizeDefault={25}
        defaultSortBy="createdAt"
        defaultSortOrder="desc"
        queryResult={{
          data: productsRes?.data as any,
          isFetching,
        }}
        getRowId={(p) => p.id}
        onRowClick={(p) => router.push(`/inventory/products/${p.id}`)}
        emptyIcon={<Package className="w-10 h-10" />}
        emptyTitle="No products found"
        emptyDescription="No products match the current filters."
        emptyAction={
          <PermissionGate one="inventory.products.create">
            <Button size="sm" onClick={onOpenCreate}>
              <PackagePlus className="w-4 h-4" /> New product
            </Button>
          </PermissionGate>
        }
        errorOnRetry={() => refetch()}
      />

      <GlobalModal
        open={modal.kind === "create"}
        onOpenChange={(o) => !o && closeModal()}
        title="Create new product"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <PermissionGate one="inventory.products.create">
              <Button
                type="submit"
                form="productForm"
                disabled={createState.isLoading || !canCreate}
              >
                {createState.isLoading ? "Creating…" : "Create product"}
              </Button>
            </PermissionGate>
          </div>
        }
      >
        <form
          id="productForm"
          onSubmit={form.handleSubmit(onSubmitCreate)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">SKU</label>
              <GlobalInput
                placeholder="Auto-generated on save"
                disabled
                error={form.formState.errors.sku?.message}
                {...form.register("sku")}
              />
            </div>
            <GlobalInput
              label="Name"
              required
              error={form.formState.errors.name?.message}
              {...form.register("name")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalSelect
              label="Category"
              value={form.watch("categoryId")}
              onChange={(v) => form.setValue("categoryId", v, { shouldValidate: true })}
              options={categoryFormOptions}
              placeholder="Select category…"
              error={form.formState.errors.categoryId?.message}
            />
            <GlobalSelect
              label="Status"
              value={form.watch("status")}
              onChange={(v) => form.setValue("status", v as any, { shouldValidate: true })}
              options={productStatusFormOptions}
              placeholder="Select status…"
              error={form.formState.errors.status?.message}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalSelect
              label="Unit of measure"
              value={form.watch("unit")}
              onChange={(v) => form.setValue("unit", v, { shouldValidate: true })}
              options={UNIT_OF_MEASURE_OPTIONS}
              placeholder="Select unit…"
              error={form.formState.errors.unit?.message}
            />
            <GlobalInput
              label="Barcode"
              error={form.formState.errors.barcode?.message}
              {...form.register("barcode")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Cost price (buy)"
              inputType="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              error={form.formState.errors.costPrice?.message as any}
              {...form.register("costPrice")}
            />
            <GlobalInput
              label="Unit price (sell)"
              inputType="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              error={form.formState.errors.sellingPrice?.message as any}
              {...form.register("sellingPrice")}
            />
          </div>
          <GlobalInput
            label="Weight (kg)"
            inputType="number"
            inputMode="decimal"
            step="0.001"
            min="0"
            error={form.formState.errors.weight?.message as any}
            {...form.register("weight")}
          />
          <div>
            <label className="block text-sm font-medium text-foreground">Description</label>
            <textarea
              rows={3}
              className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Product description, notes, or specifications…"
              maxLength={2000}
              {...form.register("description")}
            />
            {form.formState.errors.description?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>
          {createState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (createState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to create product."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <GlobalModal
        open={modal.kind === "edit"}
        onOpenChange={(o) => !o && closeModal()}
        title="Edit product"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <PermissionGate one="inventory.products.update">
              <Button
                type="submit"
                form="productForm"
                disabled={updateState.isLoading || !canUpdate}
              >
                {updateState.isLoading ? "Saving…" : "Save changes"}
              </Button>
            </PermissionGate>
          </div>
        }
      >
        <form
          id="productForm"
          onSubmit={form.handleSubmit(onSubmitEdit)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="SKU"
              disabled
              error={form.formState.errors.sku?.message}
              {...form.register("sku")}
            />
            <GlobalInput
              label="Name"
              required
              error={form.formState.errors.name?.message}
              {...form.register("name")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalSelect
              label="Category"
              value={form.watch("categoryId")}
              onChange={(v) => form.setValue("categoryId", v, { shouldValidate: true })}
              options={categoryFormOptions}
              placeholder="Select category…"
              error={form.formState.errors.categoryId?.message}
            />
            <GlobalSelect
              label="Status"
              value={form.watch("status")}
              onChange={(v) => form.setValue("status", v as any, { shouldValidate: true })}
              options={productStatusFormOptions}
              placeholder="Select status…"
              error={form.formState.errors.status?.message}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalSelect
              label="Unit of measure"
              value={form.watch("unit")}
              onChange={(v) => form.setValue("unit", v, { shouldValidate: true })}
              options={UNIT_OF_MEASURE_OPTIONS}
              placeholder="Select unit…"
              error={form.formState.errors.unit?.message}
            />
            <GlobalInput
              label="Barcode"
              error={form.formState.errors.barcode?.message}
              {...form.register("barcode")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Cost price (buy)"
              inputType="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              error={form.formState.errors.costPrice?.message as any}
              {...form.register("costPrice")}
            />
            <GlobalInput
              label="Unit price (sell)"
              inputType="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              error={form.formState.errors.sellingPrice?.message as any}
              {...form.register("sellingPrice")}
            />
          </div>
          <GlobalInput
            label="Weight (kg)"
            inputType="number"
            inputMode="decimal"
            step="0.001"
            min="0"
            error={form.formState.errors.weight?.message as any}
            {...form.register("weight")}
          />
          <div>
            <label className="block text-sm font-medium text-foreground">Description</label>
            <textarea
              rows={3}
              className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Product description, notes, or specifications…"
              maxLength={2000}
              {...form.register("description")}
            />
            {form.formState.errors.description?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>
          {updateState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (updateState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to update product."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <ConfirmDialog
        open={modal.kind === "delete"}
        onOpenChange={(o) => !o && closeModal()}
        title="Delete product"
        variant="destructive"
        description={
          modal.kind === "delete"
            ? `Deleting "${modal.product.name}" is permanent and will remove all associated stock levels and movement history. This action cannot be undone.`
            : ""
        }
        confirmText={deleteState.isLoading ? "Deleting…" : "Delete product"}
        loading={deleteState.isLoading}
        icon={<Trash2 className="w-5 h-5" />}
        onConfirm={handleDelete}
      />
    </div>
  );
}
