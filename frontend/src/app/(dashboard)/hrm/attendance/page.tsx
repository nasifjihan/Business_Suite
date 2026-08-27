"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import {
  Clock,
  LogIn,
  LogOut,
  CalendarCheck,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  useListAttendanceQuery,
  useListEmployeesQuery,
  useSelfCheckInMutation,
  useSelfCheckOutMutation,
  useMarkAttendanceMutation,
  type AttendanceItem,
  type AttendanceStatus,
  type EmployeeItem,
} from "@/lib/api/hrmEndpoints";
import { cn } from "@/lib/utils";
import {
  PermissionGate,
  useHasPermission,
} from "@/components/auth/PermissionGate";
import { useAppSelector } from "@/store/hooks";
import { PageHeader } from "@/components/common/PageHeader";
import { GlobalTable } from "@/components/tables/GlobalTable";
import { GlobalModal } from "@/components/feedback/GlobalModal";
import { GlobalInput } from "@/components/form/GlobalInput";
import { GlobalSelect } from "@/components/form/GlobalSelect";
import { GlobalDatePicker } from "@/components/form/GlobalDatePicker";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { createColumns, type TableFeatures } from "@/lib/table-utils";
import type { ColumnDef } from "@tanstack/react-table";

const ATTENDANCE_TONE: Record<
  AttendanceStatus,
  "emerald" | "violet" | "rose" | "sky" | "teal" | "slate"
> = {
  PRESENT: "emerald",
  LATE: "violet",
  ABSENT: "rose",
  HALF_DAY: "sky",
  LEAVE: "teal",
  HOLIDAY: "slate",
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  LATE: "Late",
  ABSENT: "Absent",
  HALF_DAY: "Half Day",
  LEAVE: "Leave",
  HOLIDAY: "Holiday",
};

const CHECKIN_METHOD_OPTIONS = [
  { value: "MANUAL", label: "Manual" },
  { value: "SELF_SERVICE", label: "Self Service" },
  { value: "GEOLOCATION", label: "Geolocation" },
  { value: "QR_CODE", label: "QR Code" },
  { value: "BIOMETRIC", label: "Biometric" },
];

const checkInFormSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  method: z.string().min(1, "Method is required"),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});
type CheckInFormValues = z.infer<typeof checkInFormSchema>;

const checkOutFormSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});
type CheckOutFormValues = z.infer<typeof checkOutFormSchema>;

const markAttendanceSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  attendanceDate: z.string().min(1, "Date is required"),
  checkInAt: z.string().optional().or(z.literal("")),
  checkOutAt: z.string().optional().or(z.literal("")),
  status: z.string().min(1, "Status is required"),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});
type MarkAttendanceFormValues = z.infer<typeof markAttendanceSchema>;

function AttendancePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canMarkAttendance = useHasPermission({ one: "hrm.attendance.mark" });
  const canReadAll = useHasPermission({ one: "hrm.attendance.read_all" });
  const authUserId = useAppSelector((s) => s.auth.user?.id);

  const filters = useMemo(() => {
    const page = parseInt(searchParams?.get("page") ?? "1", 10) || 1;
    const pageSize = parseInt(searchParams?.get("pageSize") ?? "25", 10) || 25;
    return {
      page,
      pageSize,
      search: searchParams?.get("search") ?? "",
      fromDate: searchParams?.get("fromDate") || undefined,
      toDate: searchParams?.get("toDate") || undefined,
      employeeId: canReadAll ? searchParams?.get("employeeId") || undefined : undefined,
      status: searchParams?.get("status") as AttendanceStatus | undefined || undefined,
      sortBy: searchParams?.get("sortBy") ?? "attendanceDate",
      sortOrder: (searchParams?.get("sortOrder") as "asc" | "desc") ?? "desc",
    };
  }, [searchParams, canReadAll]);

  const {
    data: attendanceRes,
    isFetching,
    refetch,
  } = useListAttendanceQuery(filters, { refetchOnMountOrArgChange: true });
  const { data: employeesRes } = useListEmployeesQuery({ pageSize: 100, isActive: true });

  const attendanceItems = attendanceRes?.items ?? [];
  const meta = attendanceRes?.meta;
  const employees: EmployeeItem[] = employeesRes?.items ?? [];

  const employeeOptions = useMemo(
    () => employees.map((e) => ({
      value: e.id,
      label: `${e.employeeCode} — ${e.firstName} ${e.lastName}`,
    })),
    [employees],
  );

  const employeeById = useMemo(() => {
    const m = new Map<string, EmployeeItem>();
    employees.forEach((e) => m.set(e.id, e));
    return m;
  }, [employees]);

  const currentUserEmployeeId = useMemo(() => {
    const match = employees.find((e) => e.userId === authUserId);
    return match?.id;
  }, [employees, authUserId]);

  const statusOptions = useMemo(
    () => [
      { value: "", label: "All statuses" },
      { value: "PRESENT", label: "Present" },
      { value: "LATE", label: "Late" },
      { value: "ABSENT", label: "Absent" },
      { value: "HALF_DAY", label: "Half Day" },
      { value: "LEAVE", label: "Leave" },
      { value: "HOLIDAY", label: "Holiday" },
    ],
    [],
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
    | { kind: "checkIn" }
    | { kind: "checkOut" }
    | { kind: "mark" };
  const [modal, setModal] = useState<ModalState>({ kind: "none" });

  const [selfCheckInTrigger, selfCheckInState] = useSelfCheckInMutation();
  const [selfCheckOutTrigger, selfCheckOutState] = useSelfCheckOutMutation();
  const [markAttendanceTrigger, markAttendanceState] = useMarkAttendanceMutation();

  const checkInForm = useForm<CheckInFormValues>({
    resolver: zodResolver(checkInFormSchema),
    defaultValues: {
      employeeId: "",
      method: "MANUAL",
      note: "",
    },
    mode: "onTouched",
  });

  const checkOutForm = useForm<CheckOutFormValues>({
    resolver: zodResolver(checkOutFormSchema),
    defaultValues: {
      employeeId: "",
      note: "",
    },
    mode: "onTouched",
  });

  const markForm = useForm<MarkAttendanceFormValues>({
    resolver: zodResolver(markAttendanceSchema),
    defaultValues: {
      employeeId: "",
      attendanceDate: "",
      checkInAt: "",
      checkOutAt: "",
      status: "PRESENT",
      note: "",
    },
    mode: "onTouched",
  });

  useEffect(() => {
    if (modal.kind === "checkIn") {
      checkInForm.reset({
        employeeId: canReadAll ? "" : currentUserEmployeeId ?? "",
        method: "MANUAL",
        note: "",
      });
    } else if (modal.kind === "checkOut") {
      checkOutForm.reset({
        employeeId: canReadAll ? "" : currentUserEmployeeId ?? "",
        note: "",
      });
    } else if (modal.kind === "mark") {
      markForm.reset({
        employeeId: "",
        attendanceDate: format(new Date(), "yyyy-MM-dd"),
        checkInAt: "",
        checkOutAt: "",
        status: "PRESENT",
        note: "",
      });
    }
  }, [modal, checkInForm, checkOutForm, markForm, canReadAll, currentUserEmployeeId]);

  const onSubmitCheckIn = async (v: CheckInFormValues) => {
    const payload = {
      employeeId: v.employeeId || undefined,
      method: v.method,
      note: v.note || undefined,
    };
    const res = await selfCheckInTrigger(payload);
    if ("data" in res) {
      setModal({ kind: "none" });
    }
  };

  const onSubmitCheckOut = async (v: CheckOutFormValues) => {
    const payload = {
      employeeId: v.employeeId || undefined,
      note: v.note || undefined,
    };
    const res = await selfCheckOutTrigger(payload);
    if ("data" in res) {
      setModal({ kind: "none" });
    }
  };

  const onSubmitMark = async (v: MarkAttendanceFormValues) => {
    const payload: Partial<AttendanceItem> = {
      employeeId: v.employeeId,
      attendanceDate: v.attendanceDate,
      status: v.status as AttendanceStatus,
      note: v.note || undefined,
    };
    if (v.checkInAt) payload.checkInAt = `${v.attendanceDate}T${v.checkInAt}`;
    if (v.checkOutAt) payload.checkOutAt = `${v.attendanceDate}T${v.checkOutAt}`;
    const res = await markAttendanceTrigger(payload);
    if ("data" in res) {
      setModal({ kind: "none" });
    }
  };

  const closeModal = () => {
    setModal({ kind: "none" });
    checkInForm.reset();
    checkOutForm.reset();
    markForm.reset();
  };

  function formatTime(iso?: string) {
    if (!iso) return "—";
    try {
      const d = parseISO(iso);
      return format(d, "HH:mm");
    } catch {
      return iso;
    }
  }

  const columns: ColumnDef<TableFeatures, AttendanceItem, any>[] = useMemo(() => {
    const col = createColumns<AttendanceItem>();

    return [
      col.display({
        id: "employee",
        header: "Employee",
        cell: ({ row: { original: a } }) => {
          const fullEmp = employeeById.get(a.employeeId);
          const nested = a.employee;
          const code = fullEmp?.employeeCode ?? nested?.employeeCode;
          const first = fullEmp?.firstName ?? nested?.firstName;
          const last = fullEmp?.lastName ?? nested?.lastName;
          const deptName = fullEmp?.department?.name;
          return (
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">
                {code && first && last ? `${code} — ${first} ${last}` : a.employeeId}
              </p>
              {deptName && (
                <p className="text-xs text-muted-foreground truncate">
                  {deptName}
                </p>
              )}
            </div>
          );
        },
      }),
      col.accessor("attendanceDate", {
        id: "attendanceDate",
        header: "Date",
        enableSorting: true,
        cell: ({ getValue }) => (
          <DateDisplay date={getValue() as string} format="short" />
        ),
      }),
      col.display({
        id: "checkInAt",
        header: "Check In",
        cell: ({ row: { original: a } }) => (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <Clock className="w-3.5 h-3.5 text-emerald-500" />
            <span className="font-mono">{formatTime(a.checkInAt)}</span>
          </span>
        ),
      }),
      col.display({
        id: "checkOutAt",
        header: "Check Out",
        cell: ({ row: { original: a } }) => (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <Clock className="w-3.5 h-3.5 text-sky-500" />
            <span className="font-mono">{formatTime(a.checkOutAt)}</span>
          </span>
        ),
      }),
      col.display({
        id: "workingHours",
        header: "Working Hrs",
        cell: ({ row: { original: a } }) => {
          const wh = a.workingHours;
          const val = typeof wh === "string" ? parseFloat(wh) : wh;
          return (
            <span className="font-mono text-sm">
              {Number.isFinite(val) ? val?.toFixed(2) : "—"}
            </span>
          );
        },
      }),
      col.accessor("status", {
        id: "status",
        header: "Status",
        enableSorting: true,
        cell: ({ getValue }) => {
          const s = getValue() as AttendanceStatus;
          return (
            <StatusBadge
              tone={ATTENDANCE_TONE[s]}
              size="md"
              dot
              label={STATUS_LABEL[s] ?? s}
            />
          );
        },
      }),
      col.display({
        id: "note",
        header: "Note",
        cell: ({ row: { original: a } }) => (
          <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
            {a.note || "—"}
          </span>
        ),
      }),
    ];
  }, [employeeById]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "HRM" }, { label: "Attendance" }]}
        title="Attendance"
        description="Daily check-ins, self-service or admin-marked."
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
          </div>
        }
      />

      <PermissionGate one="hrm.attendance.mark">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            size="lg"
            className="h-auto py-6 gap-3 text-base bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
            onClick={() => setModal({ kind: "checkIn" })}
          >
            <LogIn className="w-6 h-6" />
            <div className="text-left">
              <div className="font-semibold">Check In</div>
              <div className="text-xs opacity-80">Mark arrival start</div>
            </div>
          </Button>
          <Button
            size="lg"
            className="h-auto py-6 gap-3 text-base bg-sky-600 hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-700"
            onClick={() => setModal({ kind: "checkOut" })}
          >
            <LogOut className="w-6 h-6" />
            <div className="text-left">
              <div className="font-semibold">Check Out</div>
              <div className="text-xs opacity-80">Mark departure end</div>
            </div>
          </Button>
        </div>
      </PermissionGate>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <GlobalDatePicker
            label="From Date"
            value={filters.fromDate ?? null}
            onChange={(v) => pushParams({ fromDate: v ?? "" })}
            placeholder="From"
            className="w-48"
          />
          <GlobalDatePicker
            label="To Date"
            value={filters.toDate ?? null}
            onChange={(v) => pushParams({ toDate: v ?? "" })}
            placeholder="To"
            className="w-48"
          />
          <GlobalSelect
            label="Status"
            value={filters.status ?? ""}
            onChange={(v) => pushParams({ status: v })}
            options={statusOptions}
            placeholder="All statuses"
            className="w-40"
          />
          {canReadAll ? (
            <GlobalSelect
              label="Employee"
              value={filters.employeeId ?? ""}
              onChange={(v) => pushParams({ employeeId: v })}
              options={[{ value: "", label: "All employees" }, ...employeeOptions]}
              placeholder="All employees"
              className="w-64"
            />
          ) : (
            <GlobalSelect
              label="Employee"
              value={currentUserEmployeeId ?? ""}
              onChange={() => {}}
              options={employeeOptions.filter((o) => o.value === currentUserEmployeeId)}
              placeholder="Employee"
              disabled
              className="w-64"
            />
          )}
        </div>
        <PermissionGate one="hrm.attendance.mark">
          <Button size="sm" onClick={() => setModal({ kind: "mark" })}>
            <CalendarCheck className="w-4 h-4 mr-1" /> Mark attendance
          </Button>
        </PermissionGate>
      </div>

      <GlobalTable<AttendanceItem>
        columns={columns}
        data={attendanceItems}
        meta={meta}
        serverSide
        pageSizeDefault={25}
        defaultSortBy="attendanceDate"
        defaultSortOrder="desc"
        queryResult={{
          data: attendanceRes as any,
          isFetching,
        }}
        getRowId={(a) => `${a.employeeId}-${a.attendanceDate}`}
        emptyIcon={<UserCheck className="w-10 h-10" />}
        emptyTitle="No attendance records"
        emptyDescription="No attendance found for the current filters."
        errorOnRetry={() => refetch()}
      />

      <GlobalModal
        open={modal.kind === "checkIn"}
        onOpenChange={(o) => !o && closeModal()}
        title="Check In"
        description="Record your arrival for today."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="checkin-form"
              disabled={selfCheckInState.isLoading || !canMarkAttendance}
              className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
            >
              {selfCheckInState.isLoading ? "Checking in…" : "Check In"}
            </Button>
          </div>
        }
      >
        <form
          id="checkin-form"
          onSubmit={checkInForm.handleSubmit(onSubmitCheckIn)}
          className="space-y-4"
          noValidate
        >
          <PermissionGate one="hrm.attendance.read_all">
            <GlobalSelect
              label="Employee"
              required
              value={checkInForm.watch("employeeId")}
              onChange={(v) => checkInForm.setValue("employeeId", v, { shouldValidate: true })}
              options={employeeOptions}
              placeholder="Select employee…"
              error={checkInForm.formState.errors.employeeId?.message}
            />
          </PermissionGate>
          <GlobalSelect
            label="Check-in Method"
            required
            value={checkInForm.watch("method")}
            onChange={(v) => checkInForm.setValue("method", v, { shouldValidate: true })}
            options={CHECKIN_METHOD_OPTIONS}
            placeholder="Select method…"
            error={checkInForm.formState.errors.method?.message}
          />
          <GlobalInput
            label="Note (optional)"
            placeholder="Add any note…"
            error={checkInForm.formState.errors.note?.message}
            {...checkInForm.register("note")}
          />
          {selfCheckInState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(selfCheckInState.error as { data?: { error?: { message?: string } } }).data?.error?.message ?? "Failed to check in."}
            </div>
          )}
        </form>
      </GlobalModal>

      <GlobalModal
        open={modal.kind === "checkOut"}
        onOpenChange={(o) => !o && closeModal()}
        title="Check Out"
        description="Record your departure for today."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="checkout-form"
              disabled={selfCheckOutState.isLoading || !canMarkAttendance}
              className="bg-sky-600 hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-700"
            >
              {selfCheckOutState.isLoading ? "Checking out…" : "Check Out"}
            </Button>
          </div>
        }
      >
        <form
          id="checkout-form"
          onSubmit={checkOutForm.handleSubmit(onSubmitCheckOut)}
          className="space-y-4"
          noValidate
        >
          <PermissionGate one="hrm.attendance.read_all">
            <GlobalSelect
              label="Employee"
              required
              value={checkOutForm.watch("employeeId")}
              onChange={(v) => checkOutForm.setValue("employeeId", v, { shouldValidate: true })}
              options={employeeOptions}
              placeholder="Select employee…"
              error={checkOutForm.formState.errors.employeeId?.message}
            />
          </PermissionGate>
          <GlobalInput
            label="Note (optional)"
            placeholder="Add any note…"
            error={checkOutForm.formState.errors.note?.message}
            {...checkOutForm.register("note")}
          />
          {selfCheckOutState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(selfCheckOutState.error as { data?: { error?: { message?: string } } }).data?.error?.message ?? "Failed to check out."}
            </div>
          )}
        </form>
      </GlobalModal>

      <GlobalModal
        open={modal.kind === "mark"}
        onOpenChange={(o) => !o && closeModal()}
        title="Mark Attendance"
        description="Manually create or update an attendance record."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="mark-form"
              disabled={markAttendanceState.isLoading || !canMarkAttendance}
            >
              {markAttendanceState.isLoading ? "Saving…" : "Save attendance"}
            </Button>
          </div>
        }
      >
        <form
          id="mark-form"
          onSubmit={markForm.handleSubmit(onSubmitMark)}
          className="space-y-4"
          noValidate
        >
          <GlobalSelect
            label="Employee"
            required
            value={markForm.watch("employeeId")}
            onChange={(v) => markForm.setValue("employeeId", v, { shouldValidate: true })}
            options={employeeOptions}
            placeholder="Select employee…"
            error={markForm.formState.errors.employeeId?.message}
          />
          <GlobalDatePicker
            label="Attendance Date"
            required
            value={markForm.watch("attendanceDate")}
            onChange={(v) => markForm.setValue("attendanceDate", v ?? "", { shouldValidate: true })}
            placeholder="Pick date"
            error={markForm.formState.errors.attendanceDate?.message}
          />
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Check-in time (HH:mm)"
              placeholder="09:00"
              error={markForm.formState.errors.checkInAt?.message}
              {...markForm.register("checkInAt")}
            />
            <GlobalInput
              label="Check-out time (HH:mm)"
              placeholder="17:00"
              error={markForm.formState.errors.checkOutAt?.message}
              {...markForm.register("checkOutAt")}
            />
          </div>
          <GlobalSelect
            label="Status"
            required
            value={markForm.watch("status")}
            onChange={(v) => markForm.setValue("status", v, { shouldValidate: true })}
            options={statusOptions.filter((o) => o.value !== "")}
            placeholder="Select status…"
            error={markForm.formState.errors.status?.message}
          />
          <GlobalInput
            label="Note (optional)"
            placeholder="Add any note…"
            error={markForm.formState.errors.note?.message}
            {...markForm.register("note")}
          />
          {markAttendanceState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(markAttendanceState.error as { data?: { error?: { message?: string } } }).data?.error?.message ?? "Failed to mark attendance."}
            </div>
          )}
        </form>
      </GlobalModal>
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<div>Loading attendance...</div>}>
      <AttendancePageContent />
    </Suspense>
  );
}
