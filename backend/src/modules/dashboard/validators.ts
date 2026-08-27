import { z } from "zod";

export const salesTrendQuery = z.object({
  period: z.enum(["week", "month", "quarter", "year"]).default("week"),
});
export type SalesTrendQuery = z.infer<typeof salesTrendQuery>;

export const topProductsQuery = z.object({
  limit: z.coerce.number().min(1).max(20).default(10),
});
export type TopProductsQuery = z.infer<typeof topProductsQuery>;

export const attendanceSummaryQuery = z.object({
  date: z.coerce.date().optional(),
});
export type AttendanceSummaryQuery = z.infer<typeof attendanceSummaryQuery>;

export const recentOrdersQuery = z.object({
  limit: z.coerce.number().min(1).max(20).default(10),
});
export type RecentOrdersQuery = z.infer<typeof recentOrdersQuery>;

export const recentActivitiesQuery = z.object({
  limit: z.coerce.number().min(1).max(30).default(15),
});
export type RecentActivitiesQuery = z.infer<typeof recentActivitiesQuery>;
