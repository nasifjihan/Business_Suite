"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeftRight,
  Plus,
  PackageOpen,
  Eye,
  MoveRight,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { GlobalTable } from "@/components/tables/GlobalTable";
import { GlobalModal } from "@/components/feedback/GlobalModal";
import { GlobalInput } from "@/components/form/GlobalInput";
import { GlobalSelect } from "@/components/form/GlobalSelect";
import { GlobalDatePicker } from "@/components/form/GlobalDatePicker";
import { StatusBadge, type StatusBadgeTone } from "@/components/common/StatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { PermissionGate, useHasPermission } from "@/components/auth/PermissionGate";
import { createColumns, type TableFeatures } from "@/lib/table-utils";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import {
  useListMovementsQuery,
  useCreateMovementMutation,
  useCreateTransferMutation,
  useListWarehousesQuery,
  useListProductsQuery,
} from "@/lib/api/inventoryEndpoints";
import type {
  MovementItem,
  MovementType,
  ListMovementsArgs,
  WarehouseItem,
  ProductItem,
} from "@/lib/api/inventoryEndpoints";

const extract = <T,>(resp?: { success: true; data: { items: T[]; meta: unknown } }) =>
  resp?.data ?? { items: [] as T[], meta: undefined };

type UiMovementType =
  | "IN"
  | "OUT"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "ADJUST"
  | "COUNT"
  | "SCRAP";

const MOVEMENT_TONE: Record<UiMovementType, StatusBadgeTone> = {
  IN: "emerald",
  OUT: "rose",
  TRANSFER_IN: "sky",
  TRANSFER_OUT: "sky",
  ADJUST: "violet",
  COUNT: "teal",
  SCRAP: "rose",
};

const MOVEMENT_LABEL: Record<UiMovementType, string> = {
  IN: "Stock In",
  OUT: "Stock Out",
  TRANSFER_IN: "Transfer In",
  TRANSFER_OUT: "Transfer Out",
  ADJUST: "Adjustment",
  COUNT: "Stock Count",
  SCRAP: "Scrap",
};

const uiToApi: Record<UiMovementType, MovementType> = {
  IN: "RECEIPT",
  OUT: "ISSUE",
  TRANSFER_IN: "TRANSFER_IN",
  TRANSFER_OUT: "TRANSFER_OUT",
  ADJUST: "ADJUSTMENT",
  COUNT: "ADJUSTMENT",
  SCRAP: "ISSUE",
};

const apiToUi: Record<string, UiMovementType> = {
  RECEIPT: "IN",
  ISSUE: "OUT",
  TRANSFER_IN: "TRANSFER_IN",
  TRANSFER_OUT: "TRANSFER_OUT",
  ADJUSTMENT: "ADJUST",
  RETURN: "IN",
  SALE: "OUT",
  PURCHASE: "IN",
};

const movementFilterOptions = [
  { value: "", label: "All types" },
  { value: "IN", label: "Stock In" },
  { value: "OUT", label: "Stock Out" },
  { value: "TRANSFER_IN", label: "Transfer In" },
  { value: "TRANSFER_OUT", label: "Transfer Out" },
  { value: "ADJUST", label: "Adjustment" },
  { value: "COUNT", label: "Stock Count" },
  { value: "SCRAP", label: "Scrap" },
];

const movementFormOptions = movementFilterOptions.filter((o) => o.value !== "");

const movementSchema = z.object({
  movementType: z.enum([
    "IN",
    "OUT",
    "TRANSFER_IN",
    "TRANSFER_OUT",
    "ADJUST",
    "COUNT",
    "SCRAP",
  ] as const),
  warehouseId: z.string().trim().min(1, "Required"),
  productId: z.string().trim().min(1, "Required"),
  quantity: z.coerce.number().int().min(1, "Must be at least 1"),
  reference: z.string().trim().max(255).optional().or(z.literal("")),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});
type MovementFormValues = z.infer<typeof movementSchema>;

const transferSchema = z.object({
  fromWarehouseId: z.string().trim().min(1, "Required"),
  toWarehouseId: z.string().trim().min(1, "Required"),
  productId: z.string().trim().min(1, "Required"),
  quantity: z.coerce.number().int().min(1, "Must be at least 1"),
  reference: z.string().trim().max(255).optional().or(z.literal("")),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});
type TransferFormValues = z.infer<typeof transferSchema>;

