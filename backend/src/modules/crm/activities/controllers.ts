import type { Request, Response, NextFunction } from "express";
import { ActivityService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListActivitiesQuery } from "./validators";

export const ActivitiesController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ActivityService.list(req.query as unknown as ListActivitiesQuery);
      return successResponse(res, result, 200, "Activities retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const created = await ActivityService.create(req.body, req);
      return successResponse(res, created, 201, "Activity created successfully");
    } catch (e) {
      next(e);
    }
  },
};
