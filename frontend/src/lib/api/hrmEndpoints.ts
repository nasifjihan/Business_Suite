import { apiSlice } from "./apiSlice";

export interface DepartmentItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  managerId?: string;
  manager?: { id: string; firstName: string; lastName: string };
  location?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DesignationItem {
  id: string;
  code: string;
  name: string;
  departmentId: string;
  department?: { id: string; name: string };
  description?: string;
  isActive: boolean;
  createdAt?: string;
}

export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN";
export type EmploymentStatus = "ACTIVE" | "INACTIVE" | "ON_LEAVE" | "TERMINATED" | "SUSPENDED" | "PROBATION";

export interface EmployeeItem {
  id: string;
  employeeCode: string;
  userId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  joiningDate: string;
  departmentId: string;
  department?: { id: string; name: string };
  designationId: string;
  designation?: { id: string; name: string };
  managerId?: string;
  manager?: { id: string; firstName: string; lastName: string; employeeCode?: string };
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  salary?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyRelationship?: string;
  createdAt?: string;
}

export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "HALF_DAY" | "LEAVE" | "HOLIDAY";

export interface AttendanceItem {
  employeeId: string;
  attendanceDate: string;
  employee?: { id: string; firstName: string; lastName: string; employeeCode: string };
  checkInAt?: string;
  checkOutAt?: string;
  workingHours?: string | number;
  status: AttendanceStatus;
  checkInMethod?: string;
  note?: string;
}

export type LeaveRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type LeaveAccrualUnit = "DAYS" | "HOURS";

export interface LeaveTypeItem {
  id: string;
  code: string;
  name: string;
  defaultDays: number;
  accrualUnit: LeaveAccrualUnit;
  carryOverLimit: number;
  requiresAttachment: boolean;
  isActive: boolean;
  description?: string;
}

export interface LeaveItem {
  id: string;
  employeeId: string;
  employee?: { id: string; firstName: string; lastName: string; employeeCode: string };
  leaveTypeId: string;
  leaveType?: { id: string; name: string; code: string };
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
  status: LeaveRequestStatus;
  approverId?: string;
  approver?: { id: string; firstName: string; lastName: string };
  approvedAt?: string;
  rejectionNote?: string;
  attachmentUrl?: string;
  canceledAt?: string;
  createdAt?: string;
}

export interface HRReportSummary {
  headcount: number;
  onLeaveToday: number;
  attendanceTodayPct: number;
  pendingLeaves: number;
  todayByStatus: { status: AttendanceStatus; count: number }[];
  upcomingAnniversaries: { id: string; name: string; code: string; joiningDate: string; yearsService: number }[];
  recentJoiners: { id: string; name: string; code: string; joiningDate: string; departmentName?: string }[];
}

const HRM_URL_PREFIX = "/hrm";

/**
 * Every HRM controller answers through `successResponse`, i.e. with the shared
 * `{ success, data, message }` envelope — while the hooks below are typed as
 * the *unwrapped* payload. Peeling `.data` in one place keeps those declared
 * types honest; the alternative (each page digging into `res.data.data`) is how
 * the leave/attendance tables and the HR overview counters silently rendered
 * empty while the API returned rows.
 */
const unwrap = (raw: unknown): any => (raw as { data: unknown } | undefined)?.data;

