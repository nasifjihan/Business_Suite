import type { Request, Response } from "express";
import { WarehouseService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListWarehousesQuery } from "./validators";

export const WarehousesController = {
  async list(req: Request, res: Response) {
    const result = await WarehouseService.list(req.query as unknown as ListWarehousesQuery);
    return successResponse(res, result, 200, "Warehouses retrieved successfully");
  },

  async create(req: Request, res: Response) {
    const { warehouse } = await WarehouseService.create(req.body, req);
    return successResponse(res, warehouse, 201, "Warehouse created successfully");
  },

  async getById(req: Request, res: Response) {
    const id = req.params.id as string;
    const result = await WarehouseService.getById(id);
    return successResponse(res, result, 200, "Warehouse retrieved successfully");
  },

  async update(req: Request, res: Response) {
    const id = req.params.id as string;
    const updated = await WarehouseService.update(id, req.body, req);
    return successResponse(res, updated, 200, "Warehouse updated successfully");
  },

  async remove(req: Request, res: Response) {
    const id = req.params.id as string;
    await WarehouseService.softRemove(id, req);
    return successResponse(res, { deleted: true }, 200, "Warehouse deactivated successfully");
  },
};
