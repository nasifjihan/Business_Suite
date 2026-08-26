"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  UserPlus,
  Users,
  Pencil,
  Trash2,
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
import { StatusBadge } from "@/components/common/StatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { MoneyDisplay } from "@/components/common/MoneyDisplay";
import { PermissionGate, useHasPermission } from "@/components/auth/PermissionGate";
import { createColumns, type TableFeatures } from "@/lib/table-utils";
import type { ColumnDef } from "@tanstack/react-table";
import {
  useListCustomersQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
} from "@/lib/api/crmEndpoints";
import type {
  CustomerItem,
  ListCustomersArgs,
  CustomerStatus,
  LeadSource,
  CreateCustomerRequest,
} from "@/lib/api/crmEndpoints";

const extract = <T,>(resp?: { success: true; data: { items: T[]; meta: unknown } }) =>
  resp?.data ?? { items: [] as T[], meta: undefined };

const CUSTOMER_STATUS_TONE: Record<CustomerStatus, "emerald" | "rose" | "slate"> = {
  ACTIVE: "emerald",
  INACTIVE: "slate",
  CHURNED: "rose",
};

const LEAD_SOURCE_TONE: Record<LeadSource, "sky" | "violet" | "teal" | "slate"> = {
  WEBSITE: "sky",
  REFERRAL: "violet",
  SOCIAL: "teal",
  PHONE: "slate",
  EMAIL: "sky",
  OTHER: "slate",
};

const customerFormSchema = z.object({
  name: z.string().trim().min(1, "Required").max(255),
  companyName: z.string().trim().max(255).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  country: z.string().trim().max(100).optional().or(z.literal("")),
  postalCode: z.string().trim().max(20).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  source: z.enum(["WEBSITE", "REFERRAL", "SOCIAL", "PHONE", "EMAIL", "OTHER"] as const).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "CHURNED"] as const).optional(),
});
type CustomerFormValues = z.infer<typeof customerFormSchema>;

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "CHURNED", label: "Churned" },
];

const sourceOptions = [
  { value: "", label: "All sources" },
  { value: "WEBSITE", label: "Website" },
  { value: "REFERRAL", label: "Referral" },
  { value: "SOCIAL", label: "Social Media" },
  { value: "PHONE", label: "Phone" },
  { value: "EMAIL", label: "Email" },
  { value: "OTHER", label: "Other" },
];

const customerSourceOptions = sourceOptions.filter((o) => o.value !== "");
const customerStatusOptions = statusOptions.filter((o) => o.value !== "");

