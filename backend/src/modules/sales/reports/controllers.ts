import type { Request, Response } from "express";
import { DailySalesService } from "./services";
import { successResponse } from "@/lib/response";
import type { DailySalesSummaryQuery } from "./validators";

export const ReportsController = {
  async dailySummary(req: Request, res: Response) {
    const result = await DailySalesService.summary(req.query as unknown as DailySalesSummaryQuery);
    return successResponse(res, result, 200, "Daily sales summary retrieved successfully");
  },
};