export default function MovementsLedgerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canCreate = useHasPermission({ one: "inventory.movements.create" });

  const filters: ListMovementsArgs & { search?: string; movementTypeUi?: string } = useMemo(() => {
    const page = parseInt(searchParams?.get("page") ?? "1", 10) || 1;
    const pageSize = parseInt(searchParams?.get("pageSize") ?? "25", 10) || 25;
    const mt = searchParams?.get("movementType");
    let apiMovementType: MovementType | undefined;
    if (mt && mt in uiToApi) {
      apiMovementType = uiToApi[mt as UiMovementType];
    }
    return {
      page,
      pageSize,
      search: searchParams?.get("search") ?? "",
      movementType: apiMovementType,
      warehouseId: searchParams?.get("warehouseId") || undefined,
      productId: searchParams?.get("productId") || undefined,
      fromDate: searchParams?.get("fromDate") || undefined,
      toDate: searchParams?.get("toDate") || undefined,
      movementTypeUi: mt || undefined,
      sortBy: searchParams?.get("sortBy") ?? "createdAt",
      sortOrder: (searchParams?.get("sortOrder") as "asc" | "desc") ?? "desc",
    };
  }, [searchParams]);

  const { data: movementsRes, isFetching, refetch } = useListMovementsQuery(
    {
      page: filters.page,
      pageSize: filters.pageSize,
      movementType: filters.movementType,
      warehouseId: filters.warehouseId,
      productId: filters.productId,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
    },
    { refetchOnMountOrArgChange: true }
  );

  const { data: warehousesRes } = useListWarehousesQuery({ pageSize: 100 });
  const { data: productsRes } = useListProductsQuery({ pageSize: 200 });

  const movements = (extract(movementsRes as any).items ?? []) as MovementItem[];
  const meta = extract(movementsRes as any).meta;
  const warehouses = (extract(warehousesRes as any).items ?? []) as WarehouseItem[];
  const products = (extract(productsRes as any).items ?? []) as ProductItem[];

  const warehouseFilterOptions = useMemo(
    () => [
      { value: "", label: "All warehouses" },
      ...warehouses.map((w) => ({ value: w.id, label: w.name })),
    ],
    [warehouses]
  );

  const productFilterOptions = useMemo(
    () => [
      { value: "", label: "All products" },
      ...products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` })),
    ],
    [products]
  );

  const warehouseFormOptions = useMemo(
    () => warehouses.map((w) => ({ value: w.id, label: w.name })),
    [warehouses]
  );

  const productFormOptions = useMemo(
    () => products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` })),
    [products]
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

  type ModalState =
    | { kind: "none" }
    | { kind: "create" }
    | { kind: "transfer" }
    | { kind: "view"; movement: MovementItem };
  const [modal, setModal] = useState<ModalState>({ kind: "none" });

  const [createTrigger, createState] = useCreateMovementMutation();
  const [transferTrigger, transferState] = useCreateTransferMutation();

  const movementForm = useForm<MovementFormValues>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      movementType: "IN",
      warehouseId: "",
      productId: "",
      quantity: 1,
      reference: "",
      note: "",
    },
    mode: "onTouched",
  });

  const transferForm = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      fromWarehouseId: "",
      toWarehouseId: "",
      productId: "",
      quantity: 1,
      reference: "",
      note: "",
    },
    mode: "onTouched",
  });

  useEffect(() => {
    if (modal.kind === "create") {
      movementForm.reset({
        movementType: "IN",
        warehouseId: "",
        productId: "",
        quantity: 1,
        reference: "",
        note: "",
      });
    } else if (modal.kind === "transfer") {
      transferForm.reset({
        fromWarehouseId: "",
        toWarehouseId: "",
        productId: "",
        quantity: 1,
        reference: "",
        note: "",
      });
    }
  }, [modal, movementForm, transferForm]);

  const closeModal = () => {
    setModal({ kind: "none" });
    movementForm.reset();
    transferForm.reset();
  };

  const onSubmitCreate = async (v: MovementFormValues) => {
    const out = await createTrigger({
      movementType: uiToApi[v.movementType],
      productId: v.productId,
      warehouseId: v.warehouseId,
      quantity: v.quantity,
      reference: v.reference || undefined,
      note: v.note || undefined,
    });
    if ("data" in out && out.data?.success) {
      closeModal();
    }
  };

  const onSubmitTransfer = async (v: TransferFormValues) => {
    const out = await transferTrigger({
      fromWarehouseId: v.fromWarehouseId,
      toWarehouseId: v.toWarehouseId,
      productId: v.productId,
      quantity: v.quantity,
      reference: v.reference || undefined,
      note: v.note || undefined,
    });
    if ("data" in out && out.data?.success) {
      closeModal();
    }
  };

  const resolveUiType = (m: MovementItem): UiMovementType => {
    return apiToUi[m.movementType] ?? "ADJUST";
  };

  const isPositiveType = (uiType: UiMovementType): boolean =>
    uiType === "IN" || uiType === "TRANSFER_IN" || uiType === "COUNT" || uiType === "ADJUST";

  const columns: ColumnDef<TableFeatures, MovementItem, any>[] = useMemo(() => {
    const col = createColumns<MovementItem>();

    return [
      col.display({
        id: "movementType",
        header: "Type",
        cell: ({ row: { original: m } }) => {
          const uiType = resolveUiType(m);
          return (
            <StatusBadge
              tone={MOVEMENT_TONE[uiType]}
              size="md"
              label={MOVEMENT_LABEL[uiType]}
            />
          );
        },
      }),
      col.display({
        id: "product",
        header: "Product",
        cell: ({ row: { original: m } }) => (
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">
              {m.product?.name ?? "—"}
            </p>
            {m.product?.sku && (
              <span className="inline-flex mt-1 items-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:text-slate-400">
                {m.product.sku}
              </span>
            )}
          </div>
        ),
      }),
      col.display({
        id: "warehouse",
        header: "Warehouse",
        cell: ({ row: { original: m } }) => (
          <p className="text-sm text-foreground truncate">
            {m.warehouse?.name ?? "—"}
          </p>
        ),
      }),
      col.display({
        id: "quantity",
        header: "Quantity",
        cell: ({ row: { original: m } }) => {
          const uiType = resolveUiType(m);
          const positive = isPositiveType(uiType);
          const sign = positive ? "+" : "-";
          return (
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                positive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              )}
            >
              {sign}
              {m.quantity}
            </span>
          );
        },
      }),
      col.display({
        id: "reference",
        header: "Reference",
        cell: ({ row: { original: m } }) => {
          if (!m.reference) {
            return <span className="text-muted-foreground/60 text-sm">—</span>;
          }
          return (
            <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 px-2 py-0.5 text-xs font-medium">
              {m.reference}
            </span>
          );
        },
      }),
      col.display({
        id: "note",
        header: "Note",
        cell: ({ row: { original: m } }) => (
          <span className="text-sm text-foreground truncate max-w-[24ch] block">
            {m.note ?? <span className="text-muted-foreground/60">—</span>}
          </span>
        ),
      }),
      col.display({
        id: "user",
        header: "User",
        cell: () => (
          <span className="text-sm text-foreground truncate">
            <span className="text-muted-foreground/60">—</span>
          </span>
        ),
      }),
      col.accessor("createdAt" as any, {
        id: "createdAt",
        header: "Date",
        enableSorting: true,
        cell: ({ row: { original: m } }) => (
          <DateDisplay date={m.createdAt} format="short" />
        ),
      }),
      col.display({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row: { original: m } }) => (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setModal({ kind: "view", movement: m })}
              className="text-slate-600 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 h-8 px-2"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline ml-1">View</span>
            </Button>
          </div>
        ),
      }),
    ];
  }, []);

  const currentViewMovement = modal.kind === "view" ? modal.movement : null;
  const viewUiType = currentViewMovement ? resolveUiType(currentViewMovement) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Inventory" }, { label: "Movements" }]}
        title="Movements Ledger"
        description="Append-only log of all inventory movements, transfers, and adjustments."
        action={
          <div className="flex items-center gap-2">
            <PermissionGate one="inventory.movements.create">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal({ kind: "transfer" })}
                disabled={!canCreate}
              >
                <ArrowLeftRight className="w-4 h-4" /> Transfer Stock
              </Button>
            </PermissionGate>
            <PermissionGate one="inventory.movements.create">
              <Button
                size="sm"
                onClick={() => setModal({ kind: "create" })}
                disabled={!canCreate}
              >
                <Plus className="w-4 h-4" /> Create Movement
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <TableToolbar
        searchTerm={filters.search ?? ""}
        onSearchChange={(v) => pushParams({ search: v })}
        searchPlaceholder="Search by reference or product name…"
        startContent={
          <>
            <GlobalSelect
              value={filters.movementTypeUi ?? ""}
              onChange={(v) => pushParams({ movementType: v })}
              options={movementFilterOptions}
              placeholder="Type"
              className="w-44"
            />
            <GlobalSelect
              value={filters.warehouseId ?? ""}
              onChange={(v) => pushParams({ warehouseId: v })}
              options={warehouseFilterOptions}
              placeholder="Warehouse"
              className="w-48"
            />
            <GlobalSelect
              value={filters.productId ?? ""}
              onChange={(v) => pushParams({ productId: v })}
              options={productFilterOptions}
              placeholder="Product"
              className="w-56"
            />
            <GlobalDatePicker
              label="From"
              value={filters.fromDate ?? null}
              onChange={(v) => pushParams({ fromDate: v ?? undefined })}
              placeholder="From date"
              className="w-44"
            />
            <GlobalDatePicker
              label="To"
              value={filters.toDate ?? null}
              onChange={(v) => pushParams({ toDate: v ?? undefined })}
              placeholder="To date"
              className="w-44"
            />
          </>
        }
      />

      <GlobalTable<MovementItem>
        columns={columns}
        data={movements}
        meta={meta as any}
        serverSide
        pageSizeDefault={25}
        defaultSortBy="createdAt"
        defaultSortOrder="desc"
        queryResult={{
          data: movementsRes?.data as any,
          isFetching,
        }}
        getRowId={(m) => m.id}
        emptyIcon={<PackageOpen className="w-10 h-10" />}
        emptyTitle="No movements found"
        emptyDescription="No inventory movements match the current filters."
        errorOnRetry={() => refetch()}
      />

      <GlobalModal
        open={modal.kind === "create"}
        onOpenChange={(o) => !o && closeModal()}
        title="Create movement"
        description="Record a new inventory movement (stock in, out, adjust, etc.)"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="newMovForm"
              disabled={createState.isLoading || !canCreate}
            >
              {createState.isLoading ? "Creating…" : "Create movement"}
            </Button>
          </div>
        }
      >
        <form
          id="newMovForm"
          onSubmit={movementForm.handleSubmit(onSubmitCreate)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <GlobalSelect
              label="Movement type"
              required
              value={movementForm.watch("movementType")}
              onChange={(v) =>
                movementForm.setValue("movementType", v as any, {
                  shouldValidate: true,
                })
              }
              options={movementFormOptions}
              placeholder="Select type…"
              error={movementForm.formState.errors.movementType?.message}
            />
            <GlobalSelect
              label="Warehouse"
              required
              value={movementForm.watch("warehouseId")}
              onChange={(v) =>
                movementForm.setValue("warehouseId", v, { shouldValidate: true })
              }
              options={warehouseFormOptions}
              placeholder="Select warehouse…"
              error={movementForm.formState.errors.warehouseId?.message}
            />
            <GlobalSelect
              label="Product"
              required
              value={movementForm.watch("productId")}
              onChange={(v) =>
                movementForm.setValue("productId", v, { shouldValidate: true })
              }
              options={productFormOptions}
              placeholder="Select product…"
              error={movementForm.formState.errors.productId?.message}
            />
            <GlobalInput
              label="Quantity"
              required
              inputType="number"
              hint="Positive integer"
              error={movementForm.formState.errors.quantity?.message}
              {...movementForm.register("quantity")}
            />
            <GlobalInput
              label="Reference"
              placeholder="PO#, invoice, order #… (optional)"
              error={movementForm.formState.errors.reference?.message}
              {...movementForm.register("reference")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Note</label>
            <textarea
              rows={3}
              className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Optional note about this movement…"
              maxLength={2000}
              {...movementForm.register("note")}
            />
            {movementForm.formState.errors.note?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {movementForm.formState.errors.note.message}
              </p>
            )}
          </div>
          {createState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (createState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to create movement."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <GlobalModal
        open={modal.kind === "transfer"}
        onOpenChange={(o) => !o && closeModal()}
        title="Transfer stock"
        description="Move stock between warehouses (creates two movement entries)."
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="transferForm"
              disabled={transferState.isLoading || !canCreate}
            >
              {transferState.isLoading ? "Transferring…" : "Complete transfer"}
            </Button>
          </div>
        }
      >
        <form
          id="transferForm"
          onSubmit={transferForm.handleSubmit(onSubmitTransfer)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <GlobalSelect
              label="From Warehouse"
              required
              value={transferForm.watch("fromWarehouseId")}
              onChange={(v) =>
                transferForm.setValue("fromWarehouseId", v, {
                  shouldValidate: true,
                })
              }
              options={warehouseFormOptions}
              placeholder="Source warehouse…"
              error={transferForm.formState.errors.fromWarehouseId?.message}
            />
            <GlobalSelect
              label="To Warehouse"
              required
              value={transferForm.watch("toWarehouseId")}
              onChange={(v) =>
                transferForm.setValue("toWarehouseId", v, {
                  shouldValidate: true,
                })
              }
              options={warehouseFormOptions}
              placeholder="Destination warehouse…"
              error={transferForm.formState.errors.toWarehouseId?.message}
            />
            <GlobalSelect
              label="Product"
              required
              value={transferForm.watch("productId")}
              onChange={(v) =>
                transferForm.setValue("productId", v, { shouldValidate: true })
              }
              options={productFormOptions}
              placeholder="Select product…"
              error={transferForm.formState.errors.productId?.message}
            />
            <GlobalInput
              label="Quantity"
              required
              inputType="number"
              hint="Positive integer"
              error={transferForm.formState.errors.quantity?.message}
              {...transferForm.register("quantity")}
            />
            <GlobalInput
              label="Reference"
              placeholder="Transfer #, ticket… (optional)"
              error={transferForm.formState.errors.reference?.message}
              {...transferForm.register("reference")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 p-3 text-xs text-slate-600 dark:text-slate-400">
                <MoveRight className="w-4 h-4 shrink-0 text-sky-500" />
                <span>
                  Transfer creates two entries: a Transfer Out (from source) and Transfer
                  In (to destination). Quantity must be available in the source warehouse.
                </span>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Note</label>
            <textarea
              rows={3}
              className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Optional note about this transfer…"
              maxLength={2000}
              {...transferForm.register("note")}
            />
            {transferForm.formState.errors.note?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {transferForm.formState.errors.note.message}
              </p>
            )}
          </div>
          {transferState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (transferState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to complete transfer."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <GlobalModal
        open={modal.kind === "view"}
        onOpenChange={(o) => !o && closeModal()}
        title={
          currentViewMovement?.movementCode
            ? `Movement #${currentViewMovement.movementCode}`
            : "Movement details"
        }
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Close
            </Button>
          </div>
        }
      >
        {currentViewMovement && viewUiType && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge
                tone={MOVEMENT_TONE[viewUiType]}
                size="lg"
                label={MOVEMENT_LABEL[viewUiType]}
              />
              <DateDisplay
                date={currentViewMovement.createdAt}
                format="datetime"
                className="text-sm text-muted-foreground"
              />
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Product
                </label>
                <p className="text-sm font-medium text-foreground">
                  {currentViewMovement.product?.name ?? "—"}
                </p>
                {currentViewMovement.product?.sku && (
                  <p className="font-mono text-xs text-muted-foreground mt-0.5">
                    {currentViewMovement.product.sku}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Warehouse
                </label>
                <div className="flex items-center gap-2">
                  <WarehouseIcon className="w-4 h-4 text-slate-400 shrink-0" />
                  <p className="text-sm text-foreground">
                    {currentViewMovement.warehouse?.name ?? "—"}
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Quantity
                </label>
                <p
                  className={cn(
                    "text-lg font-bold tabular-nums",
                    isPositiveType(viewUiType)
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {isPositiveType(viewUiType) ? "+" : "-"}
                  {currentViewMovement.quantity}
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Reference
                </label>
                {currentViewMovement.reference ? (
                  <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 px-2.5 py-0.5 text-sm font-medium">
                    {currentViewMovement.reference}
                  </span>
                ) : (
                  <p className="text-sm text-muted-foreground/60">—</p>
                )}
              </div>
              {currentViewMovement.fromWarehouse && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    From Warehouse
                  </label>
                  <p className="text-sm text-foreground">
                    {currentViewMovement.fromWarehouse.name}
                  </p>
                </div>
              )}
              {currentViewMovement.toWarehouse && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    To Warehouse
                  </label>
                  <p className="text-sm text-foreground">
                    {currentViewMovement.toWarehouse.name}
                  </p>
                </div>
              )}
            </div>
            {currentViewMovement.note && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Note
                </label>
                <p className="text-sm text-foreground whitespace-pre-wrap rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 p-3">
                  {currentViewMovement.note}
                </p>
              </div>
            )}
          </div>
        )}
      </GlobalModal>
    </div>
  );
}
