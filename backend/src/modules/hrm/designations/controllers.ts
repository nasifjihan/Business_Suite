import type { Request, Response } from "express";
import { DesignationService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListDesignationsQuery } from "./validators";

export const DesignationsController = {
  async list(req: Request, res: Response) {
    const result = await DesignationService.list(req.query as unknown as ListDesignationsQuery);
    return successResponse(res, result, 200, "Designations retrieved successfully");
  },

  async create(req: Request, res: Response) {
    const { designation } = await DesignationService.create(req.body, req);
    return successResponse(res, designation, 201, "Designation created successfully");
  },

  async getById(req: Request, res: Response) {
    const id = req.params.id as string;
    const result = await DesignationService.getById(id);
    return successResponse(res, result, 200, "Designation retrieved successfully");
  },

  async update(req: Request, res: Response) {
    const id = req.params.id as string;
    const updated = await DesignationService.update(id, req.body, req);
    return successResponse(res, updated, 200, "Designation updated successfully");
  },

  async remove(req: Request, res: Response) {
    const id = req.params.id as string;
    await DesignationService.remove(id, req);
    return successResponse(res, { deleted: true }, 200, "Designation deleted successfully");
  },
};
