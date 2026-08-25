import type { Request, Response } from "express";
import { AuditLogService } from "./services";
import { successResponse } from "@/lib/response";

export const AuditLogsController = {
  async list(req: Request, res: Response) {
    const result = await AuditLogService.list(req.query as Parameters<typeof AuditLogService.list>[0]);
    return successResponse(res, result, 200, "Audit logs retrieved successfully");
  },
};
