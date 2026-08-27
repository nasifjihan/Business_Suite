import type { Request, Response } from "express";
import { OrderService } from "./services";
import { successResponse } from "@/lib/response";
import type { CreateOrderCheckoutDto, ListOrdersQuery, UpdateOrderStatusDto } from "./validators";

export const OrdersController = {
  async list(req: Request, res: Response) {
    const result = await OrderService.list(req.query as unknown as ListOrdersQuery);
    return successResponse(res, result, 200, "Orders retrieved successfully");
  },

  async getById(req: Request, res: Response) {
    const id = req.params.id as string;
    const result = await OrderService.getById(id);
    return successResponse(res, result, 200, "Order retrieved successfully");
  },

  async checkout(req: Request, res: Response) {
    const result = await OrderService.checkout(req.body as CreateOrderCheckoutDto, req);
    return successResponse(res, result, 201, "Order checkout completed successfully");
  },

  async updateStatus(req: Request, res: Response) {
    const id = req.params.id as string;
    const updated = await OrderService.updateStatus(id, req.body as UpdateOrderStatusDto, req);
    return successResponse(res, updated, 200, "Order status updated successfully");
  },

  async remove(req: Request, res: Response) {
    const id = req.params.id as string;
    await OrderService.remove(id, req);
    return successResponse(res, { deleted: true }, 200, "Order deleted successfully");
  },
};
