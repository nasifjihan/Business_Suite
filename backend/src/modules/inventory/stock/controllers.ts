import type { Request, Response } from "express";
import { StockService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListStockQuery } from "./validators";

export const StockController = {
  async list(req: Request, res: Response) {
    const result = await StockService.list(req.query as unknown as ListStockQuery);
    return successResponse(res, result, 200, "Stock records retrieved successfully");
  },

  async getByKey(req: Request, res: Response) {
    const { productId, warehouseId } = req.params as { productId: string; warehouseId: string };
    const result = await StockService.getByCompositeKey(productId, warehouseId);
    return successResponse(res, result, 200, "Stock record retrieved successfully");
  },
};
