import type { Request, Response, NextFunction } from "express";
import { HealthService } from "./services";
import { successResponse } from "../../lib/response";

export const healthCheck = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await HealthService.getStatus();
    const code = data.db === "connected" ? 200 : 503;
    successResponse(res, data, code);
  } catch (e) {
    next(e);
  }
};
