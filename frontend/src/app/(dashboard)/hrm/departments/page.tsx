"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as Switch from "@radix-ui/react-switch";
import {
  Building2,
  Pencil,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useCreateDepartmentMutation,
  useDeleteDepartmentMutation,
  useListDepartmentsQuery,
  useListEmployeesQuery,
  useUpdateDepartmentMutation,
} from "@/lib/api/hrmEndpoints";
import type { DepartmentItem } from "@/lib/api/hrmEndpoints";
import { useListUsersQuery } from "@/lib/api/adminEndpoints";
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

const departmentFormSchema = z.object({
  code: z.string().trim().min(1, "Required").max(50),
  name: z.string().trim().min(1, "Required").max(255),
  managerId: z.string().max(50).optional().or(z.literal("")),
  location: z.string().trim().max(255).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});
type DepartmentFormValues = z.infer<typeof departmentFormSchema>;

function DepartmentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canCreate = useHasPermission({ one: "hrm.departments.create" });
  const canUpdate = useHasPermission({ one: "hrm.departments.update" });
  const canDelete = useHasPermission({ one: "hrm.departments.delete" });

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
      sortBy: searchParams?.get("sortBy") ?? "createdAt",
      sortOrder: (searchParams?.get("sortOrder") as "asc" | "desc") ?? "desc",
    };
  }, [searchParams]);

  const {
    data: deptsRes,
    isFetching,
    refetch,
  } = useListDepartmentsQuery(filters, { refetchOnMountOrArgChange: true });
  const { data: employeesRes } = useListEmployeesQuery({
    page: 1,
    pageSize: 10000,
  });
  const { data: usersRes } = useListUsersQuery({
    page: 1,
    pageSize: 10000,
    status: "ACTIVE",
  });

  const departments =
    (deptsRes as any)?.data?.items ?? (deptsRes as any)?.items ?? [];
  const meta = (deptsRes as any)?.data?.meta ?? (deptsRes as any)?.meta;
  const employees =
    (employeesRes as any)?.data?.items ?? (employeesRes as any)?.items ?? [];
  const users = (usersRes as any)?.data?.items ?? (usersRes as any)?.items ?? [];

  const employeeCountByDept = useMemo(() => {
    const m = new Map<string, number>();
    employees.forEach((e: any) => {
      if (e.departmentId) {
        m.set(e.departmentId, (m.get(e.departmentId) ?? 0) + 1);
      }
    });
    return m;
  }, [employees]);

  const managerById = useMemo(() => {
    const m = new Map<string, any>();
    users.forEach((u: any) => m.set(u.id, u));
    return m;
  }, [users]);

  const managerOptions = useMemo(
    () => [
      { value: "", label: "No manager" },
      ...users.map((u: any) => ({
        value: u.id,
        label: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email,
      })),
    ],
    [users]
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
    | { kind: "edit"; department: DepartmentItem }
    | { kind: "delete"; department: DepartmentItem };
  const [modal, setModal] = useState<ModalState>({ kind: "none" });

  const [createTrigger, createState] = useCreateDepartmentMutation();
  const [updateTrigger, updateState] = useUpdateDepartmentMutation();
  const [deleteTrigger, deleteState] = useDeleteDepartmentMutation();

  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      code: "",
      name: "",
      managerId: "",
      location: "",
      isActive: true,
    },
    mode: "onTouched",
  });

  useEffect(() => {
    if (modal.kind === "edit") {
      form.reset({
        code: modal.department.code,
        name: modal.department.name,
        managerId: modal.department.managerId ?? "",
        location: modal.department.location ?? "",
        isActive: modal.department.isActive,
      });
    } else if (modal.kind === "create") {
      form.reset({
        code: "",
        name: "",
        managerId: "",
        location: "",
        isActive: true,
      });
    }
  }, [modal, form]);

  const closeModal = () => {
    setModal({ kind: "none" });
    form.reset();
  };

  const onSubmitCreate = async (v: DepartmentFormValues) => {
    const out = await createTrigger({
      code: v.code,
      name: v.name,
      managerId: v.managerId || undefined,
      location: v.location || undefined,
      isActive: v.isActive,
    });
    if ("data" in out && (out.data as any)?.success) {
      closeModal();
    }
  };

  const onSubmitEdit = async (v: DepartmentFormValues) => {
    if (modal.kind !== "edit") return;
    const out = await updateTrigger({
      id: modal.department.id,
      body: {
        code: v.code,
        name: v.name,
        managerId: v.managerId || undefined,
        location: v.location || undefined,
        isActive: v.isActive,
      },
    });
    if ("data" in out && (out.data as any)?.success) {
      closeModal();
    }
  };

  const handleDelete = async () => {
    if (modal.kind !== "delete") return;
    await deleteTrigger(modal.department.id);
    setModal({ kind: "none" });
  };

  const columns: ColumnDef<TableFeatures, DepartmentItem, any>[] = useMemo(
    () => {
      const col = createColumns<DepartmentItem>();
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
              <div className="h-8 w-8 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-200 dark:border-sky-900/60">
                <Building2 className="w-4 h-4" />
              </div>
              <span className="font-medium text-foreground">{d.name}</span>
            </div>
          ),
        }),
        col.display({
          id: "manager",
          header: "Manager",
          cell: ({ row: { original: d } }) => {
            const m = d.manager ?? managerById.get(d.managerId ?? "");
            if (!m)
              return (
                <span className="text-xs text-muted-foreground">—</span>
              );
            return (
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 flex items-center justify-center text-[10px] font-semibold">
                  {`${m.firstName?.[0] ?? ""}${m.lastName?.[0] ?? ""}`.toUpperCase() ||
                    "U"}
                </div>
                <span className="text-xs text-foreground truncate max-w-[14ch]">
                  {m.firstName ?? ""} {m.lastName?.[0] ?? ""}.
                </span>
              </div>
            );
          },
        }),
        col.display({
          id: "employees",
          header: "Employees",
          cell: ({ row: { original: d } }) => {
            const count = employeeCountByDept.get(d.id) ?? 0;
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
              <PermissionGate one="hrm.departments.update">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModal({ kind: "edit", department: d })}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
              </PermissionGate>
              <PermissionGate one="hrm.departments.delete">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModal({ kind: "delete", department: d })}
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
    [employeeCountByDept, managerById]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "HRM" }, { label: "Departments" }]}
        title="Departments"
        description="Manage organizational departments and their managers."
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
            <PermissionGate one="hrm.departments.create">
              <Button
                size="sm"
                onClick={() => setModal({ kind: "create" })}
              >
                <Plus className="w-4 h-4" /> New department
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <TableToolbar
        searchTerm={filters.search ?? ""}
        onSearchChange={(v) => pushParams({ search: v })}
        searchPlaceholder="Search departments…"
        onCreateNew={canCreate ? () => setModal({ kind: "create" }) : undefined}
        createNewLabel="New department"
        disableCreateNew={!canCreate}
        startContent={
          <>
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

      <GlobalTable<DepartmentItem>
        columns={columns}
        data={departments}
        meta={meta}
        serverSide
        pageSizeDefault={25}
        defaultSortBy="createdAt"
        defaultSortOrder="desc"
        queryResult={{
          data: (deptsRes as any)?.data ?? deptsRes,
          isFetching,
        }}
        getRowId={(d) => d.id}
        emptyIcon={<Building2 className="w-10 h-10" />}
        emptyTitle="No departments found"
        emptyDescription="No departments match the current filters."
        emptyAction={
          <PermissionGate one="hrm.departments.create">
            <Button size="sm" onClick={() => setModal({ kind: "create" })}>
              <Plus className="w-4 h-4" /> New department
            </Button>
          </PermissionGate>
        }
        errorOnRetry={() => refetch()}
      />

      <GlobalModal
        open={modal.kind === "create"}
        onOpenChange={(o) => !o && closeModal()}
        title="Create new department"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-dept-form"
              disabled={createState.isLoading || !canCreate}
            >
              {createState.isLoading ? "Creating…" : "Create department"}
            </Button>
          </div>
        }
      >
        <form
          id="create-dept-form"
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
            label="Manager"
            value={form.watch("managerId")}
            onChange={(v) =>
              form.setValue("managerId", v, { shouldValidate: true })
            }
            options={managerOptions}
            placeholder="Select a manager…"
            error={form.formState.errors.managerId?.message}
          />
          <GlobalInput
            label="Location"
            error={form.formState.errors.location?.message}
            {...form.register("location")}
          />
          <div className="flex items-center justify-between rounded-lg border border-border bg-slate-50/60 dark:bg-slate-900/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Active</p>
              <p className="text-xs text-muted-foreground">
                Mark this department as active
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
                }).data?.error?.message ?? "Failed to create department."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <GlobalModal
        open={modal.kind === "edit"}
        onOpenChange={(o) => !o && closeModal()}
        title="Edit department"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="edit-dept-form"
              disabled={updateState.isLoading || !canUpdate}
            >
              {updateState.isLoading ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      >
        <form
          id="edit-dept-form"
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
            label="Manager"
            value={form.watch("managerId")}
            onChange={(v) =>
              form.setValue("managerId", v, { shouldValidate: true })
            }
            options={managerOptions}
            placeholder="Select a manager…"
            error={form.formState.errors.managerId?.message}
          />
          <GlobalInput
            label="Location"
            error={form.formState.errors.location?.message}
            {...form.register("location")}
          />
          <div className="flex items-center justify-between rounded-lg border border-border bg-slate-50/60 dark:bg-slate-900/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Active</p>
              <p className="text-xs text-muted-foreground">
                Mark this department as active
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
                }).data?.error?.message ?? "Failed to update department."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <ConfirmDialog
        open={modal.kind === "delete"}
        onOpenChange={(o) => !o && closeModal()}
        title="Delete department"
        variant="destructive"
        description={
          modal.kind === "delete"
            ? `Are you sure you want to delete "${modal.department.name}"? This action cannot be undone.`
            : ""
        }
        confirmText={deleteState.isLoading ? "Deleting…" : "Delete department"}
        loading={deleteState.isLoading}
        onConfirm={handleDelete}
      />
    </div>
  );
}

import { Suspense } from "react";
export default function DepartmentsPage() {
  return (
    <Suspense fallback={<div>Loading departments...</div>}>
      <DepartmentsPageContent />
    </Suspense>
  );
}
