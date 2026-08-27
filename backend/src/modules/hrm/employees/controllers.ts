import type { Request, Response } from "express";
import { EmployeeService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListEmployeesQuery } from "./validators";

export const EmployeesController = {
  async list(req: Request, res: Response) {
    const result = await EmployeeService.list(req.query as unknown as ListEmployeesQuery, req);
    return successResponse(res, result, 200, "Employees retrieved successfully");
  },

  async create(req: Request, res: Response) {
    const { employee } = await EmployeeService.create(req.body, req);
    return successResponse(res, employee, 201, "Employee created successfully");
  },

  async getById(req: Request, res: Response) {
    const id = req.params.id as string;
    const result = await EmployeeService.getById(id, req);
    return successResponse(res, result, 200, "Employee retrieved successfully");
  },

  async update(req: Request, res: Response) {
    const id = req.params.id as string;
    const updated = await EmployeeService.update(id, req.body, req);
    return successResponse(res, updated, 200, "Employee updated successfully");
  },

  async remove(req: Request, res: Response) {
    const id = req.params.id as string;
    await EmployeeService.remove(id, req);
    return successResponse(res, { deleted: true }, 200, "Employee deleted successfully");
  },
};
