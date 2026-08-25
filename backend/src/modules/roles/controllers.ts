import type { Request, Response } from "express";
import { RoleService } from "./services";
import { successResponse } from "@/lib/response";

export const RolesController = {
  async list(req: Request, res: Response) {
    const result = await RoleService.list(req.query as Parameters<typeof RoleService.list>[0]);
    return successResponse(res, result, 200, "Roles retrieved successfully");
  },

  async create(req: Request, res: Response) {
    const created = await RoleService.create(req.body, req);
    return successResponse(res, created, 201, "Role created successfully");
  },

  async update(req: Request, res: Response) {
    const updated = await RoleService.update(req.params.id, req.body, req);
    return successResponse(res, updated, 200, "Role updated successfully");
  },

  async remove(req: Request, res: Response) {
    await RoleService.delete(req.params.id, req);
    return successResponse(res, null, 200, "Role deleted successfully");
  },

  async getById(req: Request, res: Response) {
    const role = await RoleService.getById(req.params.id);
    return successResponse(res, role, 200, "Role retrieved successfully");
  },
};
