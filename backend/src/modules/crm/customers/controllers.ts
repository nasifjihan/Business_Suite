import type { Request, Response, NextFunction } from "express";
import { CustomerService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListCustomersQuery } from "./validators";

export const CustomersController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await CustomerService.list(req.query as unknown as ListCustomersQuery);
      return successResponse(res, result, 200, "Customers retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { customer } = await CustomerService.create(req.body, req);
      return successResponse(res, customer, 201, "Customer created successfully");
    } catch (e) {
      next(e);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await CustomerService.getById(id, true, true);
      return successResponse(res, result, 200, "Customer retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const updated = await CustomerService.update(id, req.body, req);
      return successResponse(res, updated, 200, "Customer updated successfully");
    } catch (e) {
      next(e);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await CustomerService.remove(id, req);
      return successResponse(res, { deleted: true }, 200, "Customer deleted successfully");
    } catch (e) {
      next(e);
    }
  },
};
