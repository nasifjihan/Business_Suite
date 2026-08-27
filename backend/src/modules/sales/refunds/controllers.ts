import type { Request, Response } from "express";
import { RefundService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListRefundsQuery } from "./validators";

export const RefundsController = {
  async list(req: Request, res: Response) {
    const result = await RefundService.list(req.query as unknown as ListRefundsQuery);
    return successResponse(res, result, 200, "Refunds retrieved successfully");
  },

  async create(req: Request, res: Response) {
    const refund = await RefundService.create(req.body, req);
    return successResponse(res, refund, 201, "Refund created successfully");
  },

  async getById(req: Request, res: Response) {
    const id = req.params.id as string;
    const result = await RefundService.getById(id);
    return successResponse(res, result, 200, "Refund retrieved successfully");
  },
};
