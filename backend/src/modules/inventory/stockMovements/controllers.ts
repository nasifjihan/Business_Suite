import type { Request, Response, NextFunction } from "express";
import { StockMovementsService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListMovementsQuery } from "./validators";

export const StockMovementsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await StockMovementsService.list(req.query as unknown as ListMovementsQuery);
      return successResponse(res, result, 200, "Stock movements retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async createMovement(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await StockMovementsService.create(req.body, req);
      return successResponse(res, result, 201, "Stock movement created successfully");
    } catch (e) {
      next(e);
    }
  },

  async createTransfer(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await StockMovementsService.transfer(req.body, req);
      return successResponse(res, result, 201, "Stock transfer completed successfully");
    } catch (e) {
      next(e);
    }
  },

  async getMovement(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await StockMovementsService.getById(id);
      return successResponse(res, result, 200, "Stock movement retrieved successfully");
    } catch (e) {
      next(e);
    }
  },
};
