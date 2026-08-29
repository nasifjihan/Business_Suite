import type { Request, Response, NextFunction } from "express";
import { RoleService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListRolesQuery } from "./validators";

export const RolesController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await RoleService.list(req.query as unknown as ListRolesQuery);
      return successResponse(res, result, 200, "Roles retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const created = await RoleService.create(req.body, req);
      return successResponse(res, created, 201, "Role created successfully");
    } catch (e) {
      next(e);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const updated = await RoleService.update(id, req.body, req);
      return successResponse(res, updated, 200, "Role updated successfully");
    } catch (e) {
      next(e);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await RoleService.delete(id, req);
      return successResponse(res, null, 200, "Role deleted successfully");
    } catch (e) {
      next(e);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const role = await RoleService.getById(id);
      return successResponse(res, role, 200, "Role retrieved successfully");
    } catch (e) {
      next(e);
    }
  },
};
