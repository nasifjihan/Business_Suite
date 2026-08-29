import type { Request, Response, NextFunction } from "express";
import { EmployeeService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListEmployeesQuery } from "./validators";

export const EmployeesController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await EmployeeService.list(req.query as unknown as ListEmployeesQuery, req);
      return successResponse(res, result, 200, "Employees retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { employee } = await EmployeeService.create(req.body, req);
      return successResponse(res, employee, 201, "Employee created successfully");
    } catch (e) {
      next(e);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await EmployeeService.getById(id, req);
      return successResponse(res, result, 200, "Employee retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const updated = await EmployeeService.update(id, req.body, req);
      return successResponse(res, updated, 200, "Employee updated successfully");
    } catch (e) {
      next(e);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await EmployeeService.remove(id, req);
      return successResponse(res, { deleted: true }, 200, "Employee deleted successfully");
    } catch (e) {
      next(e);
    }
  },
};
