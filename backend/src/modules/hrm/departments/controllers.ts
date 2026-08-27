import type { Request, Response } from "express";
import { DepartmentService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListDepartmentsQuery } from "./validators";

export const DepartmentsController = {
  async list(req: Request, res: Response) {
    const result = await DepartmentService.list(req.query as unknown as ListDepartmentsQuery);
    return successResponse(res, result, 200, "Departments retrieved successfully");
  },

  async create(req: Request, res: Response) {
    const { department } = await DepartmentService.create(req.body, req);
    return successResponse(res, department, 201, "Department created successfully");
  },

  async getById(req: Request, res: Response) {
    const id = req.params.id as string;
    const result = await DepartmentService.getById(id);
    return successResponse(res, result, 200, "Department retrieved successfully");
  },

  async update(req: Request, res: Response) {
    const id = req.params.id as string;
    const updated = await DepartmentService.update(id, req.body, req);
    return successResponse(res, updated, 200, "Department updated successfully");
  },

  async remove(req: Request, res: Response) {
    const id = req.params.id as string;
    await DepartmentService.softDelete(id, req);
    return successResponse(res, { deleted: true, softDelete: true }, 200, "Department deleted successfully");
  },
};
