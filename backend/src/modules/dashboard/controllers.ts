import type { Request, Response, NextFunction } from "express";
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
  async summary(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await DashboardService.summary(req);
      return successResponse(res, data, 200, "Dashboard summary retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async salesTrend(req: Request, res: Response, next: NextFunction) {
    try {
      const q = salesTrendQuery.parse(req.query);
      const data = await DashboardService.salesTrend(q.period);
      return successResponse(res, data, 200, "Sales trend retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async topProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const q = topProductsQuery.parse(req.query);
      const data = await DashboardService.topProducts(q.limit);
      return successResponse(res, data, 200, "Top products retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async leadPipeline(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await DashboardService.leadPipeline();
      return successResponse(res, data, 200, "Lead pipeline retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async attendanceSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const q = attendanceSummaryQuery.parse(req.query);
      const data = await DashboardService.attendanceSummary(q.date);
      return successResponse(res, data, 200, "Attendance summary retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async recentOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const q = recentOrdersQuery.parse(req.query);
      const data = await DashboardService.recentOrders(q.limit);
      return successResponse(res, data, 200, "Recent orders retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async recentActivities(req: Request, res: Response, next: NextFunction) {
    try {
      const q = recentActivitiesQuery.parse(req.query);
      const data = await DashboardService.recentActivities(q.limit);
      return successResponse(res, data, 200, "Recent activities retrieved successfully");
    } catch (e) {
      next(e);
    }
  },
};
