import type { Request, Response } from "express";
import { successResponse } from "@/lib/response";
import { DashboardService } from "./services";
import {
  salesTrendQuery,
  topProductsQuery,
  attendanceSummaryQuery,
  recentOrdersQuery,
  recentActivitiesQuery,
} from "./validators";

export const DashboardController = {
  async summary(req: Request, res: Response) {
    const data = await DashboardService.summary(req);
    return successResponse(res, data, 200, "Dashboard summary retrieved successfully");
  },

  async salesTrend(req: Request, res: Response) {
    const q = salesTrendQuery.parse(req.query);
    const data = await DashboardService.salesTrend(q.period);
    return successResponse(res, data, 200, "Sales trend retrieved successfully");
  },

  async topProducts(req: Request, res: Response) {
    const q = topProductsQuery.parse(req.query);
    const data = await DashboardService.topProducts(q.limit);
    return successResponse(res, data, 200, "Top products retrieved successfully");
  },

  async leadPipeline(_req: Request, res: Response) {
    const data = await DashboardService.leadPipeline();
    return successResponse(res, data, 200, "Lead pipeline retrieved successfully");
  },

  async attendanceSummary(req: Request, res: Response) {
    const q = attendanceSummaryQuery.parse(req.query);
    const data = await DashboardService.attendanceSummary(q.date);
    return successResponse(res, data, 200, "Attendance summary retrieved successfully");
  },

  async recentOrders(req: Request, res: Response) {
    const q = recentOrdersQuery.parse(req.query);
    const data = await DashboardService.recentOrders(q.limit);
    return successResponse(res, data, 200, "Recent orders retrieved successfully");
  },

  async recentActivities(req: Request, res: Response) {
    const q = recentActivitiesQuery.parse(req.query);
    const data = await DashboardService.recentActivities(q.limit);
    return successResponse(res, data, 200, "Recent activities retrieved successfully");
  },
};
