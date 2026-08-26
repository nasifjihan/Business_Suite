"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FileText,
  Pencil,
  Trash2,
  Plus,
  RefreshCw,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { GlobalTable } from "@/components/tables/GlobalTable";
import { GlobalModal } from "@/components/feedback/GlobalModal";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { GlobalInput } from "@/components/form/GlobalInput";
import { GlobalSelect } from "@/components/form/GlobalSelect";
import { GlobalDatePicker } from "@/components/form/GlobalDatePicker";
import { StatusBadge, type StatusBadgeTone } from "@/components/common/StatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { MoneyDisplay } from "@/components/common/MoneyDisplay";
import { PermissionGate, useHasPermission } from "@/components/auth/PermissionGate";
import { createColumns, type TableFeatures } from "@/lib/table-utils";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import {
  useListContractsQuery,
  useCreateContractMutation,
  useUpdateContractMutation,
  useDeleteContractMutation,
  useListCustomersQuery,
} from "@/lib/api/crmEndpoints";
import type {
  ContractItem,
  ContractStatus,
  ListContractsArgs,
  CreateContractRequest,
  UpdateContractRequest,
  CustomerItem,
} from "@/lib/api/crmEndpoints";

const extract = <T,>(resp?: { success: true; data: { items: T[]; meta: unknown } }) =>
  resp?.data ?? { items: [] as T[], meta: undefined };

const CONTRACT_STATUS_TONE: Record<ContractStatus, StatusBadgeTone> = {
  DRAFT: "slate",
  SIGNED: "sky",
  ACTIVE: "emerald",
  EXPIRED: "slate",
  TERMINATED: "rose",
};

const statusFilterOptions = [
  { value: "", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "SIGNED", label: "Signed" },
  { value: "ACTIVE", label: "Active" },
  { value: "EXPIRED", label: "Expired" },
  { value: "TERMINATED", label: "Terminated" },
];

const statusFormOptions = statusFilterOptions.filter((o) => o.value !== "");

const statusLabel = (s: ContractStatus) =>
  s.charAt(0) + s.slice(1).toLowerCase();

const contractFormSchema = z
  .object({
    title: z.string().trim().min(1, "Required").max(255),
    customerId: z.string().trim().min(1, "Customer is required"),
    status: z.enum([
      "DRAFT",
      "SIGNED",
      "ACTIVE",
      "EXPIRED",
      "TERMINATED",
    ] as const),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    value: z.coerce.number().optional(),
    signedAt: z.string().optional(),
    signedById: z.string().trim().optional().or(z.literal("")),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      return new Date(data.endDate) >= new Date(data.startDate);
    },
    {
      message: "End date must be on or after start date",
      path: ["endDate"],
    }
  );
type ContractFormValues = z.infer<typeof contractFormSchema>;

type ModalState =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; contract: ContractItem }
  | { kind: "delete"; contract: ContractItem };