export default function CustomersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canCreate = useHasPermission({ one: "crm.customers.create" });
  const canUpdate = useHasPermission({ one: "crm.customers.update" });

  const filters: ListCustomersArgs = useMemo(() => {
    const page = parseInt(searchParams?.get("page") ?? "1", 10) || 1;
    const pageSize = parseInt(searchParams?.get("pageSize") ?? "25", 10) || 25;
    return {
      page,
      pageSize,
      search: searchParams?.get("search") ?? "",
      status: (searchParams?.get("status") as CustomerStatus | undefined) || undefined,
      source: (searchParams?.get("source") as LeadSource | undefined) || undefined,
      sortBy: searchParams?.get("sortBy") ?? "createdAt",
      sortOrder: (searchParams?.get("sortOrder") as "asc" | "desc") ?? "desc",
    };
  }, [searchParams]);

  const { data: customersRes, isFetching, refetch } = useListCustomersQuery(filters, {
    refetchOnMountOrArgChange: true,
  });

  const customers = extract(customersRes as any).items as CustomerItem[];
  const meta = extract(customersRes as any).meta;

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
    | { kind: "edit"; customer: CustomerItem }
    | { kind: "delete"; customer: CustomerItem };
  const [modal, setModal] = useState<ModalState>({ kind: "none" });

  const [createTrigger, createState] = useCreateCustomerMutation();
  const [updateTrigger, updateState] = useUpdateCustomerMutation();
  const [deleteTrigger, deleteState] = useDeleteCustomerMutation();

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      companyName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
      notes: "",
      source: "OTHER",
      status: "ACTIVE",
    },
    mode: "onTouched",
  });

  useEffect(() => {
    if (modal.kind === "edit") {
      form.reset({
        name: modal.customer.name,
        companyName: modal.customer.companyName ?? "",
        email: modal.customer.email ?? "",
        phone: modal.customer.phone ?? "",
        address: modal.customer.address ?? "",
        city: modal.customer.city ?? "",
        state: "",
        country: modal.customer.country ?? "",
        postalCode: "",
        notes: "",
        source: modal.customer.source,
        status: modal.customer.status,
      });
    } else if (modal.kind === "create") {
      form.reset({
        name: "",
        companyName: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        country: "",
        postalCode: "",
        notes: "",
        source: "OTHER",
        status: "ACTIVE",
      });
    }
  }, [modal, form]);

  const closeModal = () => {
    setModal({ kind: "none" });
    form.reset();
  };

  const onSubmitCreate = async (v: CustomerFormValues) => {
    const out = await createTrigger({
      ...v,
      email: v.email || undefined,
      phone: v.phone || undefined,
      companyName: v.companyName || undefined,
      address: v.address || undefined,
      city: v.city || undefined,
      state: v.state || undefined,
      country: v.country || undefined,
      postalCode: v.postalCode || undefined,
      notes: v.notes || undefined,
    });
    if ("data" in out && out.data?.success) {
      closeModal();
    }
  };

  const onSubmitEdit = async (v: CustomerFormValues) => {
    if (modal.kind !== "edit") return;
    const out = await updateTrigger({
      id: modal.customer.id,
      body: {
        ...v,
        email: v.email || undefined,
        phone: v.phone || undefined,
        companyName: v.companyName || undefined,
        address: v.address || undefined,
        city: v.city || undefined,
        state: v.state || undefined,
        country: v.country || undefined,
        postalCode: v.postalCode || undefined,
        notes: v.notes || undefined,
      },
    });
    if ("data" in out && out.data?.success) {
      closeModal();
    }
  };

  const handleDelete = async () => {
    if (modal.kind !== "delete") return;
    await deleteTrigger(modal.customer.id);
    setModal({ kind: "none" });
  };

  const onOpenCreate = () => setModal({ kind: "create" });

  const customerInitials = (c: CustomerItem) =>
    `${c.name?.[0] ?? ""}`.toUpperCase() || "C";

  const columns: ColumnDef<TableFeatures, CustomerItem, any>[] = useMemo(() => {
    const col = createColumns<CustomerItem>();

    return [
      col.display({
        id: "customerCode",
        header: "Code",
        enableSorting: true,
        cell: ({ row: { original: c } }) => (
          <span className="font-mono text-xs text-slate-600 dark:text-slate-400 truncate max-w-[10ch]">
            {c.customerCode}
          </span>
        ),
      }),
      col.display({
        id: "name",
        header: "Customer",
        cell: ({ row: { original: c } }) => (
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 h-9 w-9 shrink-0 flex items-center justify-center font-semibold text-sm border border-emerald-200 dark:border-emerald-900/60">
              {customerInitials(c)}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">{c.name}</p>
              {c.companyName && (
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  <Building2 className="w-3 h-3 inline" />
                  {c.companyName}
                </p>
              )}
              {c.email && !c.companyName && (
                <p className="text-xs text-muted-foreground truncate">{c.email}</p>
              )}
            </div>
          </div>
        ),
      }),
      col.display({
        id: "status",
        header: "Status",
        cell: ({ row: { original: c } }) => (
          <StatusBadge
            tone={CUSTOMER_STATUS_TONE[c.status]}
            size="md"
            dot={c.status === "ACTIVE"}
            label={c.status.charAt(0) + c.status.slice(1).toLowerCase()}
          />
        ),
      }),
      col.display({
        id: "source",
        header: "Source",
        cell: ({ row: { original: c } }) => (
          <StatusBadge
            tone={LEAD_SOURCE_TONE[c.source]}
            size="sm"
            label={
              c.source === "SOCIAL"
                ? "Social"
                : c.source.charAt(0) + c.source.slice(1).toLowerCase()
            }
          />
        ),
      }),
      col.display({
        id: "totalSpent",
        header: "Total spent",
        cell: ({ row: { original: c } }) => (
          <MoneyDisplay value={c.totalSpent} currency="USD" />
        ),
      }),
      col.accessor("createdAt" as any, {
        id: "createdAt",
        header: "Created",
        enableSorting: true,
        cell: ({ row: { original: c } }) => (
          <DateDisplay date={c.createdAt} format="short" />
        ),
      }),
      col.display({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row: { original: c } }) => (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/crm/customers/${c.id}`)}
              className="text-slate-600 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              View
            </Button>
            <PermissionGate one="crm.customers.update">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal({ kind: "edit", customer: c })}
                disabled={!canUpdate}
              >
                <Pencil className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
            </PermissionGate>
            <PermissionGate one="crm.customers.delete">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal({ kind: "delete", customer: c })}
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
        breadcrumbs={[{ label: "CRM" }, { label: "Customers" }]}
        title="Customers"
        description="Manage your customer relationships, contacts, and account details."
        action={
          <div className="flex items-center gap-2">
            <PermissionGate one="crm.customers.create">
              <Button size="sm" onClick={onOpenCreate} disabled={!canCreate}>
                <UserPlus className="w-4 h-4" /> New customer
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <TableToolbar
        searchTerm={filters.search ?? ""}
        onSearchChange={(v) => pushParams({ search: v })}
        searchPlaceholder="Search by name, email, or company…"
        onCreateNew={canCreate ? onOpenCreate : undefined}
        disableCreateNew={!canCreate}
        startContent={
          <>
            <GlobalSelect
              value={filters.status ?? ""}
              onChange={(v) => pushParams({ status: v })}
              options={statusOptions}
              placeholder="Status"
              className="w-40"
            />
            <GlobalSelect
              value={filters.source ?? ""}
              onChange={(v) => pushParams({ source: v })}
              options={sourceOptions}
              placeholder="Source"
              className="w-44"
            />
          </>
        }
      />

      <GlobalTable<CustomerItem>
        columns={columns}
        data={customers}
        meta={meta as any}
        serverSide
        pageSizeDefault={25}
        defaultSortBy="createdAt"
        defaultSortOrder="desc"
        queryResult={{
          data: customersRes?.data as any,
          isFetching,
        }}
        getRowId={(c) => c.id}
        onRowClick={(c) => router.push(`/crm/customers/${c.id}`)}
        emptyIcon={<Users className="w-10 h-10" />}
        emptyTitle="No customers found"
        emptyDescription="No customers match the current filters."
        emptyAction={
          <PermissionGate one="crm.customers.create">
            <Button size="sm" onClick={onOpenCreate}>
              <UserPlus className="w-4 h-4" /> New customer
            </Button>
          </PermissionGate>
        }
        errorOnRetry={() => refetch()}
      />

      <GlobalModal
        open={modal.kind === "create"}
        onOpenChange={(o) => !o && closeModal()}
        title="Create new customer"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="createCustomerForm"
              disabled={createState.isLoading || !canCreate}
            >
              {createState.isLoading ? "Creating…" : "Create customer"}
            </Button>
          </div>
        }
      >
        <form
          id="createCustomerForm"
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
              label="Company name"
              error={form.formState.errors.companyName?.message}
              {...form.register("companyName")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Email"
              inputType="email"
              error={form.formState.errors.email?.message}
              {...form.register("email")}
            />
            <GlobalInput
              label="Phone"
              error={form.formState.errors.phone?.message}
              {...form.register("phone")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalSelect
              label="Source"
              value={form.watch("source")}
              onChange={(v) => form.setValue("source", v as any, { shouldValidate: true })}
              options={customerSourceOptions}
              placeholder="Select source…"
              error={form.formState.errors.source?.message}
            />
            <GlobalSelect
              label="Status"
              value={form.watch("status")}
              onChange={(v) => form.setValue("status", v as any, { shouldValidate: true })}
              options={customerStatusOptions}
              placeholder="Select status…"
              error={form.formState.errors.status?.message}
            />
          </div>
          <GlobalInput
            label="Address"
            error={form.formState.errors.address?.message}
            {...form.register("address")}
          />
          <div className="grid grid-cols-3 gap-4">
            <GlobalInput
              label="City"
              error={form.formState.errors.city?.message}
              {...form.register("city")}
            />
            <GlobalInput
              label="State / Region"
              error={form.formState.errors.state?.message}
              {...form.register("state")}
            />
            <GlobalInput
              label="Postal code"
              error={form.formState.errors.postalCode?.message}
              {...form.register("postalCode")}
            />
          </div>
          <GlobalInput
            label="Country"
            error={form.formState.errors.country?.message}
            {...form.register("country")}
          />
          <div>
            <label className="block text-sm font-medium text-foreground">Notes</label>
            <textarea
              className="mt-1.5 w-full min-h-[80px] rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Any additional notes about this customer…"
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
                }).data?.error?.message ?? "Failed to create customer."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <GlobalModal
        open={modal.kind === "edit"}
        onOpenChange={(o) => !o && closeModal()}
        title="Edit customer"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="editCustomerForm"
              disabled={updateState.isLoading || !canUpdate}
            >
              {updateState.isLoading ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      >
        <form
          id="editCustomerForm"
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
              label="Company name"
              error={form.formState.errors.companyName?.message}
              {...form.register("companyName")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Email"
              inputType="email"
              error={form.formState.errors.email?.message}
              {...form.register("email")}
            />
            <GlobalInput
              label="Phone"
              error={form.formState.errors.phone?.message}
              {...form.register("phone")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalSelect
              label="Source"
              value={form.watch("source")}
              onChange={(v) => form.setValue("source", v as any, { shouldValidate: true })}
              options={customerSourceOptions}
              placeholder="Select source…"
              error={form.formState.errors.source?.message}
            />
            <GlobalSelect
              label="Status"
              value={form.watch("status")}
              onChange={(v) => form.setValue("status", v as any, { shouldValidate: true })}
              options={customerStatusOptions}
              placeholder="Select status…"
              error={form.formState.errors.status?.message}
            />
          </div>
          <GlobalInput
            label="Address"
            error={form.formState.errors.address?.message}
            {...form.register("address")}
          />
          <div className="grid grid-cols-3 gap-4">
            <GlobalInput
              label="City"
              error={form.formState.errors.city?.message}
              {...form.register("city")}
            />
            <GlobalInput
              label="State / Region"
              error={form.formState.errors.state?.message}
              {...form.register("state")}
            />
            <GlobalInput
              label="Postal code"
              error={form.formState.errors.postalCode?.message}
              {...form.register("postalCode")}
            />
          </div>
          <GlobalInput
            label="Country"
            error={form.formState.errors.country?.message}
            {...form.register("country")}
          />
          <div>
            <label className="block text-sm font-medium text-foreground">Notes</label>
            <textarea
              className="mt-1.5 w-full min-h-[80px] rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Any additional notes about this customer…"
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
                }).data?.error?.message ?? "Failed to update customer."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <ConfirmDialog
        open={modal.kind === "delete"}
        onOpenChange={(o) => !o && closeModal()}
        title="Delete customer"
        variant="destructive"
        description={
          modal.kind === "delete"
            ? `Deleting "${modal.customer.name}" is permanent and will remove all associated data including contacts, opportunities, and activities. This action cannot be undone.`
            : ""
        }
        confirmText={deleteState.isLoading ? "Deleting…" : "Delete customer"}
        loading={deleteState.isLoading}
        icon={<Trash2 className="w-5 h-5" />}
        onConfirm={handleDelete}
      />
    </div>
  );
}
