"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserRound,
  UserPlus,
  Briefcase,
  Phone,
  Mail,
  MapPin,
  HeartHandshake,
  CalendarDays,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useCreateEmployeeMutation,
  useDeleteEmployeeMutation,
  useListDepartmentsQuery,
  useListDesignationsQuery,
  useListEmployeesQuery,
  useUpdateEmployeeMutation,
} from "@/lib/api/hrmEndpoints";
import type {
  EmployeeItem,
  EmploymentStatus,
  EmploymentType,
} from "@/lib/api/hrmEndpoints";
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
import { GlobalDatePicker } from "@/components/form/GlobalDatePicker";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { createColumns, type TableFeatures } from "@/lib/table-utils";
import type { ColumnDef } from "@tanstack/react-table";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const employeeFormSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(50),
  lastName: z.string().trim().min(1, "Required").max(50),
  email: z.string().trim().regex(emailRegex, "Invalid email").max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  emergencyContactName: z.string().trim().max(100).optional().or(z.literal("")),
  emergencyContactPhone: z.string().trim().max(30).optional().or(z.literal("")),
  emergencyRelationship: z.string().trim().max(50).optional().or(z.literal("")),
  departmentId: z.string().min(1, "Department is required"),
  designationId: z.string().min(1, "Designation is required"),
  managerId: z.string().max(50).optional().or(z.literal("")),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"]),
  employmentStatus: z.enum([
    "ACTIVE",
    "INACTIVE",
    "ON_LEAVE",
    "TERMINATED",
    "SUSPENDED",
    "PROBATION",
  ]),
  joiningDate: z.string().min(1, "Joining date is required"),
  salary: z.coerce.number().min(0).optional(),
});
type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

const EMPLOYMENT_STATUS_TONE: Record<
  EmploymentStatus,
  "emerald" | "rose" | "slate" | "sky" | "violet" | "teal"
> = {
  ACTIVE: "emerald",
  PROBATION: "sky",
  ON_LEAVE: "violet",
  SUSPENDED: "teal",
  INACTIVE: "slate",
  TERMINATED: "rose",
};

const EMPLOYMENT_TYPE_TONE: Record<
  EmploymentType,
  "emerald" | "rose" | "slate" | "sky" | "violet" | "teal"
