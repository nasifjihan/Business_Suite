import type { Request, Response } from "express";
import { AuditLogService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListAuditLogsQuery } from "./validators";

export const AuditLogsController = {
  async list(req: Request, res: Response) {
    const result = await AuditLogService.list(req.query as unknown as ListAuditLogsQuery);
    return successResponse(res, result, 200, "Audit logs retrieved successfully");
  },
};
