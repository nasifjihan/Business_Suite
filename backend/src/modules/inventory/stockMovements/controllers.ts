import type { Request, Response } from "express";
import { StockMovementsService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListMovementsQuery } from "./validators";

export const StockMovementsController = {
  async list(req: Request, res: Response) {
    const result = await StockMovementsService.list(req.query as unknown as ListMovementsQuery);
    return successResponse(res, result, 200, "Stock movements retrieved successfully");
  },

  async createMovement(req: Request, res: Response) {
    const result = await StockMovementsService.create(req.body, req);
    return successResponse(res, result, 201, "Stock movement created successfully");
  },

  async createTransfer(req: Request, res: Response) {
    const result = await StockMovementsService.transfer(req.body, req);
    return successResponse(res, result, 201, "Stock transfer completed successfully");
  },

  async getMovement(req: Request, res: Response) {
    const id = req.params.id as string;
    const result = await StockMovementsService.getById(id);
    return successResponse(res, result, 200, "Stock movement retrieved successfully");
  },
};
