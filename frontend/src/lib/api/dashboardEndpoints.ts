import { apiSlice } from "./apiSlice";

export type DashboardSummary = any;
export type SalesTrendPoint = any;
export type TopProductRow = any;
export type LeadPipelineRow = any;
export type AttendanceSummaryRow = any;
export type RecentOrderRow = any;
export type RecentActivity = any;
export type DashboardPeriod = "week" | "month" | "quarter" | "year";

export const dashboardEndpoints = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardSummary: builder.query<DashboardSummary, Record<string, any> | void>({
      query: () => ({ url: `/dashboard/summary` }),
      providesTags: ["DashboardKPIs"],
      keepUnusedDataFor: 30,
    }),
    getDashboardSalesTrend: builder.query<SalesTrendPoint[], DashboardPeriod>({
      query: (period: DashboardPeriod = "week") => ({
        url: `/dashboard/sales-trend?period=${period}`,
      }),
      providesTags: ["DashboardKPIs"],
      keepUnusedDataFor: 30,
    }),
    getDashboardTopProducts: builder.query<TopProductRow[], number | void>({
      query: (limit = 10) => ({ url: `/dashboard/top-products?limit=${limit}` }),
      providesTags: ["DashboardKPIs"],
      keepUnusedDataFor: 30,
    }),
    getDashboardLeadPipeline: builder.query<LeadPipelineRow[], Record<string, any> | void>({
      query: () => ({ url: `/dashboard/lead-pipeline` }),
      providesTags: ["DashboardKPIs"],
      keepUnusedDataFor: 30,
    }),
    getDashboardAttendanceSummary: builder.query<AttendanceSummaryRow[], string | void>({
      query: (date) => ({
        url: date
          ? `/dashboard/attendance-summary?date=${date}`
          : `/dashboard/attendance-summary`,
      }),
      providesTags: ["DashboardKPIs"],
      keepUnusedDataFor: 30,
    }),
    getDashboardRecentOrders: builder.query<RecentOrderRow[], number | void>({
      query: (limit = 10) => ({ url: `/dashboard/recent-orders?limit=${limit}` }),
      providesTags: ["DashboardKPIs"],
      keepUnusedDataFor: 30,
    }),
    getDashboardRecentActivities: builder.query<RecentActivity[], number | void>({
      query: (limit = 15) => ({ url: `/dashboard/recent-activities?limit=${limit}` }),
      providesTags: ["DashboardKPIs"],
      keepUnusedDataFor: 30,
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetDashboardSummaryQuery,
  useLazyGetDashboardSummaryQuery,
  useGetDashboardSalesTrendQuery,
  useLazyGetDashboardSalesTrendQuery,
  useGetDashboardTopProductsQuery,
  useLazyGetDashboardTopProductsQuery,
  useGetDashboardLeadPipelineQuery,
  useLazyGetDashboardLeadPipelineQuery,
  useGetDashboardAttendanceSummaryQuery,
  useLazyGetDashboardAttendanceSummaryQuery,
  useGetDashboardRecentOrdersQuery,
  useLazyGetDashboardRecentOrdersQuery,
  useGetDashboardRecentActivitiesQuery,
  useLazyGetDashboardRecentActivitiesQuery,
} = dashboardEndpoints;
