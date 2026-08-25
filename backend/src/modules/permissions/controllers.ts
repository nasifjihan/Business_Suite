import type { Request, Response } from "express";
import { PermissionService } from "./services";
import { successResponse } from "@/lib/response";

export const PermissionsController = {
  async listGrouped(_req: Request, res: Response) {
    const result = await PermissionService.listAllGrouped();
    return successResponse(res, result, 200, "Permissions retrieved successfully");
  },

  async listFlat(_req: Request, res: Response) {
    const result = await PermissionService.listFlat();
    return successResponse(res, result, 200, "Permissions retrieved successfully");
  },
};
