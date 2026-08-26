"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as Switch from "@radix-ui/react-switch";
import {
  Warehouse as WarehouseIcon,
  Building2,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { GlobalTable } from "@/components/tables/GlobalTable";
import { GlobalModal } from "@/components/feedback/GlobalModal";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { GlobalInput } from "@/components/form/GlobalInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { PermissionGate, useHasPermission } from "@/components/auth/PermissionGate";
import { createColumns, type TableFeatures } from "@/lib/table-utils";
import type { ColumnDef } from "@tanstack/react-table";
import {
  useListWarehousesQuery,
  useListStockQuery,
  useCreateWarehouseMutation,
  useUpdateWarehouseMutation,
} from "@/lib/api/inventoryEndpoints";
import type {
  WarehouseItem,
  ListWarehousesArgs,
} from "@/lib/api/inventoryEndpoints";

const extract = <T,>(resp?: { success: true; data: { items: T[]; meta: unknown } }) =>
  resp?.data ?? { items: [] as T[], meta: undefined };

const warehouseFormSchema = z.object({
  name: z.string().trim().min(1, "Required").max(255),
  warehouseCode: z.string().trim().max(50).optional().or(z.literal("")),
  address: z.string().trim().max(1000).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});
type WarehouseFormValues = z.infer<typeof warehouseFormSchema>;

export default function WarehousesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canCreate = useHasPermission({ one: "inventory.warehouses.create" });
  const canUpdate = useHasPermission({ one: "inventory.warehouses.update" });
  const canDelete = useHasPermission({ one: "inventory.warehouses.delete" });

  const filters: ListWarehousesArgs = useMemo(() => {
    const page = parseInt(searchParams?.get("page") ?? "1", 10) || 1;
    const pageSize = parseInt(searchParams?.get("pageSize") ?? "25", 10) || 25;
    return {
      page,
      pageSize,
      search: searchParams?.get("search") ?? "",
    };
  }, [searchParams]);

  const { data: warehousesRes, isFetching, refetch } = useListWarehousesQuery(filters, {
    refetchOnMountOrArgChange: true,
  });

  const { data: stockRes } = useListStockQuery({ page: 1, pageSize: 10000 });

  const warehouses = extract(warehousesRes as any).items as WarehouseItem[];
  const meta = extract(warehousesRes as any).meta;
  const stockItems = extract(stockRes as any).items as Array<{
    warehouseId: string;
    quantity: number | string;
  }>;

  const stockByWarehouse = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of stockItems ?? []) {
      const qty = typeof s.quantity === "number" ? s.quantity : parseFloat(String(s.quantity ?? "0"));
      if (!isFinite(qty)) continue;
      const current = map.get(s.warehouseId) ?? 0;
      map.set(s.warehouseId, current + qty);
    }
    return map;
  }, [stockItems]);

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
    | { kind: "edit"; warehouse: WarehouseItem }
    | { kind: "delete"; warehouse: WarehouseItem };
  const [modal, setModal] = useState<ModalState>({ kind: "none" });

  const [createTrigger, createState] = useCreateWarehouseMutation();
  const [updateTrigger, updateState] = useUpdateWarehouseMutation();

  const form = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseFormSchema),
    defaultValues: {
      name: "",
      warehouseCode: "",
      address: "",
      isActive: true,
    },
    mode: "onTouched",
  });

  useEffect(() => {
    if (modal.kind === "edit") {
      form.reset({
        name: modal.warehouse.name,
        warehouseCode: modal.warehouse.warehouseCode ?? "",
        address: [
          modal.warehouse.address,
          modal.warehouse.city,
          modal.warehouse.state,
          modal.warehouse.country,
          modal.warehouse.postalCode,
        ]
          .filter(Boolean)
          .join(", "),
        isActive: modal.warehouse.isActive,
      });
    } else if (modal.kind === "create") {
      form.reset({
        name: "",
        warehouseCode: "",
        address: "",
        isActive: true,
      });
    }
  }, [modal, form]);

  const closeModal = () => {
    setModal({ kind: "none" });
    form.reset();
  };

  const onSubmitCreate = async (v: WarehouseFormValues) => {
    const out = await createTrigger({
      name: v.name,
      warehouseCode: v.warehouseCode || undefined,
      address: v.address || undefined,
      isActive: v.isActive,
    });
    if ("data" in out && out.data?.success) {
      closeModal();
    }
  };

  const onSubmitEdit = async (v: WarehouseFormValues) => {
    if (modal.kind !== "edit") return;
    const out = await updateTrigger({
      id: modal.warehouse.id,
      body: {
        name: v.name,
        warehouseCode: v.warehouseCode || undefined,
        address: v.address || undefined,
        isActive: v.isActive,
      },
    });
    if ("data" in out && out.data?.success) {
      closeModal();
    }
  };

  const handleSoftDelete = async () => {
    if (modal.kind !== "delete") return;
    await updateTrigger({
      id: modal.warehouse.id,
      body: { isActive: false },
    });
    setModal({ kind: "none" });
  };

  const onOpenCreate = () => setModal({ kind: "create" });

  const columns: ColumnDef<TableFeatures, WarehouseItem, any>[] = useMemo(() => {
    const col = createColumns<WarehouseItem>();
    return [
      col.display({
        id: "warehouseCode",
        header: "ID",
        cell: ({ row: { original: w } }) => (
          <span className="font-mono text-xs uppercase text-slate-600 dark:text-slate-400 truncate max-w-[10ch] inline-flex rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-1.5 py-0.5">
            {w.warehouseCode}
          </span>
        ),
      }),
      col.display({
        id: "name",
        header: "Name",
        cell: ({ row: { original: w } }) => (
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 shrink-0 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-200 dark:border-sky-900/60">
              <Building2 className="w-4 h-4" />
            </div>
            <p className="font-medium text-sm text-foreground truncate max-w-[18ch]">{w.name}</p>
          </div>
        ),
      }),
      col.display({
        id: "location",
        header: "Location",
        cell: ({ row: { original: w } }) => {
          const parts = [w.address, w.city, w.country].filter(Boolean);
          return (
            <span className="text-sm text-muted-foreground truncate max-w-[20ch] block">
              {parts.length > 0 ? parts.join(", ") : "—"}
            </span>
          );
        },
      }),
      col.display({
        id: "isActive",
        header: "Status",
        cell: ({ row: { original: w } }) => (
          <StatusBadge
            tone={w.isActive ? "emerald" : "slate"}
            size="md"
            dot={w.isActive}
            label={w.isActive ? "Active" : "Inactive"}
          />
        ),
      }),
      col.display({
        id: "stockQty",
        header: "Stock Qty",
        cell: ({ row: { original: w } }) => {
          const qty = stockByWarehouse.get(w.id);
          if (qty === undefined || qty === null) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <StatusBadge
              tone="teal"
              size="sm"
              label={qty.toLocaleString()}
            />
          );
        },
      }),
      col.display({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row: { original: w } }) => (
          <div className="flex items-center justify-end gap-1.5">
            <PermissionGate one="inventory.warehouses.update">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal({ kind: "edit", warehouse: w })}
                disabled={!canUpdate}
              >
                <Pencil className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
            </PermissionGate>
            <PermissionGate one="inventory.warehouses.delete">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal({ kind: "delete", warehouse: w })}
                className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900"
                disabled={!canDelete}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </PermissionGate>
          </div>
        ),
      }),
    ];
  }, [canUpdate, canDelete, stockByWarehouse]);

  const formIdCreate = "whFormIdCreate";
  const formIdEdit = "whFormIdEdit";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Inventory" }, { label: "Warehouses" }]}
        title="Warehouses"
        description="Manage warehouse locations, storage capacities, and inventory sites."
        action={
          <div className="flex items-center gap-2">
            <PermissionGate one="inventory.warehouses.create">
              <Button size="sm" onClick={onOpenCreate} disabled={!canCreate}>
                <WarehouseIcon className="w-4 h-4" /> New warehouse
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <TableToolbar
        searchTerm={filters.search ?? ""}
        onSearchChange={(v) => pushParams({ search: v })}
        searchPlaceholder="Search warehouse names…"
        onCreateNew={canCreate ? onOpenCreate : undefined}
        disableCreateNew={!canCreate}
      />

      <GlobalTable<WarehouseItem>
        columns={columns}
        data={warehouses}
        meta={meta as any}
        serverSide
        pageSizeDefault={25}
        defaultSortBy="createdAt"
        defaultSortOrder="desc"
        queryResult={{
          data: warehousesRes?.data as any,
          isFetching,
        }}
        getRowId={(w) => w.id}
        emptyIcon={<WarehouseIcon className="w-10 h-10" />}
        emptyTitle="No warehouses found"
        emptyDescription="No warehouses match the current filters."
        emptyAction={
          <PermissionGate one="inventory.warehouses.create">
            <Button size="sm" onClick={onOpenCreate}>
              <WarehouseIcon className="w-4 h-4" /> New warehouse
            </Button>
          </PermissionGate>
        }
        errorOnRetry={() => refetch()}
      />

      <GlobalModal
        open={modal.kind === "create"}
        onOpenChange={(o) => !o && closeModal()}
        title="Create new warehouse"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={formIdCreate}
              disabled={createState.isLoading || !canCreate}
            >
              {createState.isLoading ? "Creating…" : "Create warehouse"}
            </Button>
          </div>
        }
      >
        <form
          id={formIdCreate}
          onSubmit={form.handleSubmit(onSubmitCreate)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Name"
              required
              error={form.formState.errors.name?.message}
              {...form.register("name")}
            />
            <GlobalInput
              label="Code"
              hint="Short uppercase identifier (auto-cased by backend)"
              error={form.formState.errors.warehouseCode?.message}
              {...form.register("warehouseCode")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Location</label>
            <textarea
              className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Full address, city, region, country…"
              rows={4}
              maxLength={1000}
              {...form.register("address")}
            />
            {form.formState.errors.address?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {form.formState.errors.address.message}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-slate-50 dark:bg-slate-900/30 px-4 py-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Active</p>
              <p className="text-xs text-muted-foreground">
                Mark this warehouse as active and available for operations
              </p>
            </div>
            <Switch.Root
              checked={form.watch("isActive")}
              onCheckedChange={(v) => form.setValue("isActive", v)}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/70 focus:ring-offset-2 bg-slate-200 dark:bg-slate-700 data-[state=checked]:bg-primary"
            >
              <Switch.Thumb className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-md transition-transform data-[state=checked]:translate-x-5" />
            </Switch.Root>
          </div>
          {createState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (createState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to create warehouse."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <GlobalModal
        open={modal.kind === "edit"}
        onOpenChange={(o) => !o && closeModal()}
        title="Edit warehouse"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={formIdEdit}
              disabled={updateState.isLoading || !canUpdate}
            >
              {updateState.isLoading ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      >
        <form
          id={formIdEdit}
          onSubmit={form.handleSubmit(onSubmitEdit)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Name"
              required
              error={form.formState.errors.name?.message}
              {...form.register("name")}
            />
            <GlobalInput
              label="Code"
              hint="Short uppercase identifier (auto-cased by backend)"
              error={form.formState.errors.warehouseCode?.message}
              {...form.register("warehouseCode")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Location</label>
            <textarea
              className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Full address, city, region, country…"
              rows={4}
              maxLength={1000}
              {...form.register("address")}
            />
            {form.formState.errors.address?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {form.formState.errors.address.message}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-slate-50 dark:bg-slate-900/30 px-4 py-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Active</p>
              <p className="text-xs text-muted-foreground">
                Mark this warehouse as active and available for operations
              </p>
            </div>
            <Switch.Root
              checked={form.watch("isActive")}
              onCheckedChange={(v) => form.setValue("isActive", v)}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/70 focus:ring-offset-2 bg-slate-200 dark:bg-slate-700 data-[state=checked]:bg-primary"
            >
              <Switch.Thumb className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-md transition-transform data-[state=checked]:translate-x-5" />
            </Switch.Root>
          </div>
          {updateState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (updateState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to update warehouse."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <ConfirmDialog
        open={modal.kind === "delete"}
        onOpenChange={(o) => !o && closeModal()}
        title="Deactivate warehouse"
        variant="destructive"
        description={
          modal.kind === "delete"
            ? `Are you sure you want to DEACTIVATE "${modal.warehouse.name}"? The warehouse will be set as inactive and will no longer be available for new operations. Existing stock and records will be preserved.`
            : ""
        }
        confirmText={updateState.isLoading ? "Deactivating…" : "Deactivate warehouse"}
        loading={updateState.isLoading}
        icon={<Trash2 className="w-5 h-5" />}
        onConfirm={handleSoftDelete}
      />
    </div>
  );
}
