"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import * as Tabs from "@radix-ui/react-tabs";
import {
  CalendarPlus,
  CalendarX2,
  CheckCircle2,
  XCircle,
  FileText,
  RefreshCw,
  PlaneTakeoff,
} from "lucide-react";
import { eachDayOfInterval, isWeekend, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  useListLeavesQuery,
  useListEmployeesQuery,
  useListLeaveTypesQuery,
  useCreateLeaveMutation,
  useApproveLeaveMutation,
  useRejectLeaveMutation,
  useCancelLeaveMutation,
  type LeaveItem,
  type LeaveRequestStatus,
  type LeaveTypeItem,
  type EmployeeItem,
} from "@/lib/api/hrmEndpoints";
import { cn } from "@/lib/utils";
import {
  PermissionGate,
  useHasPermission,
} from "@/components/auth/PermissionGate";
import { useAppSelector } from "@/store/hooks";
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

const LEAVE_STATUS_TONE: Record<
  LeaveRequestStatus,
  "slate" | "emerald" | "rose" | "violet"
> = {
  PENDING: "slate",
  APPROVED: "emerald",
  REJECTED: "rose",
  CANCELLED: "violet",
};

const LEAVE_STATUS_LABEL: Record<LeaveRequestStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

function calculateWeekdays(from: string | null, to: string | null): number {
  if (!from || !to) return 0;
  try {
    const start = parseISO(from);
    const end = parseISO(to);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
    const days = eachDayOfInterval({ start, end });
    return days.filter((d) => !isWeekend(d)).length;
  } catch {
    return 0;
  }
}

