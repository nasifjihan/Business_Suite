"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as Switch from "@radix-ui/react-switch";
import {
  BadgeCheck,
  Pencil,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useCreateDesignationMutation,
  useDeleteDesignationMutation,
  useListDepartmentsQuery,
  useListDesignationsQuery,
  useListEmployeesQuery,
  useUpdateDesignationMutation,
} from "@/lib/api/hrmEndpoints";
import type { DesignationItem } from "@/lib/api/hrmEndpoints";
import { cn } from "@/lib/utils";
import {
  PermissionGate,
  useHasPermission,
} from "@/components/auth/PermissionGate";
import { PageHeader } from "@/components/common/PageHeader";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { GlobalTable } from "@/components/tables/GlobalTable";
import { GlobalModal } from "@/components/feedback/GlobalModal";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { GlobalInput } from "@/components/form/GlobalInput";
import { GlobalSelect } from "@/components/form/GlobalSelect";
import { StatusBadge } from "@/components/common/StatusBadge";
import { createColumns, type TableFeatures } from "@/lib/table-utils";
import type { ColumnDef } from "@tanstack/react-table";

const designationFormSchema = z.object({
  code: z.string().trim().min(1, "Required").max(50),
  name: z.string().trim().min(1, "Required").max(255),
  departmentId: z.string().min(1, "Department is required"),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});
type DesignationFormValues = z.infer<typeof designationFormSchema>;

function DesignationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canCreate = useHasPermission({ one: "hrm.designations.create" });
  const canUpdate = useHasPermission({ one: "hrm.designations.update" });
  const canDelete = useHasPermission({ one: "hrm.designations.delete" });

  const filters = useMemo(() => {
    const page = parseInt(searchParams?.get("page") ?? "1", 10) || 1;
    const pageSize = parseInt(searchParams?.get("pageSize") ?? "25", 10) || 25;
    return {
      page,
      pageSize,
      search: searchParams?.get("search") ?? "",
      isActive: searchParams?.has("isActive")
        ? searchParams.get("isActive") === "true"
        : undefined,
      departmentId: searchParams?.get("departmentId") || undefined,
      sortBy: searchParams?.get("sortBy") ?? "createdAt",
      sortOrder: (searchParams?.get("sortOrder") as "asc" | "desc") ?? "desc",
    };
  }, [searchParams]);

  const {
    data: desigsRes,
    isFetching,
    refetch,
  } = useListDesignationsQuery(filters, { refetchOnMountOrArgChange: true });
  const { data: deptsRes } = useListDepartmentsQuery({
    page: 1,
    pageSize: 100,
    isActive: true,
  });
  const { data: employeesRes } = useListEmployeesQuery({
    page: 1,
    pageSize: 100,
  });

  const designations =
    (desigsRes as any)?.data?.items ?? (desigsRes as any)?.items ?? [];
  const meta = (desigsRes as any)?.data?.meta ?? (desigsRes as any)?.meta;
  const departments =
    (deptsRes as any)?.data?.items ?? (deptsRes as any)?.items ?? [];
  const employees =
    (employeesRes as any)?.data?.items ?? (employeesRes as any)?.items ?? [];

  const deptById = useMemo(() => {
    const m = new Map<string, any>();
    departments.forEach((d: any) => m.set(d.id, d));
    return m;
  }, [departments]);

  const employeeCountByDesig = useMemo(() => {
    const m = new Map<string, number>();
    employees.forEach((e: any) => {
      if (e.designationId) {
        m.set(e.designationId, (m.get(e.designationId) ?? 0) + 1);
      }
    });
    return m;
  }, [employees]);

  const deptOptions = useMemo(
    () =>
      departments.map((d: any) => ({
        value: d.id,
        label: d.name,
      })),
    [departments]
  );

  const deptFilterOptions = useMemo(
    () => [{ value: "", label: "All departments" }, ...deptOptions],
    [deptOptions]
  );

  const statusOptions = useMemo(
    () => [
      { value: "", label: "All statuses" },
      { value: "true", label: "Active" },
      { value: "false", label: "Inactive" },
    ],
    []
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
    | { kind: "edit"; designation: DesignationItem }
    | { kind: "delete"; designation: DesignationItem };
  const [modal, setModal] = useState<ModalState>({ kind: "none" });

  const [createTrigger, createState] = useCreateDesignationMutation();
  const [updateTrigger, updateState] = useUpdateDesignationMutation();
  const [deleteTrigger, deleteState] = useDeleteDesignationMutation();

  const form = useForm<DesignationFormValues>({
    resolver: zodResolver(designationFormSchema),
    defaultValues: {
      code: "",
      name: "",
      departmentId: "",
      description: "",
      isActive: true,
    },
    mode: "onTouched",
  });

  const firstDeptId = departments[0]?.id ?? "";
  useEffect(() => {
    if (modal.kind === "edit") {
      form.reset({
        code: modal.designation.code,
        name: modal.designation.name,
        departmentId: modal.designation.departmentId,
        description: modal.designation.description ?? "",
        isActive: modal.designation.isActive,
      });
    } else if (modal.kind === "create") {
      form.reset({
        code: "",
        name: "",
        departmentId: firstDeptId,
        description: "",
        isActive: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal.kind, modal.kind === "edit" ? modal.designation.id : "__create__", firstDeptId]);

  const closeModal = () => {
    setModal({ kind: "none" });
    form.reset();
  };

  const onSubmitCreate = async (v: DesignationFormValues) => {
    const out = await createTrigger({
      code: v.code,
      name: v.name,
      departmentId: v.departmentId,
      description: v.description || undefined,
      isActive: v.isActive,
    });
    if ("data" in out && (out.data as any)?.success) {
      closeModal();
    }
  };

  const onSubmitEdit = async (v: DesignationFormValues) => {
    if (modal.kind !== "edit") return;
    const out = await updateTrigger({
      id: modal.designation.id,
      body: {
        code: v.code,
        name: v.name,
        departmentId: v.departmentId,
        description: v.description || undefined,
        isActive: v.isActive,
      },
    });
    if ("data" in out && (out.data as any)?.success) {
      closeModal();
    }
  };

  const handleDelete = async () => {
    if (modal.kind !== "delete") return;
    await deleteTrigger(modal.designation.id);
    setModal({ kind: "none" });
  };

  const columns: ColumnDef<TableFeatures, DesignationItem, any>[] = useMemo(
    () => {
      const col = createColumns<DesignationItem>();
      return [
        col.accessor("code" as any, {
          id: "code",
          header: "Code",
          enableSorting: true,
          cell: ({ row: { original: d } }) => (
            <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
              {d.code}
            </span>
          ),
        }),
        col.accessor("name" as any, {
          id: "name",
          header: "Name",
          enableSorting: true,
          cell: ({ row: { original: d } }) => (
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-200 dark:border-teal-900/60">
                <BadgeCheck className="w-4 h-4" />
              </div>
              <span className="font-medium text-foreground">{d.name}</span>
            </div>
          ),
        }),
        col.display({
          id: "department",
          header: "Department",
          cell: ({ row: { original: d } }) => {
            const dept = d.department ?? deptById.get(d.departmentId);
            return dept ? (
              <StatusBadge
                tone="sky"
                size="sm"
                label={dept.name}
              />
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            );
          },
        }),
        col.display({
          id: "employees",
          header: "Employees",
          cell: ({ row: { original: d } }) => {
            const count = employeeCountByDesig.get(d.id) ?? 0;
            return (
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm font-medium text-foreground">
                  {count}
                </span>
              </div>
            );
          },
        }),
        col.display({
          id: "isActive",
          header: "Status",
          cell: ({ row: { original: d } }) => (
            <StatusBadge
              tone={d.isActive ? "emerald" : "slate"}
              size="md"
              dot={d.isActive}
              label={d.isActive ? "ACTIVE" : "INACTIVE"}
            />
          ),
        }),
        col.display({
          id: "actions",
          header: "",
          enableSorting: false,
          cell: ({ row: { original: d } }) => (
            <div className="flex items-center justify-end gap-1.5">
              <PermissionGate one="hrm.designations.update">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setModal({ kind: "edit", designation: d })
                  }
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
              </PermissionGate>
              <PermissionGate one="hrm.designations.delete">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setModal({ kind: "delete", designation: d })
                  }
                  className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900"
                >
                  Delete
                </Button>
              </PermissionGate>
            </div>
          ),
        }),
      ];
    },
    [deptById, employeeCountByDesig]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "HRM" }, { label: "Designations" }]}
        title="Designations"
        description="Manage job titles and their departments."
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
            <PermissionGate one="hrm.designations.create">
              <Button
                size="sm"
                onClick={() => setModal({ kind: "create" })}
              >
                <Plus className="w-4 h-4" /> New designation
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <TableToolbar
        searchTerm={filters.search ?? ""}
        onSearchChange={(v) => pushParams({ search: v })}
        searchPlaceholder="Search designations…"
        onCreateNew={canCreate ? () => setModal({ kind: "create" }) : undefined}
        createNewLabel="New designation"
        disableCreateNew={!canCreate}
        startContent={
          <>
            <GlobalSelect
              value={filters.departmentId ?? ""}
              onChange={(v) => pushParams({ departmentId: v })}
              options={deptFilterOptions}
              placeholder="Department"
              className="w-48"
            />
            <GlobalSelect
              value={
                filters.isActive === undefined
                  ? ""
                  : String(filters.isActive)
              }
              onChange={(v) =>
                pushParams({ isActive: v === "" ? undefined : v })
              }
              options={statusOptions}
              placeholder="Status"
              className="w-40"
            />
          </>
        }
      />

      <GlobalTable<DesignationItem>
        columns={columns}
        data={designations}
        meta={meta}
        serverSide
        pageSizeDefault={25}
        defaultSortBy="createdAt"
        defaultSortOrder="desc"
        queryResult={{
          data: desigsRes as any,
          isFetching,
        }}
        getRowId={(d) => d.id}
        emptyIcon={<BadgeCheck className="w-10 h-10" />}
        emptyTitle="No designations found"
        emptyDescription="No designations match the current filters."
        emptyAction={
          <PermissionGate one="hrm.designations.create">
            <Button size="sm" onClick={() => setModal({ kind: "create" })}>
              <Plus className="w-4 h-4" /> New designation
            </Button>
          </PermissionGate>
        }
        errorOnRetry={() => refetch()}
      />

      <GlobalModal
        open={modal.kind === "create"}
        onOpenChange={(o) => !o && closeModal()}
        title="Create new designation"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-desig-form"
              disabled={createState.isLoading || !canCreate}
            >
              {createState.isLoading ? "Creating…" : "Create designation"}
            </Button>
          </div>
        }
      >
        <form
          id="create-desig-form"
          onSubmit={form.handleSubmit(onSubmitCreate)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Code"
              required
              error={form.formState.errors.code?.message}
              {...form.register("code")}
            />
            <GlobalInput
              label="Name"
              required
              error={form.formState.errors.name?.message}
              {...form.register("name")}
            />
          </div>
          <GlobalSelect
            label="Department"
            required
            value={form.watch("departmentId")}
            onChange={(v) =>
              form.setValue("departmentId", v, { shouldValidate: true })
            }
            options={deptOptions}
            placeholder="Select a department…"
            error={form.formState.errors.departmentId?.message}
          />
          <div>
            <label className="block text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              className="mt-1.5 w-full min-h-[80px] rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Brief description of this designation…"
              maxLength={2000}
              {...form.register("description")}
            />
            {form.formState.errors.description?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-slate-50/60 dark:bg-slate-900/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Active</p>
              <p className="text-xs text-muted-foreground">
                Mark this designation as active
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
                }).data?.error?.message ?? "Failed to create designation."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <GlobalModal
        open={modal.kind === "edit"}
        onOpenChange={(o) => !o && closeModal()}
        title="Edit designation"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="edit-desig-form"
              disabled={updateState.isLoading || !canUpdate}
            >
              {updateState.isLoading ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      >
        <form
          id="edit-desig-form"
          onSubmit={form.handleSubmit(onSubmitEdit)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Code"
              required
              error={form.formState.errors.code?.message}
              {...form.register("code")}
            />
            <GlobalInput
              label="Name"
              required
              error={form.formState.errors.name?.message}
              {...form.register("name")}
            />
          </div>
          <GlobalSelect
            label="Department"
            required
            value={form.watch("departmentId")}
            onChange={(v) =>
              form.setValue("departmentId", v, { shouldValidate: true })
            }
            options={deptOptions}
            placeholder="Select a department…"
            error={form.formState.errors.departmentId?.message}
          />
          <div>
            <label className="block text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              className="mt-1.5 w-full min-h-[80px] rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Brief description of this designation…"
              maxLength={2000}
              {...form.register("description")}
            />
            {form.formState.errors.description?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-slate-50/60 dark:bg-slate-900/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Active</p>
              <p className="text-xs text-muted-foreground">
                Mark this designation as active
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
                }).data?.error?.message ?? "Failed to update designation."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <ConfirmDialog
        open={modal.kind === "delete"}
        onOpenChange={(o) => !o && closeModal()}
        title="Delete designation"
        variant="destructive"
        description={
          modal.kind === "delete"
            ? `Are you sure you want to delete "${modal.designation.name}"? This action cannot be undone.`
            : ""
        }
        confirmText={deleteState.isLoading ? "Deleting…" : "Delete designation"}
        loading={deleteState.isLoading}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default function DesignationsPage() {
  return (
    <Suspense fallback={<div>Loading designations...</div>}>
      <DesignationsPageContent />
    </Suspense>
  );
}