export default function ContractsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canCreate = useHasPermission({ one: "crm.contracts.create" });
  const canUpdate = useHasPermission({ one: "crm.contracts.update" });
  const canDelete = useHasPermission({ one: "crm.contracts.delete" });

  const filters: ListContractsArgs = useMemo(() => {
    const page = parseInt(searchParams?.get("page") ?? "1", 10) || 1;
    const pageSize = parseInt(searchParams?.get("pageSize") ?? "25", 10) || 25;
    return {
      page,
      pageSize,
      search: searchParams?.get("search") ?? "",
      status: (searchParams?.get("status") as ContractStatus | undefined) || undefined,
      customerId: searchParams?.get("customerId") || undefined,
      sortBy: searchParams?.get("sortBy") ?? "createdAt",
      sortOrder: (searchParams?.get("sortOrder") as "asc" | "desc") ?? "desc",
    };
  }, [searchParams]);

  const { data: contractsRes, isFetching, refetch } = useListContractsQuery(
    filters,
    {
      refetchOnMountOrArgChange: true,
    }
  );

  const { data: customersRes } = useListCustomersQuery({ pageSize: 100 });

  const contracts = extract(contractsRes as any).items as ContractItem[];
  const meta = extract(contractsRes as any).meta;
  const customers = extract(customersRes as any).items as CustomerItem[];

  const customerOptions = useMemo(
    () => customers.map((c: any) => ({ value: c.id, label: c.name })),
    [customers]
  );
  const customerFilterOptions = useMemo(
    () => [{ value: "", label: "All customers" }, ...customerOptions],
    [customerOptions]
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

  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [createTrigger, createState] = useCreateContractMutation();
  const [updateTrigger, updateState] = useUpdateContractMutation();
  const [deleteTrigger, deleteState] = useDeleteContractMutation();

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      title: "",
      customerId: "",
      status: "DRAFT",
      startDate: "",
      endDate: "",
      value: 0,
      signedAt: "",
      signedById: "",
      notes: "",
    },
    mode: "onTouched",
  });

  useEffect(() => {
    if (modal.kind === "edit") {
      form.reset({
        title: modal.contract.title,
        customerId: modal.contract.customerId,
        status: modal.contract.status,
        startDate: modal.contract.startDate,
        endDate: modal.contract.endDate,
        value:
          typeof modal.contract.value === "string"
            ? parseFloat(modal.contract.value)
            : modal.contract.value,
        signedAt: modal.contract.signedAt ?? "",
        signedById: modal.contract.signedById ?? "",
        notes: "",
      });
    } else if (modal.kind === "create") {
      form.reset({
        title: "",
        customerId: customers[0]?.id ?? "",
        status: "DRAFT",
        startDate: "",
        endDate: "",
        value: 0,
        signedAt: "",
        signedById: "",
        notes: "",
      });
    }
  }, [modal, form, customers]);

  const closeModal = () => {
    setModal({ kind: "none" });
    form.reset();
  };

  const onSubmitCreate = async (v: ContractFormValues) => {
    const body: CreateContractRequest = {
      title: v.title,
      customerId: v.customerId,
      status: v.status,
      startDate: v.startDate,
      endDate: v.endDate,
      value: v.value,
      signedAt: v.signedAt || undefined,
      signedById: v.signedById || undefined,
      notes: v.notes || undefined,
    };
    const out = await createTrigger(body);
    if ("data" in out && out.data?.success) {
      closeModal();
    }
  };

  const onSubmitEdit = async (v: ContractFormValues) => {
    if (modal.kind !== "edit") return;
    const body: UpdateContractRequest = {
      title: v.title,
      customerId: v.customerId,
      status: v.status,
      startDate: v.startDate,
      endDate: v.endDate,
      value: v.value,
      signedAt: v.signedAt || undefined,
      signedById: v.signedById || undefined,
      notes: v.notes || undefined,
    };
    const out = await updateTrigger({
      id: modal.contract.id,
      body,
    });
    if ("data" in out && out.data?.success) {
      closeModal();
    }
  };

  const handleDelete = async () => {
    if (modal.kind !== "delete") return;
    await deleteTrigger(modal.contract.id);
    setModal({ kind: "none" });
  };

  const onOpenCreate = () => setModal({ kind: "create" });

  const columns: ColumnDef<TableFeatures, ContractItem, any>[] = useMemo(() => {
    const col = createColumns<ContractItem>();
    return [
      col.display({
        id: "contractCode",
        header: "Code",
        enableSorting: true,
        cell: ({ row: { original: c } }) => (
          <span className="font-mono text-xs text-slate-600 dark:text-slate-400 truncate max-w-[12ch]">
            {c.contractCode}
          </span>
        ),
      }),
      col.display({
        id: "title",
        header: "Contract / Customer",
        cell: ({ row: { original: c } }) => (
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{c.title}</p>
            {c.customer?.name && (
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                <Building2 className="w-3 h-3 inline shrink-0" />
                {c.customer.name}
              </p>
            )}
          </div>
        ),
      }),
      col.display({
        id: "status",
        header: "Status",
        cell: ({ row: { original: c } }) => (
          <StatusBadge
            tone={CONTRACT_STATUS_TONE[c.status]}
            size="md"
            dot={c.status === "ACTIVE"}
            label={statusLabel(c.status)}
          />
        ),
      }),
      col.display({
        id: "dates",
        header: "Valid Period",
        cell: ({ row: { original: c } }) => (
          <div className="text-sm space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[10px] uppercase tracking-wider font-medium">
                From
              </span>
              <DateDisplay date={c.startDate} format="short" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[10px] uppercase tracking-wider font-medium">
                To
              </span>
              <DateDisplay date={c.endDate} format="short" />
            </div>
          </div>
        ),
      }),
      col.display({
        id: "value",
        header: "Value",
        cell: ({ row: { original: c } }) => (
          <MoneyDisplay value={c.value} currency="USD" />
        ),
      }),
      col.accessor("signedAt" as any, {
        id: "signedAt",
        header: "Signed",
        enableSorting: true,
        cell: ({ row: { original: c } }) =>
          c.signedAt ? (
            <DateDisplay date={c.signedAt} format="short" />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      }),
      col.display({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row: { original: c } }) => (
          <div className="flex items-center justify-end gap-1.5">
            <PermissionGate one="crm.contracts.update">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal({ kind: "edit", contract: c })}
                disabled={!canUpdate}
                className="h-8 px-2"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </PermissionGate>
            <PermissionGate one="crm.contracts.delete">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal({ kind: "delete", contract: c })}
                disabled={!canDelete}
                className="h-8 px-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </PermissionGate>
          </div>
        ),
      }),
    ];
  }, [canUpdate, canDelete]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "CRM" }, { label: "Contracts" }]}
        title="Contracts"
        description="Manage customer contracts, terms, and lifecycle from draft to expiration."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw
                className={cn("w-4 h-4", isFetching && "animate-spin")}
              />
              Refresh
            </Button>
            <PermissionGate one="crm.contracts.create">
              <Button size="sm" onClick={onOpenCreate} disabled={!canCreate}>
                <Plus className="w-4 h-4" /> Create Contract
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <TableToolbar
        searchTerm={filters.search ?? ""}
        onSearchChange={(v) => pushParams({ search: v })}
        searchPlaceholder="Search by contract title, code, or customer…"
        onCreateNew={canCreate ? onOpenCreate : undefined}
        disableCreateNew={!canCreate}
        startContent={
          <>
            <GlobalSelect
              value={filters.status ?? ""}
              onChange={(v) => pushParams({ status: v })}
              options={statusFilterOptions}
              placeholder="Status"
              className="w-40"
            />
            <GlobalSelect
              value={filters.customerId ?? ""}
              onChange={(v) => pushParams({ customerId: v })}
              options={customerFilterOptions}
              placeholder="Customer"
              className="w-48"
            />
          </>
        }
      />

      <GlobalTable<ContractItem>
        columns={columns}
        data={contracts}
        meta={meta as any}
        serverSide
        pageSizeDefault={25}
        defaultSortBy="createdAt"
        defaultSortOrder="desc"
        queryResult={{
          data: contractsRes?.data as any,
          isFetching,
        }}
        getRowId={(c) => c.id}
        emptyIcon={<FileText className="w-10 h-10" />}
        emptyTitle="No contracts found"
        emptyDescription="No contracts match the current filters."
        emptyAction={
          <PermissionGate one="crm.contracts.create">
            <Button size="sm" onClick={onOpenCreate}>
              <Plus className="w-4 h-4" /> Create Contract
            </Button>
          </PermissionGate>
        }
        errorOnRetry={() => refetch()}
      />

      <GlobalModal
        open={modal.kind === "create"}
        onOpenChange={(o) => !o && closeModal()}
        title="Create new contract"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="createContractForm"
              disabled={createState.isLoading || !canCreate}
            >
              {createState.isLoading ? "Creating…" : "Create contract"}
            </Button>
          </div>
        }
      >
        <form
          id="createContractForm"
          onSubmit={form.handleSubmit(onSubmitCreate)}
          className="space-y-4"
          noValidate
        >
          <GlobalInput
            label="Contract title"
            required
            error={form.formState.errors.title?.message}
            {...form.register("title")}
          />
          <GlobalSelect
            label="Customer"
            required
            value={form.watch("customerId")}
            onChange={(v) =>
              form.setValue("customerId", v, { shouldValidate: true })
            }
            options={customerOptions}
            placeholder="Select customer…"
            error={form.formState.errors.customerId?.message as any}
          />
          <div className="grid grid-cols-2 gap-4">
            <GlobalSelect
              label="Status"
              required
              value={form.watch("status")}
              onChange={(v) =>
                form.setValue("status", v as any, { shouldValidate: true })
              }
              options={statusFormOptions}
              placeholder="Select status…"
              error={form.formState.errors.status?.message}
            />
            <GlobalInput
              label="Contract value ($)"
              inputType="number"
              error={form.formState.errors.value?.message}
              {...form.register("value")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalDatePicker
              label="Start date"
              required
              value={form.watch("startDate") || null}
              onChange={(v) =>
                form.setValue("startDate", v ?? "", { shouldValidate: true })
              }
              placeholder="Pick a date"
              error={form.formState.errors.startDate?.message as any}
            />
            <GlobalDatePicker
              label="End date"
              required
              value={form.watch("endDate") || null}
              onChange={(v) =>
                form.setValue("endDate", v ?? "", { shouldValidate: true })
              }
              placeholder="Pick a date"
              error={form.formState.errors.endDate?.message as any}
            />
          </div>
          <GlobalDatePicker
            label="Signed date (optional)"
            value={form.watch("signedAt") || null}
            onChange={(v) =>
              form.setValue("signedAt", v ?? undefined, {
                shouldValidate: true,
              })
            }
            placeholder="Pick a date"
            error={form.formState.errors.signedAt?.message as any}
          />
          <div>
            <label className="block text-sm font-medium text-foreground">
              Notes
            </label>
            <textarea
              className="mt-1.5 w-full min-h-[80px] rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Any additional notes about this contract…"
              maxLength={2000}
              {...form.register("notes")}
            />
            {form.formState.errors.notes?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {form.formState.errors.notes.message}
              </p>
            )}
          </div>
          {createState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (createState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to create contract."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <GlobalModal
        open={modal.kind === "edit"}
        onOpenChange={(o) => !o && closeModal()}
        title="Edit contract"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="editContractForm"
              disabled={updateState.isLoading || !canUpdate}
            >
              {updateState.isLoading ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      >
        <form
          id="editContractForm"
          onSubmit={form.handleSubmit(onSubmitEdit)}
          className="space-y-4"
          noValidate
        >
          <GlobalInput
            label="Contract title"
            required
            error={form.formState.errors.title?.message}
            {...form.register("title")}
          />
          <GlobalSelect
            label="Customer"
            required
            value={form.watch("customerId")}
            onChange={(v) =>
              form.setValue("customerId", v, { shouldValidate: true })
            }
            options={customerOptions}
            placeholder="Select customer…"
            error={form.formState.errors.customerId?.message as any}
          />
          <div className="grid grid-cols-2 gap-4">
            <GlobalSelect
              label="Status"
              required
              value={form.watch("status")}
              onChange={(v) =>
                form.setValue("status", v as any, { shouldValidate: true })
              }
              options={statusFormOptions}
              placeholder="Select status…"
              error={form.formState.errors.status?.message}
            />
            <GlobalInput
              label="Contract value ($)"
              inputType="number"
              error={form.formState.errors.value?.message}
              {...form.register("value")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalDatePicker
              label="Start date"
              required
              value={form.watch("startDate") || null}
              onChange={(v) =>
                form.setValue("startDate", v ?? "", { shouldValidate: true })
              }
              placeholder="Pick a date"
              error={form.formState.errors.startDate?.message as any}
            />
            <GlobalDatePicker
              label="End date"
              required
              value={form.watch("endDate") || null}
              onChange={(v) =>
                form.setValue("endDate", v ?? "", { shouldValidate: true })
              }
              placeholder="Pick a date"
              error={form.formState.errors.endDate?.message as any}
            />
          </div>
          <GlobalDatePicker
            label="Signed date (optional)"
            value={form.watch("signedAt") || null}
            onChange={(v) =>
              form.setValue("signedAt", v ?? undefined, {
                shouldValidate: true,
              })
            }
            placeholder="Pick a date"
            error={form.formState.errors.signedAt?.message as any}
          />
          <div>
            <label className="block text-sm font-medium text-foreground">
              Notes
            </label>
            <textarea
              className="mt-1.5 w-full min-h-[80px] rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Any additional notes about this contract…"
              maxLength={2000}
              {...form.register("notes")}
            />
            {form.formState.errors.notes?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {form.formState.errors.notes.message}
              </p>
            )}
          </div>
          {updateState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (updateState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to update contract."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <ConfirmDialog
        open={modal.kind === "delete"}
        onOpenChange={(o) => !o && closeModal()}
        title="Delete contract"
        variant="destructive"
        description={
          modal.kind === "delete"
            ? `Deleting "${modal.contract.title}" is permanent and cannot be undone.`
            : ""
        }
        confirmText={deleteState.isLoading ? "Deleting…" : "Delete contract"}
        loading={deleteState.isLoading}
        icon={<Trash2 className="w-5 h-5" />}
        onConfirm={handleDelete}
      />
    </div>
  );
}