const createLeaveSchema = z.object({
  leaveTypeId: z.string().min(1, "Leave type is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().trim().min(20, "Reason must be at least 20 characters").max(1000),
});
type CreateLeaveFormValues = z.infer<typeof createLeaveSchema>;

const rejectSchema = z.object({
  rejectionNote: z.string().trim().min(5, "Rejection reason is required").max(500),
});
type RejectFormValues = z.infer<typeof rejectSchema>;

function LeavesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canReadAll = useHasPermission({ one: "hrm.leave.read_all" });
  const canApprove = useHasPermission({ one: "hrm.leave.approve" });
  const canCreate = useHasPermission({ one: "hrm.leave.create" });
  const authUserId = useAppSelector((s) => s.auth.user?.id);
  const canCancelSelf = useHasPermission({ one: "hrm.leave.cancel_self" });

  const [activeTab, setActiveTab] = useState<"mine" | "all">(canReadAll ? "all" : "mine");

  useEffect(() => {
    if (!canReadAll) setActiveTab("mine");
  }, [canReadAll]);

  const {
    data: employeesRes,
  } = useListEmployeesQuery({ pageSize: 100, isActive: true });
  const { data: leaveTypesRes } = useListLeaveTypesQuery({ pageSize: 100, isActive: true });

  const employees: EmployeeItem[] = employeesRes?.items ?? [];
  const leaveTypes: LeaveTypeItem[] = leaveTypesRes?.items ?? [];

  const employeeById = useMemo(() => {
    const m = new Map<string, EmployeeItem>();
    employees.forEach((e) => m.set(e.id, e));
    return m;
  }, [employees]);

  const leaveTypeById = useMemo(() => {
    const m = new Map<string, LeaveTypeItem>();
    leaveTypes.forEach((lt) => m.set(lt.id, lt));
    return m;
  }, [leaveTypes]);

  const currentUserEmployeeId = useMemo(() => {
    const match = employees.find((e) => e.userId === authUserId);
    return match?.id;
  }, [employees, authUserId]);

  const employeeOptions = useMemo(
    () => employees.map((e) => ({
      value: e.id,
      label: `${e.employeeCode} — ${e.firstName} ${e.lastName}`,
    })),
    [employees],
  );

  const leaveTypeOptions = useMemo(
    () => leaveTypes.map((lt) => ({ value: lt.id, label: lt.name })),
    [leaveTypes],
  );

  const statusOptions = useMemo(
    () => [
      { value: "", label: "All statuses" },
      { value: "PENDING", label: "Pending" },
      { value: "APPROVED", label: "Approved" },
      { value: "REJECTED", label: "Rejected" },
      { value: "CANCELLED", label: "Cancelled" },
    ],
    [],
  );

  const filters = useMemo(() => {
    const page = parseInt(searchParams?.get("page") ?? "1", 10) || 1;
    const pageSize = parseInt(searchParams?.get("pageSize") ?? "25", 10) || 25;
    const tab = activeTab;
    const baseEmployeeId = searchParams?.get("employeeId") || undefined;
    const effectiveEmployeeId =
      tab === "mine"
        ? currentUserEmployeeId
        : canReadAll
          ? baseEmployeeId
          : currentUserEmployeeId;
    return {
      page,
      pageSize,
      search: searchParams?.get("search") ?? "",
      leaveTypeId: searchParams?.get("leaveTypeId") || undefined,
      status: searchParams?.get("status") as LeaveRequestStatus | undefined || undefined,
      employeeId: effectiveEmployeeId,
      sortBy: searchParams?.get("sortBy") ?? "createdAt",
      sortOrder: (searchParams?.get("sortOrder") as "asc" | "desc") ?? "desc",
    };
  }, [searchParams, activeTab, currentUserEmployeeId, canReadAll]);

  const {
    data: leavesRes,
    isFetching,
    refetch,
  } = useListLeavesQuery(filters, { refetchOnMountOrArgChange: true });

  const leaves = leavesRes?.items ?? [];
  const meta = leavesRes?.meta;

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
    [searchParams],
  );

  const pushParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const qs = buildParams(patch);
      router.push(`?${qs}`, { scroll: false });
    },
    [buildParams, router],
  );

  type ModalState =
    | { kind: "none" }
    | { kind: "create" }
    | { kind: "reject"; leave: LeaveItem }
    | { kind: "approve"; leave: LeaveItem }
    | { kind: "cancel"; leave: LeaveItem };
  const [modal, setModal] = useState<ModalState>({ kind: "none" });

  const [createTrigger, createState] = useCreateLeaveMutation();
  const [approveTrigger, approveState] = useApproveLeaveMutation();
  const [rejectTrigger, rejectState] = useRejectLeaveMutation();
  const [cancelTrigger, cancelState] = useCancelLeaveMutation();

  const createForm = useForm<CreateLeaveFormValues>({
    resolver: zodResolver(createLeaveSchema),
    defaultValues: {
      leaveTypeId: "",
      startDate: "",
      endDate: "",
      reason: "",
    },
    mode: "onTouched",
  });

  const rejectForm = useForm<RejectFormValues>({
    resolver: zodResolver(rejectSchema),
    defaultValues: {
      rejectionNote: "",
    },
    mode: "onTouched",
  });

  const startDate = createForm.watch("startDate");
  const endDate = createForm.watch("endDate");
  const liveTotalDays = useMemo(
    () => calculateWeekdays(startDate ?? null, endDate ?? null),
    [startDate, endDate],
  );

  const firstLeaveTypeId = leaveTypes[0]?.id ?? "";

  useEffect(() => {
    if (modal.kind === "create") {
      createForm.reset({
        leaveTypeId: firstLeaveTypeId,
        startDate: "",
        endDate: "",
        reason: "",
      });
    } else if (modal.kind === "reject") {
      rejectForm.reset({ rejectionNote: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal.kind, modal.kind === "reject" ? "__reject__" : "__create__", firstLeaveTypeId]);

  const onSubmitCreate = async (v: CreateLeaveFormValues) => {
    const totalDays = calculateWeekdays(v.startDate, v.endDate);
    const payload = {
      leaveTypeId: v.leaveTypeId,
      startDate: v.startDate,
      endDate: v.endDate,
      totalDays,
      reason: v.reason,
    };
    const res = await createTrigger(payload);
    if ("data" in res) {
      setModal({ kind: "none" });
    }
  };

  const onSubmitReject = async (v: RejectFormValues) => {
    if (modal.kind !== "reject") return;
    const res = await rejectTrigger({ id: modal.leave.id, rejectionNote: v.rejectionNote });
    if ("data" in res) {
      setModal({ kind: "none" });
    }
  };

  const handleApprove = async () => {
    if (modal.kind !== "approve") return;
    await approveTrigger({ id: modal.leave.id });
    setModal({ kind: "none" });
  };

  const handleCancel = async () => {
    if (modal.kind !== "cancel") return;
    await cancelTrigger(modal.leave.id);
    setModal({ kind: "none" });
  };

  const closeModal = () => {
    setModal({ kind: "none" });
    createForm.reset();
    rejectForm.reset();
  };

  const columns: ColumnDef<TableFeatures, LeaveItem, any>[] = useMemo(() => {
    const col = createColumns<LeaveItem>();

    return [
      col.display({
        id: "employee",
        header: "Employee",
        cell: ({ row: { original: l } }) => {
          const e = l.employee ?? employeeById.get(l.employeeId);
          return (
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">
                {e ? `${e.firstName} ${e.lastName}` : l.employeeId}
              </p>
              {e?.employeeCode && (
                <p className="text-xs text-muted-foreground truncate">
                  {e.employeeCode}
                </p>
              )}
            </div>
          );
        },
      }),
      col.display({
        id: "leaveType",
        header: "Leave Type",
        cell: ({ row: { original: l } }) => {
          const lt = l.leaveType ?? leaveTypeById.get(l.leaveTypeId);
          return (
            <StatusBadge
              tone="sky"
              size="md"
              icon={<FileText className="w-3 h-3" />}
              label={lt?.name ?? l.leaveTypeId}
            />
          );
        },
      }),
      col.display({
        id: "dates",
        header: "Date Range",
        cell: ({ row: { original: l } }) => (
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <DateDisplay date={l.startDate} format="short" />
              <span className="text-muted-foreground">→</span>
              <DateDisplay date={l.endDate} format="short" />
            </div>
          </div>
        ),
      }),
      col.display({
        id: "totalDays",
        header: "Total Days",
        cell: ({ row: { original: l } }) => (
          <span className="font-mono text-sm">
            {typeof l.totalDays === "number" ? l.totalDays : "—"}
          </span>
        ),
      }),
      col.accessor("status", {
        id: "status",
        header: "Status",
        enableSorting: true,
        cell: ({ getValue }) => {
          const s = getValue() as LeaveRequestStatus;
          return (
            <StatusBadge
              tone={LEAVE_STATUS_TONE[s]}
              size="md"
              dot
              label={LEAVE_STATUS_LABEL[s] ?? s}
            />
          );
        },
      }),
      col.display({
        id: "reason",
        header: "Reason",
        cell: ({ row: { original: l } }) => (
          <span className="text-sm text-muted-foreground truncate max-w-[220px] block" title={l.reason ?? undefined}>
            {l.reason || "—"}
          </span>
        ),
      }),
      col.display({
        id: "approver",
        header: "Approver",
        cell: ({ row: { original: l } }) => {
          const a = l.approver;
          return (
            <span className="text-sm truncate block">
              {a ? `${a.firstName} ${a.lastName}` : "—"}
            </span>
          );
        },
      }),
      col.display({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row: { original: l } }) => {
          const isSelf = l.employeeId === currentUserEmployeeId;
          const canApproveThis = l.status === "PENDING" && canApprove;
          const canCancelThis = isSelf && l.status === "PENDING" && (canCancelSelf || canCreate);
          return (
            <div className="flex items-center justify-end gap-1.5">
              {canApproveThis && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setModal({ kind: "approve", leave: l })}
                    className="text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Approve</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setModal({ kind: "reject", leave: l })}
                    className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Reject</span>
                  </Button>
                </>
              )}
              {canCancelThis && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModal({ kind: "cancel", leave: l })}
                  className="text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 border-violet-200 dark:border-violet-900"
                >
                  <CalendarX2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cancel</span>
                </Button>
              )}
            </div>
          );
        },
      }),
    ];
  }, [employeeById, leaveTypeById, currentUserEmployeeId, canApprove, canCancelSelf, canCreate]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "HRM" }, { label: "Leave Requests" }]}
        title="Leave Requests"
        description="Submit, review, and manage time-off requests."
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
            <PermissionGate one="hrm.leave.create">
              <Button size="sm" onClick={() => setModal({ kind: "create" })}>
                <CalendarPlus className="w-4 h-4 mr-1" /> New request
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <Tabs.Root
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "mine" | "all")}
        className="space-y-4"
      >
        <Tabs.List className="flex items-center gap-1 p-1 rounded-xl border border-border bg-slate-50 dark:bg-slate-900/50 w-fit">
          <Tabs.Trigger
            value="mine"
            className="px-4 py-2 text-sm font-medium rounded-lg transition-all text-slate-600 dark:text-slate-400 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <span className="inline-flex items-center gap-2">
              <PlaneTakeoff className="w-4 h-4" /> My Requests
            </span>
          </Tabs.Trigger>
          <PermissionGate one="hrm.leave.read_all">
            <Tabs.Trigger
              value="all"
              className="px-4 py-2 text-sm font-medium rounded-lg transition-all text-slate-600 dark:text-slate-400 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <span className="inline-flex items-center gap-2">
                <FileText className="w-4 h-4" /> All Requests
              </span>
            </Tabs.Trigger>
          </PermissionGate>
        </Tabs.List>

        <Tabs.Content value={activeTab} className="space-y-4">
          <TableToolbar
            searchTerm={filters.search ?? ""}
            onSearchChange={(v) => pushParams({ search: v })}
            searchPlaceholder="Search by reason or employee…"
            onCreateNew={canCreate ? () => setModal({ kind: "create" }) : undefined}
            disableCreateNew={!canCreate}
            startContent={
              <>
                <GlobalSelect
                  value={filters.leaveTypeId ?? ""}
                  onChange={(v) => pushParams({ leaveTypeId: v })}
                  options={[{ value: "", label: "All types" }, ...leaveTypeOptions]}
                  placeholder="Leave Type"
                  className="w-44"
                />
                <GlobalSelect
                  value={filters.status ?? ""}
                  onChange={(v) => pushParams({ status: v })}
                  options={statusOptions}
                  placeholder="Status"
                  className="w-40"
                />
                {canReadAll && activeTab === "all" && (
                  <GlobalSelect
                    value={filters.employeeId ?? ""}
                    onChange={(v) => pushParams({ employeeId: v })}
                    options={[{ value: "", label: "All employees" }, ...employeeOptions]}
                    placeholder="Employee"
                    className="w-56"
                  />
                )}
              </>
            }
          />

          <GlobalTable<LeaveItem>
            columns={columns}
            data={leaves}
            meta={meta}
            serverSide
            pageSizeDefault={25}
            defaultSortBy="createdAt"
            defaultSortOrder="desc"
            queryResult={{
              data: leavesRes as any,
              isFetching,
            }}
            getRowId={(l) => l.id}
            emptyIcon={<CalendarX2 className="w-10 h-10" />}
            emptyTitle="No leave requests"
            emptyDescription="No leave requests match the current filters."
            emptyAction={
              <PermissionGate one="hrm.leave.create">
                <Button size="sm" onClick={() => setModal({ kind: "create" })}>
                  <CalendarPlus className="w-4 h-4" /> New request
                </Button>
              </PermissionGate>
            }
            errorOnRetry={() => refetch()}
          />
        </Tabs.Content>
      </Tabs.Root>

      <GlobalModal
        open={modal.kind === "create"}
        onOpenChange={(o) => !o && closeModal()}
        title="Submit Leave Request"
        description="Request time off. Weekends are automatically excluded."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-leave-form"
              disabled={createState.isLoading || !canCreate}
            >
              {createState.isLoading ? "Submitting…" : "Submit request"}
            </Button>
          </div>
        }
      >
        <form
          id="create-leave-form"
          onSubmit={createForm.handleSubmit(onSubmitCreate)}
          className="space-y-4"
          noValidate
        >
          <GlobalSelect
            label="Leave Type"
            required
            value={createForm.watch("leaveTypeId")}
            onChange={(v) => createForm.setValue("leaveTypeId", v, { shouldValidate: true })}
            options={leaveTypeOptions}
            placeholder="Select leave type…"
            error={createForm.formState.errors.leaveTypeId?.message}
          />
          <div className="grid grid-cols-2 gap-4">
            <GlobalDatePicker
              label="From Date"
              required
              value={createForm.watch("startDate")}
              onChange={(v) => createForm.setValue("startDate", v ?? "", { shouldValidate: true })}
              placeholder="Start date"
              error={createForm.formState.errors.startDate?.message}
            />
            <GlobalDatePicker
              label="To Date"
              required
              value={createForm.watch("endDate")}
              onChange={(v) => createForm.setValue("endDate", v ?? "", { shouldValidate: true })}
              placeholder="End date"
              error={createForm.formState.errors.endDate?.message}
              minDate={startDate ? parseISO(startDate) : undefined}
            />
          </div>
          <div className="rounded-lg border border-sky-200 bg-sky-50 dark:border-sky-900/60 dark:bg-sky-950/30 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-sky-700 dark:text-sky-300">
                Total working days (excl. weekends)
              </span>
              <span className="font-mono text-lg font-semibold text-sky-700 dark:text-sky-300">
                {liveTotalDays}
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Reason
              <span className="ml-0.5 text-rose-500">*</span>
            </label>
            <textarea
              placeholder="Please provide a detailed reason (minimum 20 characters)…"
              className={cn(
                "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 min-h-[100px] resize-y",
                createForm.formState.errors.reason?.message && "border-rose-400 focus-visible:ring-rose-400",
              )}
              {...createForm.register("reason")}
            />
            {createForm.formState.errors.reason?.message && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {createForm.formState.errors.reason?.message}
              </p>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {createForm.watch("reason")?.length ?? 0}/1000 characters (min. 20)
            </p>
          </div>
          {createState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(createState.error as { data?: { error?: { message?: string } } }).data?.error?.message ?? "Failed to submit leave request."}
            </div>
          )}
        </form>
      </GlobalModal>

      <ConfirmDialog
        open={modal.kind === "approve"}
        onOpenChange={(o) => !o && closeModal()}
        title="Approve leave request"
        variant="primary"
        description={
          modal.kind === "approve"
            ? `Approving ${
                modal.leave.employee?.firstName
                  ? `${modal.leave.employee.firstName} ${modal.leave.employee.lastName}`
                  : "employee"
              }'s ${modal.leave.leaveType?.name ?? "leave"} request from ${modal.leave.startDate} to ${modal.leave.endDate} (${modal.leave.totalDays} day${modal.leave.totalDays === 1 ? "" : "s"}).`
            : ""
        }
        confirmText={approveState.isLoading ? "Approving…" : "Approve"}
        loading={approveState.isLoading}
        icon={<CheckCircle2 className="w-5 h-5" />}
        onConfirm={handleApprove}
        confirmButtonClassName="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
      />

      <GlobalModal
        open={modal.kind === "reject"}
        onOpenChange={(o) => !o && closeModal()}
        title="Reject leave request"
        description={
          modal.kind === "reject"
            ? `Please provide a reason for rejecting this request.`
            : ""
        }
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="reject-leave-form"
              disabled={rejectState.isLoading || !canApprove}
              className="bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-700"
            >
              {rejectState.isLoading ? "Rejecting…" : "Reject"}
            </Button>
          </div>
        }
      >
        <form
          id="reject-leave-form"
          onSubmit={rejectForm.handleSubmit(onSubmitReject)}
          className="space-y-4"
          noValidate
        >
          {modal.kind === "reject" && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 px-4 py-3 space-y-1">
              <p className="text-sm">
                <span className="font-medium">Request:</span>{' '}
                {modal.leave.leaveType?.name ?? "Leave"} — {modal.leave.totalDays} day{modal.leave.totalDays === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-muted-foreground">
                {modal.leave.employee?.firstName
                  ? `${modal.leave.employee.firstName} ${modal.leave.employee.lastName}`
                  : "Employee"} · {modal.leave.startDate} → {modal.leave.endDate}
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Rejection Note
              <span className="ml-0.5 text-rose-500">*</span>
            </label>
            <textarea
              placeholder="Explain why this request is being rejected…"
              className={cn(
                "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70 min-h-[120px] resize-y",
                rejectForm.formState.errors.rejectionNote?.message && "border-rose-400 focus-visible:ring-rose-400",
              )}
              {...rejectForm.register("rejectionNote")}
            />
            {rejectForm.formState.errors.rejectionNote?.message && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {rejectForm.formState.errors.rejectionNote?.message}
              </p>
            )}
          </div>
          {rejectState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(rejectState.error as { data?: { error?: { message?: string } } }).data?.error?.message ?? "Failed to reject leave request."}
            </div>
          )}
        </form>
      </GlobalModal>

      <ConfirmDialog
        open={modal.kind === "cancel"}
        onOpenChange={(o) => !o && closeModal()}
        title="Cancel leave request"
        variant="destructive"
        description={
          modal.kind === "cancel"
            ? `Cancelling your ${modal.leave.leaveType?.name ?? "leave"} request from ${modal.leave.startDate} to ${modal.leave.endDate}. This action cannot be undone.`
            : ""
        }
        confirmText={cancelState.isLoading ? "Cancelling…" : "Cancel request"}
        loading={cancelState.isLoading}
        icon={<CalendarX2 className="w-5 h-5" />}
        onConfirm={handleCancel}
        confirmButtonClassName="bg-violet-600 hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-700"
      />
    </div>
  );
}

export default function LeavesPage() {
  return (
    <Suspense fallback={<div>Loading leave requests...</div>}>
      <LeavesPageContent />
    </Suspense>
  );
}
