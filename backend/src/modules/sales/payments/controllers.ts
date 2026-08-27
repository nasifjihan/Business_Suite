import type { Request, Response } from "express";
import { PaymentService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListPaymentsQuery } from "./validators";

export const PaymentsController = {
  async list(req: Request, res: Response) {
    const result = await PaymentService.list(req.query as unknown as ListPaymentsQuery);
    return successResponse(res, result, 200, "Payments retrieved successfully");
  },

  async create(req: Request, res: Response) {
    const payment = await PaymentService.create(req.body, req);
    return successResponse(res, payment, 201, "Payment created successfully");
  },

  async getById(req: Request, res: Response) {
    const id = req.params.id as string;
    const result = await PaymentService.getById(id);
    return successResponse(res, result, 200, "Payment retrieved successfully");
  },
};