export const hrmEndpoints = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listDepartments: builder.query<{ items: DepartmentItem[]; meta: any }, any>({
      query: (params) => ({ url: `${HRM_URL_PREFIX}/departments`, params }),
      transformResponse: unwrap,
      providesTags: [{ type: "Departments", id: "LIST" }],
    }),
    getDepartment: builder.query<DepartmentItem, string>({
      query: (id) => `${HRM_URL_PREFIX}/departments/${id}`,
      transformResponse: unwrap,
      providesTags: (r, e, id) => [{ type: "Departments", id }],
    }),
    createDepartment: builder.mutation<DepartmentItem, Record<string, any>>({
      query: (body) => ({ url: `${HRM_URL_PREFIX}/departments`, method: "POST", body }),
      transformResponse: unwrap,
      invalidatesTags: [{ type: "Departments", id: "LIST" }, { type: "Employees" }],
    }),
    updateDepartment: builder.mutation<DepartmentItem, { id: string; body: Record<string, any> }>({
      query: ({ id, body }) => ({ url: `${HRM_URL_PREFIX}/departments/${id}`, method: "PATCH", body }),
      transformResponse: unwrap,
      invalidatesTags: (r, e, { id }) => [
        { type: "Departments", id: "LIST" },
        { type: "Departments", id },
        { type: "Employees" },
      ],
    }),
    deleteDepartment: builder.mutation<void, string>({
      query: (id) => ({ url: `${HRM_URL_PREFIX}/departments/${id}`, method: "DELETE" }),
      transformResponse: unwrap,
      invalidatesTags: [{ type: "Departments", id: "LIST" }],
    }),

    listDesignations: builder.query<{ items: DesignationItem[]; meta: any }, any>({
      query: (params) => ({ url: `${HRM_URL_PREFIX}/designations`, params }),
      transformResponse: unwrap,
      providesTags: [{ type: "Designations", id: "LIST" }],
    }),
    createDesignation: builder.mutation<DesignationItem, Record<string, any>>({
      query: (body) => ({ url: `${HRM_URL_PREFIX}/designations`, method: "POST", body }),
      transformResponse: unwrap,
      invalidatesTags: [{ type: "Designations", id: "LIST" }],
    }),
    updateDesignation: builder.mutation<DesignationItem, { id: string; body: Record<string, any> }>({
      query: ({ id, body }) => ({ url: `${HRM_URL_PREFIX}/designations/${id}`, method: "PATCH", body }),
      transformResponse: unwrap,
      invalidatesTags: (r, e, { id }) => [
        { type: "Designations", id: "LIST" },
        { type: "Designations", id },
        { type: "Employees" },
      ],
    }),
    deleteDesignation: builder.mutation<void, string>({
      query: (id) => ({ url: `${HRM_URL_PREFIX}/designations/${id}`, method: "DELETE" }),
      transformResponse: unwrap,
      invalidatesTags: [{ type: "Designations", id: "LIST" }],
    }),

    listEmployees: builder.query<{ items: EmployeeItem[]; meta: any }, any>({
      query: (params) => ({ url: `${HRM_URL_PREFIX}/employees`, params }),
      transformResponse: unwrap,
      providesTags: [{ type: "Employees", id: "LIST" }],
    }),
    getEmployee: builder.query<EmployeeItem, string>({
      query: (id) => `${HRM_URL_PREFIX}/employees/${id}`,
      transformResponse: unwrap,
      providesTags: (r, e, id) => [{ type: "Employees", id }],
    }),
    createEmployee: builder.mutation<EmployeeItem, Record<string, any>>({
      query: (body) => ({ url: `${HRM_URL_PREFIX}/employees`, method: "POST", body }),
      transformResponse: unwrap,
      invalidatesTags: [
        { type: "Employees", id: "LIST" },
        { type: "Departments", id: "LIST" },
        { type: "HRReports", id: "SUMMARY" },
      ],
    }),
    updateEmployee: builder.mutation<EmployeeItem, { id: string; body: Record<string, any> }>({
      query: ({ id, body }) => ({ url: `${HRM_URL_PREFIX}/employees/${id}`, method: "PATCH", body }),
      transformResponse: unwrap,
      invalidatesTags: (r, e, { id }) => [
        { type: "Employees", id: "LIST" },
        { type: "Employees", id },
        { type: "HRReports", id: "SUMMARY" },
      ],
    }),
    deleteEmployee: builder.mutation<void, string>({
      query: (id) => ({ url: `${HRM_URL_PREFIX}/employees/${id}`, method: "DELETE" }),
      transformResponse: unwrap,
      invalidatesTags: [{ type: "Employees", id: "LIST" }, { type: "HRReports", id: "SUMMARY" }],
    }),

    listAttendance: builder.query<{ items: AttendanceItem[]; meta: any }, any>({
      query: (params) => ({ url: `${HRM_URL_PREFIX}/attendance`, params }),
      transformResponse: unwrap,
      providesTags: [{ type: "AttendanceRecords", id: "LIST" }],
    }),
    selfCheckIn: builder.mutation<AttendanceItem, { employeeId?: string; method?: string; note?: string }>({
      query: (body) => ({ url: `${HRM_URL_PREFIX}/attendance/self/check-in`, method: "POST", body }),
      transformResponse: unwrap,
      invalidatesTags: [
        { type: "AttendanceRecords", id: "LIST" },
        { type: "HRReports", id: "SUMMARY" },
      ],
    }),
    selfCheckOut: builder.mutation<AttendanceItem, { employeeId?: string; note?: string }>({
      query: (body) => ({ url: `${HRM_URL_PREFIX}/attendance/self/check-out`, method: "POST", body }),
      transformResponse: unwrap,
      invalidatesTags: [
        { type: "AttendanceRecords", id: "LIST" },
        { type: "HRReports", id: "SUMMARY" },
      ],
    }),
    markAttendance: builder.mutation<AttendanceItem, Partial<AttendanceItem>>({
      query: (body) => ({ url: `${HRM_URL_PREFIX}/attendance`, method: "POST", body }),
      transformResponse: unwrap,
      invalidatesTags: [
        { type: "AttendanceRecords", id: "LIST" },
        { type: "HRReports", id: "SUMMARY" },
      ],
    }),
    updateAttendance: builder.mutation<
      AttendanceItem,
      { employeeId: string; attendanceDate: string; body: Partial<AttendanceItem> }
    >({
      query: ({ employeeId, attendanceDate, body }) => ({
        url: `${HRM_URL_PREFIX}/attendance/${employeeId}/${attendanceDate}`,
        method: "PATCH",
        body,
      }),
      transformResponse: unwrap,
      invalidatesTags: [{ type: "AttendanceRecords", id: "LIST" }, { type: "HRReports", id: "SUMMARY" }],
    }),

    listLeaveTypes: builder.query<{ items: LeaveTypeItem[]; meta?: any }, any>({
      query: (params) => ({ url: `${HRM_URL_PREFIX}/leave-types`, params }),
      transformResponse: unwrap,
      providesTags: [{ type: "LeaveTypes", id: "LIST" }],
    }),
    createLeaveType: builder.mutation<LeaveTypeItem, Partial<LeaveTypeItem>>({
      query: (body) => ({ url: `${HRM_URL_PREFIX}/leave-types`, method: "POST", body }),
      transformResponse: unwrap,
      invalidatesTags: [{ type: "LeaveTypes", id: "LIST" }],
    }),
    updateLeaveType: builder.mutation<LeaveTypeItem, { id: string; body: Partial<LeaveTypeItem> }>({
      query: ({ id, body }) => ({ url: `${HRM_URL_PREFIX}/leave-types/${id}`, method: "PATCH", body }),
      transformResponse: unwrap,
      invalidatesTags: (r, e, { id }) => [
        { type: "LeaveTypes", id: "LIST" },
        { type: "LeaveTypes", id },
      ],
    }),
    deleteLeaveType: builder.mutation<void, string>({
      query: (id) => ({ url: `${HRM_URL_PREFIX}/leave-types/${id}`, method: "DELETE" }),
      transformResponse: unwrap,
      invalidatesTags: [{ type: "LeaveTypes", id: "LIST" }],
    }),

    listLeaves: builder.query<{ items: LeaveItem[]; meta: any }, any>({
      query: (params) => ({ url: `${HRM_URL_PREFIX}/leaves`, params }),
      transformResponse: unwrap,
      providesTags: [{ type: "Leaves", id: "LIST" }],
    }),
    createLeave: builder.mutation<LeaveItem, Partial<LeaveItem>>({
      query: (body) => ({ url: `${HRM_URL_PREFIX}/leaves`, method: "POST", body }),
      transformResponse: unwrap,
      invalidatesTags: [
        { type: "Leaves", id: "LIST" },
        { type: "HRReports", id: "SUMMARY" },
      ],
    }),
    // Approve / reject / cancel are PATCH on the API: they are partial updates
    // of an existing leave request, not the creation of a new resource.
    approveLeave: builder.mutation<LeaveItem, { id: string; note?: string }>({
      query: ({ id, note }) => ({ url: `${HRM_URL_PREFIX}/leaves/${id}/approve`, method: "PATCH", body: { note } }),
      transformResponse: unwrap,
      invalidatesTags: (r, e, { id }) => [
        { type: "Leaves", id: "LIST" },
        { type: "Leaves", id },
        { type: "AttendanceRecords", id: "LIST" },
        { type: "HRReports", id: "SUMMARY" },
      ],
    }),
    rejectLeave: builder.mutation<LeaveItem, { id: string; rejectionNote: string }>({
      query: ({ id, rejectionNote }) => ({
        url: `${HRM_URL_PREFIX}/leaves/${id}/reject`,
        method: "PATCH",
        // The API calls this field `rejectReason`; the UI label reads
        // "Rejection Note", so the rename happens here rather than leaking the
        // API's spelling into the form.
        body: { rejectReason: rejectionNote },
      }),
      transformResponse: unwrap,
      invalidatesTags: (r, e, { id }) => [
        { type: "Leaves", id: "LIST" },
        { type: "Leaves", id },
        { type: "HRReports", id: "SUMMARY" },
      ],
    }),
    cancelLeave: builder.mutation<LeaveItem, string>({
      query: (id) => ({ url: `${HRM_URL_PREFIX}/leaves/${id}/cancel`, method: "PATCH" }),
      transformResponse: unwrap,
      invalidatesTags: (r, e, id) => [
        { type: "Leaves", id: "LIST" },
        { type: "Leaves", id },
        { type: "AttendanceRecords", id: "LIST" },
        { type: "HRReports", id: "SUMMARY" },
      ],
    }),

    getHRReportSummary: builder.query<HRReportSummary, { date?: string; departmentId?: string }>({
      query: (params) => ({
        url: `${HRM_URL_PREFIX}/reports/summary`,
        params,
      }),
      transformResponse: unwrap,
      providesTags: [{ type: "HRReports", id: "SUMMARY" }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListDepartmentsQuery,
  useLazyListDepartmentsQuery,
  useGetDepartmentQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,

  useListDesignationsQuery,
  useLazyListDesignationsQuery,
  useCreateDesignationMutation,
  useUpdateDesignationMutation,
  useDeleteDesignationMutation,

  useListEmployeesQuery,
  useLazyListEmployeesQuery,
  useGetEmployeeQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,

  useListAttendanceQuery,
  useLazyListAttendanceQuery,
  useSelfCheckInMutation,
  useSelfCheckOutMutation,
  useMarkAttendanceMutation,
  useUpdateAttendanceMutation,

  useListLeaveTypesQuery,
  useCreateLeaveTypeMutation,
  useUpdateLeaveTypeMutation,
  useDeleteLeaveTypeMutation,

  useListLeavesQuery,
  useLazyListLeavesQuery,
  useCreateLeaveMutation,
  useApproveLeaveMutation,
  useRejectLeaveMutation,
  useCancelLeaveMutation,

  useGetHRReportSummaryQuery,
} = hrmEndpoints;