> = {
  FULL_TIME: "emerald",
  PART_TIME: "sky",
  CONTRACT: "violet",
  INTERN: "teal",
};

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 pb-2 mb-4 border-b border-border">
      <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-foreground leading-tight">{title}</h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function EmployeesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canCreate = useHasPermission({ one: "hrm.employees.create" });
  const canUpdate = useHasPermission({ one: "hrm.employees.update" });
  const canDelete = useHasPermission({ one: "hrm.employees.delete" });

  const filters = useMemo(() => {
    const page = parseInt(searchParams?.get("page") ?? "1", 10) || 1;
    const pageSize = parseInt(searchParams?.get("pageSize") ?? "25", 10) || 25;
    return {
      page,
      pageSize,
      search: searchParams?.get("search") ?? "",
      departmentId: searchParams?.get("departmentId") || undefined,
      designationId: searchParams?.get("designationId") || undefined,
      employmentStatus:
        (searchParams?.get("employmentStatus") as EmploymentStatus) ||
        undefined,
      employmentType:
        (searchParams?.get("employmentType") as EmploymentType) ||
        undefined,
      sortBy: searchParams?.get("sortBy") ?? "joiningDate",
      sortOrder: (searchParams?.get("sortOrder") as "asc" | "desc") ?? "desc",
    };
  }, [searchParams]);

  const {
    data: employeesRes,
    isFetching,
    refetch,
  } = useListEmployeesQuery(filters, { refetchOnMountOrArgChange: true });
  const { data: deptsRes } = useListDepartmentsQuery({
    page: 1,
    pageSize: 10000,
    isActive: true,
  });
  const { data: desigsRes } = useListDesignationsQuery({
    page: 1,
    pageSize: 10000,
    isActive: true,
  });
  const { data: allEmployeesRes } = useListEmployeesQuery({
    page: 1,
    pageSize: 10000,
  });

  const employees =
    (employeesRes as any)?.data?.items ?? (employeesRes as any)?.items ?? [];
  const meta = (employeesRes as any)?.data?.meta ?? (employeesRes as any)?.meta;
  const departments =
    (deptsRes as any)?.data?.items ?? (deptsRes as any)?.items ?? [];
  const designations =
    (desigsRes as any)?.data?.items ?? (desigsRes as any)?.items ?? [];
  const allEmployees =
    (allEmployeesRes as any)?.data?.items ??
    (allEmployeesRes as any)?.items ??
    [];

  const deptById = useMemo(() => {
    const m = new Map<string, any>();
    departments.forEach((d: any) => m.set(d.id, d));
    return m;
  }, [departments]);

  const desigById = useMemo(() => {
    const m = new Map<string, any>();
    designations.forEach((d: any) => m.set(d.id, d));
    return m;
  }, [designations]);

  const managerById = useMemo(() => {
    const m = new Map<string, any>();
    allEmployees.forEach((e: any) => m.set(e.id, e));
    return m;
  }, [allEmployees]);

  const deptOptions = useMemo(
    () =>
      departments.map((d: any) => ({
        value: d.id,
        label: d.name,
      })),
    [departments]
  );

  const desigOptions = useMemo(
    () =>
      designations.map((d: any) => ({
        value: d.id,
        label: d.name,
      })),
    [designations]
  );

  const managerOptions = useMemo(
    () => [
      { value: "", label: "No manager" },
      ...allEmployees.map((e: any) => ({
        value: e.id,
        label: `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim() || e.email,
      })),
    ],
    [allEmployees]
  );

  const deptFilterOptions = useMemo(
    () => [{ value: "", label: "All departments" }, ...deptOptions],
    [deptOptions]
  );

  const desigFilterOptions = useMemo(
    () => [{ value: "", label: "All designations" }, ...desigOptions],
    [desigOptions]
  );

  const employmentStatusOptions = useMemo(
    () => [
      { value: "", label: "All statuses" },
      { value: "ACTIVE", label: "Active" },
      { value: "PROBATION", label: "Probation" },
      { value: "ON_LEAVE", label: "On Leave" },
      { value: "SUSPENDED", label: "Suspended" },
      { value: "INACTIVE", label: "Inactive" },
      { value: "TERMINATED", label: "Terminated" },
    ],
    []
  );

  const employmentTypeOptions = useMemo(
    () => [
      { value: "", label: "All types" },
      { value: "FULL_TIME", label: "Full Time" },
      { value: "PART_TIME", label: "Part Time" },
      { value: "CONTRACT", label: "Contract" },
      { value: "INTERN", label: "Intern" },
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
    | { kind: "edit"; employee: EmployeeItem }
    | { kind: "delete"; employee: EmployeeItem };
  const [modal, setModal] = useState<ModalState>({ kind: "none" });

  const [createTrigger, createState] = useCreateEmployeeMutation();
  const [updateTrigger, updateState] = useUpdateEmployeeMutation();
  const [deleteTrigger, deleteState] = useDeleteEmployeeMutation();

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      dateOfBirth: "",
      address: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyRelationship: "",
      departmentId: "",
      designationId: "",
      managerId: "",
      employmentType: "FULL_TIME",
      employmentStatus: "ACTIVE",
      joiningDate: "",
      salary: 0,
    },
    mode: "onTouched",
  });

  useEffect(() => {
    if (modal.kind === "edit") {
      const e = modal.employee;
      form.reset({
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        phone: e.phone ?? "",
        dateOfBirth: e.dateOfBirth ?? "",
        address: e.address ?? "",
        emergencyContactName: e.emergencyContactName ?? "",
        emergencyContactPhone: e.emergencyContactPhone ?? "",
        emergencyRelationship: e.emergencyRelationship ?? "",
        departmentId: e.departmentId,
        designationId: e.designationId,
        managerId: e.managerId ?? "",
        employmentType: e.employmentType,
        employmentStatus: e.employmentStatus,
        joiningDate: e.joiningDate,
        salary: e.salary ? parseFloat(String(e.salary)) : 0,
      });
    } else if (modal.kind === "create") {
      form.reset({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        dateOfBirth: "",
        address: "",
        emergencyContactName: "",
        emergencyContactPhone: "",
        emergencyRelationship: "",
        departmentId: departments[0]?.id ?? "",
        designationId: designations[0]?.id ?? "",
        managerId: "",
        employmentType: "FULL_TIME",
        employmentStatus: "ACTIVE",
        joiningDate: "",
        salary: 0,
      });
    }
  }, [modal, form, departments, designations]);

  const closeModal = () => {
    setModal({ kind: "none" });
    form.reset();
  };

  const onSubmitCreate = async (v: EmployeeFormValues) => {
    const out = await createTrigger({
      firstName: v.firstName,
      lastName: v.lastName,
      email: v.email,
      phone: v.phone || undefined,
      dateOfBirth: v.dateOfBirth || undefined,
      address: v.address || undefined,
      emergencyContactName: v.emergencyContactName || undefined,
      emergencyContactPhone: v.emergencyContactPhone || undefined,
      emergencyRelationship: v.emergencyRelationship || undefined,
      departmentId: v.departmentId,
      designationId: v.designationId,
      managerId: v.managerId || undefined,
      employmentType: v.employmentType,
      employmentStatus: v.employmentStatus,
      joiningDate: v.joiningDate,
      salary: v.salary ? String(v.salary) : undefined,
    });
    if ("data" in out && (out.data as any)?.success) {
      closeModal();
    }
  };

  const onSubmitEdit = async (v: EmployeeFormValues) => {
    if (modal.kind !== "edit") return;
    const out = await updateTrigger({
      id: modal.employee.id,
      body: {
        firstName: v.firstName,
        lastName: v.lastName,
        email: v.email,
        phone: v.phone || undefined,
        dateOfBirth: v.dateOfBirth || undefined,
        address: v.address || undefined,
        emergencyContactName: v.emergencyContactName || undefined,
        emergencyContactPhone: v.emergencyContactPhone || undefined,
        emergencyRelationship: v.emergencyRelationship || undefined,
        departmentId: v.departmentId,
        designationId: v.designationId,
        managerId: v.managerId || undefined,
        employmentType: v.employmentType,
        employmentStatus: v.employmentStatus,
        joiningDate: v.joiningDate,
        salary: v.salary ? String(v.salary) : undefined,
      },
    });
    if ("data" in out && (out.data as any)?.success) {
      closeModal();
    }
  };

  const handleDelete = async () => {
    if (modal.kind !== "delete") return;
    await deleteTrigger(modal.employee.id);
    setModal({ kind: "none" });
  };

  const initials = (e: EmployeeItem) =>
    `${e.firstName?.[0] ?? ""}${e.lastName?.[0] ?? ""}`.toUpperCase() || "E";

  const columns: ColumnDef<TableFeatures, EmployeeItem, any>[] = useMemo(
    () => {
      const col = createColumns<EmployeeItem>();
      return [
        col.accessor("employeeCode" as any, {
          id: "employeeCode",
          header: "Code",
          enableSorting: true,
          cell: ({ row: { original: e } }) => (
            <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
              {e.employeeCode}
            </span>
          ),
        }),
        col.display({
          id: "name",
          header: "Name",
          cell: ({ row: { original: e } }) => (
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 text-primary h-9 w-9 shrink-0 flex items-center justify-center font-semibold text-sm border border-primary/20">
                {initials(e)}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">
                  {e.firstName} {e.lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {e.email}
                </p>
              </div>
            </div>
          ),
        }),
        col.display({
          id: "department",
          header: "Dept",
          cell: ({ row: { original: e } }) => {
            const d = e.department ?? deptById.get(e.departmentId);
            return d ? (
              <StatusBadge tone="sky" size="sm" label={d.name} />
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            );
          },
        }),
        col.display({
          id: "designation",
          header: "Designation",
          cell: ({ row: { original: e } }) => {
            const d = e.designation ?? desigById.get(e.designationId);
            return d ? (
              <span className="text-sm font-medium text-foreground truncate max-w-[14ch]">
                {d.name}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            );
          },
        }),
        col.display({
          id: "manager",
          header: "Manager",
          cell: ({ row: { original: e } }) => {
            const m = e.manager ?? managerById.get(e.managerId ?? "");
            if (!m)
              return (
                <span className="text-xs text-muted-foreground">—</span>
              );
            return (
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 flex items-center justify-center text-[10px] font-semibold">
                  {`${m.firstName?.[0] ?? ""}${m.lastName?.[0] ?? ""}`.toUpperCase() ||
                    "M"}
                </div>
                <span className="text-xs text-foreground truncate max-w-[12ch]">
                  {m.firstName ?? ""} {m.lastName?.[0] ?? ""}.
                </span>
              </div>
            );
          },
        }),
        col.display({
          id: "employmentStatus",
          header: "Status",
          cell: ({ row: { original: e } }) => (
            <StatusBadge
              tone={EMPLOYMENT_STATUS_TONE[e.employmentStatus]}
              size="md"
              dot={e.employmentStatus === "ACTIVE"}
              label={e.employmentStatus
                .charAt(0)
                .concat(
                  e.employmentStatus.slice(1).toLowerCase().replace("_", " ")
                )}
            />
          ),
        }),
        col.accessor("joiningDate" as any, {
          id: "joiningDate",
          header: "Joining Date",
          enableSorting: true,
          cell: ({ row: { original: e } }) => (
            <DateDisplay date={e.joiningDate} format="short" />
          ),
        }),
        col.display({
          id: "actions",
          header: "",
          enableSorting: false,
          cell: ({ row: { original: e } }) => (
            <div className="flex items-center justify-end gap-1.5">
              <PermissionGate one="hrm.employees.update">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModal({ kind: "edit", employee: e })}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
              </PermissionGate>
              <PermissionGate one="hrm.employees.delete">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModal({ kind: "delete", employee: e })}
                  className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </PermissionGate>
            </div>
          ),
        }),
      ];
    },
    [deptById, desigById, managerById]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "HRM" }, { label: "Employees" }]}
        title="Employees"
        description="Manage employee records, job details, and personal information."
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
            <PermissionGate one="hrm.employees.create">
              <Button
                size="sm"
                onClick={() => setModal({ kind: "create" })}
              >
                <UserPlus className="w-4 h-4" /> New employee
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <TableToolbar
        searchTerm={filters.search ?? ""}
        onSearchChange={(v) => pushParams({ search: v })}
        searchPlaceholder="Search by name or email…"
        onCreateNew={canCreate ? () => setModal({ kind: "create" }) : undefined}
        createNewLabel="New employee"
        disableCreateNew={!canCreate}
        startContent={
          <>
            <GlobalSelect
              value={filters.departmentId ?? ""}
              onChange={(v) => pushParams({ departmentId: v })}
              options={deptFilterOptions}
              placeholder="Department"
              className="w-44"
            />
            <GlobalSelect
              value={filters.designationId ?? ""}
              onChange={(v) => pushParams({ designationId: v })}
              options={desigFilterOptions}
              placeholder="Designation"
              className="w-44"
            />
            <GlobalSelect
              value={filters.employmentStatus ?? ""}
              onChange={(v) =>
                pushParams({
                  employmentStatus: v === "" ? undefined : (v as any),
                })
              }
              options={employmentStatusOptions}
              placeholder="Status"
              className="w-40"
            />
            <GlobalSelect
              value={filters.employmentType ?? ""}
              onChange={(v) =>
                pushParams({
                  employmentType: v === "" ? undefined : (v as any),
                })
              }
              options={employmentTypeOptions}
              placeholder="Type"
              className="w-40"
            />
          </>
        }
      />

      <GlobalTable<EmployeeItem>
        columns={columns}
        data={employees}
        meta={meta}
        serverSide
        pageSizeDefault={25}
        defaultSortBy="joiningDate"
        defaultSortOrder="desc"
        queryResult={{
          data: (employeesRes as any)?.data ?? employeesRes,
          isFetching,
        }}
        getRowId={(e) => e.id}
        emptyIcon={<UserRound className="w-10 h-10" />}
        emptyTitle="No employees found"
        emptyDescription="No employees match the current filters."
        emptyAction={
          <PermissionGate one="hrm.employees.create">
            <Button size="sm" onClick={() => setModal({ kind: "create" })}>
              <Plus className="w-4 h-4" /> New employee
            </Button>
          </PermissionGate>
        }
        errorOnRetry={() => refetch()}
      />

      <GlobalModal
        open={modal.kind === "create"}
        onOpenChange={(o) => !o && closeModal()}
        title={modal.kind === "create" ? "Create new employee" : "Edit employee"}
        size="xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-employee-form"
              disabled={createState.isLoading || !canCreate}
            >
              {createState.isLoading ? "Creating…" : "Create employee"}
            </Button>
          </div>
        }
      >
        <form
          id="create-employee-form"
          onSubmit={form.handleSubmit(onSubmitCreate)}
          className="space-y-6"
          noValidate
        >
          <div>
            <SectionHeader
              icon={<UserRound className="w-4.5 h-4.5" />}
              title="Personal Information"
              subtitle="Basic details and emergency contacts"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GlobalInput
                label="First name"
                required
                error={form.formState.errors.firstName?.message}
                {...form.register("firstName")}
              />
              <GlobalInput
                label="Last name"
                required
                error={form.formState.errors.lastName?.message}
                {...form.register("lastName")}
              />
              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-slate-400 mt-8 shrink-0 hidden sm:block" />
                <div className="flex-1">
                  <GlobalInput
                    label="Email"
                    inputType="email"
                    required
                    error={form.formState.errors.email?.message}
                    {...form.register("email")}
                  />
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-slate-400 mt-8 shrink-0 hidden sm:block" />
                <div className="flex-1">
                  <GlobalInput
                    label="Phone"
                    error={form.formState.errors.phone?.message}
                    {...form.register("phone")}
                  />
                </div>
              </div>
              <GlobalDatePicker
                label="Date of Birth"
                value={form.watch("dateOfBirth") || null}
                onChange={(v) =>
                  form.setValue("dateOfBirth", v ?? "", {
                    shouldValidate: true,
                  })
                }
                error={form.formState.errors.dateOfBirth?.message}
              />
              <div className="md:col-span-2 flex items-start gap-2">
                <MapPin className="w-4 h-4 text-slate-400 mt-8 shrink-0 hidden sm:block" />
                <div className="flex-1">
                  <GlobalInput
                    label="Address"
                    error={form.formState.errors.address?.message}
                    {...form.register("address")}
                  />
                </div>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-dashed border-border">
              <div className="flex items-center gap-2 mb-3">
                <HeartHandshake className="w-4 h-4 text-rose-500" />
                <p className="text-sm font-medium text-foreground">
                  Emergency Contact
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GlobalInput
                  label="Contact name"
                  error={form.formState.errors.emergencyContactName?.message}
                  {...form.register("emergencyContactName")}
                />
                <GlobalInput
                  label="Contact phone"
                  error={form.formState.errors.emergencyContactPhone?.message}
                  {...form.register("emergencyContactPhone")}
                />
                <GlobalInput
                  label="Relationship"
                  error={
                    form.formState.errors.emergencyRelationship?.message
                  }
                  {...form.register("emergencyRelationship")}
                />
              </div>
            </div>
          </div>

          <div>
            <SectionHeader
              icon={<Briefcase className="w-4.5 h-4.5" />}
              title="Job Information"
              subtitle="Department, role, and compensation details"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GlobalSelect
                label="Department"
                required
                value={form.watch("departmentId")}
                onChange={(v) =>
                  form.setValue("departmentId", v, { shouldValidate: true })
                }
                options={deptOptions}
                placeholder="Select department…"
                error={form.formState.errors.departmentId?.message}
              />
              <GlobalSelect
                label="Designation"
                required
                value={form.watch("designationId")}
                onChange={(v) =>
                  form.setValue("designationId", v, { shouldValidate: true })
                }
                options={desigOptions}
                placeholder="Select designation…"
                error={form.formState.errors.designationId?.message}
              />
              <GlobalSelect
                label="Reporting Manager"
                value={form.watch("managerId")}
                onChange={(v) =>
                  form.setValue("managerId", v, { shouldValidate: true })
                }
                options={managerOptions}
                placeholder="Select manager…"
                error={form.formState.errors.managerId?.message}
              />
              <div className="grid grid-cols-2 gap-4">
                <GlobalSelect
                  label="Employment Type"
                  required
                  value={form.watch("employmentType")}
                  onChange={(v) =>
                    form.setValue("employmentType", v as any, {
                      shouldValidate: true,
                    })
                  }
                  options={employmentTypeOptions.filter(
                    (o) => o.value !== ""
                  )}
                  placeholder="Select type…"
                  error={form.formState.errors.employmentType?.message}
                />
                <GlobalSelect
                  label="Status"
                  required
                  value={form.watch("employmentStatus")}
                  onChange={(v) =>
                    form.setValue("employmentStatus", v as any, {
                      shouldValidate: true,
                    })
                  }
                  options={employmentStatusOptions.filter(
                    (o) => o.value !== ""
                  )}
                  placeholder="Select status…"
                  error={form.formState.errors.employmentStatus?.message}
                />
              </div>
              <div className="flex items-start gap-2">
                <CalendarDays className="w-4 h-4 text-slate-400 mt-8 shrink-0 hidden sm:block" />
                <div className="flex-1">
                  <GlobalDatePicker
                    label="Joining Date"
                    required
                    value={form.watch("joiningDate") || null}
                    onChange={(v) =>
                      form.setValue("joiningDate", v ?? "", {
                        shouldValidate: true,
                      })
                    }
                    error={form.formState.errors.joiningDate?.message}
                  />
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Banknote className="w-4 h-4 text-slate-400 mt-8 shrink-0 hidden sm:block" />
                <div className="flex-1">
                  <GlobalInput
                    label="Salary"
                    inputType="number"
                    error={form.formState.errors.salary?.message}
                    {...form.register("salary")}
                  />
                </div>
              </div>
            </div>
          </div>

          {createState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (createState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to create employee."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <GlobalModal
        open={modal.kind === "edit"}
        onOpenChange={(o) => !o && closeModal()}
        title="Edit employee"
        size="xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="edit-employee-form"
              disabled={updateState.isLoading || !canUpdate}
            >
              {updateState.isLoading ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      >
        <form
          id="edit-employee-form"
          onSubmit={form.handleSubmit(onSubmitEdit)}
          className="space-y-6"
          noValidate
        >
          <div>
            <SectionHeader
              icon={<UserRound className="w-4.5 h-4.5" />}
              title="Personal Information"
              subtitle="Basic details and emergency contacts"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GlobalInput
                label="First name"
                required
                error={form.formState.errors.firstName?.message}
                {...form.register("firstName")}
              />
              <GlobalInput
                label="Last name"
                required
                error={form.formState.errors.lastName?.message}
                {...form.register("lastName")}
              />
              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-slate-400 mt-8 shrink-0 hidden sm:block" />
                <div className="flex-1">
                  <GlobalInput
                    label="Email"
                    inputType="email"
                    required
                    error={form.formState.errors.email?.message}
                    {...form.register("email")}
                  />
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-slate-400 mt-8 shrink-0 hidden sm:block" />
                <div className="flex-1">
                  <GlobalInput
                    label="Phone"
                    error={form.formState.errors.phone?.message}
                    {...form.register("phone")}
                  />
                </div>
              </div>
              <GlobalDatePicker
                label="Date of Birth"
                value={form.watch("dateOfBirth") || null}
                onChange={(v) =>
                  form.setValue("dateOfBirth", v ?? "", {
                    shouldValidate: true,
                  })
                }
                error={form.formState.errors.dateOfBirth?.message}
              />
              <div className="md:col-span-2 flex items-start gap-2">
                <MapPin className="w-4 h-4 text-slate-400 mt-8 shrink-0 hidden sm:block" />
                <div className="flex-1">
                  <GlobalInput
                    label="Address"
                    error={form.formState.errors.address?.message}
                    {...form.register("address")}
                  />
                </div>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-dashed border-border">
              <div className="flex items-center gap-2 mb-3">
                <HeartHandshake className="w-4 h-4 text-rose-500" />
                <p className="text-sm font-medium text-foreground">
                  Emergency Contact
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GlobalInput
                  label="Contact name"
                  error={form.formState.errors.emergencyContactName?.message}
                  {...form.register("emergencyContactName")}
                />
                <GlobalInput
                  label="Contact phone"
                  error={form.formState.errors.emergencyContactPhone?.message}
                  {...form.register("emergencyContactPhone")}
                />
                <GlobalInput
                  label="Relationship"
                  error={
                    form.formState.errors.emergencyRelationship?.message
                  }
                  {...form.register("emergencyRelationship")}
                />
              </div>
            </div>
          </div>

          <div>
            <SectionHeader
              icon={<Briefcase className="w-4.5 h-4.5" />}
              title="Job Information"
              subtitle="Department, role, and compensation details"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GlobalSelect
                label="Department"
                required
                value={form.watch("departmentId")}
                onChange={(v) =>
                  form.setValue("departmentId", v, { shouldValidate: true })
                }
                options={deptOptions}
                placeholder="Select department…"
                error={form.formState.errors.departmentId?.message}
              />
              <GlobalSelect
                label="Designation"
                required
                value={form.watch("designationId")}
                onChange={(v) =>
                  form.setValue("designationId", v, { shouldValidate: true })
                }
                options={desigOptions}
                placeholder="Select designation…"
                error={form.formState.errors.designationId?.message}
              />
              <GlobalSelect
                label="Reporting Manager"
                value={form.watch("managerId")}
                onChange={(v) =>
                  form.setValue("managerId", v, { shouldValidate: true })
                }
                options={managerOptions}
                placeholder="Select manager…"
                error={form.formState.errors.managerId?.message}
              />
              <div className="grid grid-cols-2 gap-4">
                <GlobalSelect
                  label="Employment Type"
                  required
                  value={form.watch("employmentType")}
                  onChange={(v) =>
                    form.setValue("employmentType", v as any, {
                      shouldValidate: true,
                    })
                  }
                  options={employmentTypeOptions.filter(
                    (o) => o.value !== ""
                  )}
                  placeholder="Select type…"
                  error={form.formState.errors.employmentType?.message}
                />
                <GlobalSelect
                  label="Status"
                  required
                  value={form.watch("employmentStatus")}
                  onChange={(v) =>
                    form.setValue("employmentStatus", v as any, {
                      shouldValidate: true,
                    })
                  }
                  options={employmentStatusOptions.filter(
                    (o) => o.value !== ""
                  )}
                  placeholder="Select status…"
                  error={form.formState.errors.employmentStatus?.message}
                />
              </div>
              <div className="flex items-start gap-2">
                <CalendarDays className="w-4 h-4 text-slate-400 mt-8 shrink-0 hidden sm:block" />
                <div className="flex-1">
                  <GlobalDatePicker
                    label="Joining Date"
                    required
                    value={form.watch("joiningDate") || null}
                    onChange={(v) =>
                      form.setValue("joiningDate", v ?? "", {
                        shouldValidate: true,
                      })
                    }
                    error={form.formState.errors.joiningDate?.message}
                  />
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Banknote className="w-4 h-4 text-slate-400 mt-8 shrink-0 hidden sm:block" />
                <div className="flex-1">
                  <GlobalInput
                    label="Salary"
                    inputType="number"
                    error={form.formState.errors.salary?.message}
                    {...form.register("salary")}
                  />
                </div>
              </div>
            </div>
          </div>

          {updateState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (updateState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to update employee."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <ConfirmDialog
        open={modal.kind === "delete"}
        onOpenChange={(o) => !o && closeModal()}
        title="Delete employee"
        variant="destructive"
        description={
          modal.kind === "delete"
            ? `Are you sure you want to delete "${modal.employee.firstName} ${modal.employee.lastName}" (${modal.employee.employeeCode})? This will soft-delete the employee record.`
            : ""
        }
        confirmText={deleteState.isLoading ? "Deleting…" : "Delete employee"}
        loading={deleteState.isLoading}
        icon={<Trash2 className="w-5 h-5" />}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default function EmployeesPage() {
  return (
    <Suspense fallback={<div>Loading employees...</div>}>
      <EmployeesPageContent />
    </Suspense>
  );
}
