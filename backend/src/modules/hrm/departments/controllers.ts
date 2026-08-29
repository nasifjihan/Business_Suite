import type { Request, Response, NextFunction } from "express";
import { DepartmentService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListDepartmentsQuery } from "./validators";

export const DepartmentsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await DepartmentService.list(req.query as unknown as ListDepartmentsQuery);
      return successResponse(res, result, 200, "Departments retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { department } = await DepartmentService.create(req.body, req);
      return successResponse(res, department, 201, "Department created successfully");
    } catch (e) {
      next(e);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await DepartmentService.getById(id);
      return successResponse(res, result, 200, "Department retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const updated = await DepartmentService.update(id, req.body, req);
      return successResponse(res, updated, 200, "Department updated successfully");
    } catch (e) {
      next(e);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await DepartmentService.softDelete(id, req);
      return successResponse(res, { deleted: true, softDelete: true }, 200, "Department deleted successfully");
    } catch (e) {
      next(e);
    }
  },
};
