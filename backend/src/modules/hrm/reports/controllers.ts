import type { Request, Response, NextFunction } from "express";
import { successResponse } from "@/lib/response";
import { ReportService } from "./services";

export const ReportsController = {
  async summary(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await ReportService.summary(req);
      return successResponse(res, summary, 200, "HR summary report retrieved successfully");
    } catch (e) {
      next(e);
    }
  },
};
