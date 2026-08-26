import type { Request, Response } from "express";
import { ProductService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListLowStockQuery, ListProductsQuery } from "./validators";

export const ProductsController = {
  async list(req: Request, res: Response) {
    const result = await ProductService.list(req.query as unknown as ListProductsQuery);
    return successResponse(res, result, 200, "Products retrieved successfully");
  },

  async listLowStock(req: Request, res: Response) {
    const result = await ProductService.listLowStockProducts(req.query as unknown as ListLowStockQuery);
    return successResponse(res, result, 200, "Low stock products retrieved successfully");
  },

  async create(req: Request, res: Response) {
    const { product } = await ProductService.create(req.body, req);
    return successResponse(res, product, 201, "Product created successfully");
  },

  async getById(req: Request, res: Response) {
    const id = req.params.id as string;
    const result = await ProductService.getById(id);
    return successResponse(res, result, 200, "Product retrieved successfully");
  },

  async stockSummary(req: Request, res: Response) {
    const id = req.params.id as string;
    const result = await ProductService.stockSummary(id);
    return successResponse(res, result, 200, "Product stock summary retrieved successfully");
  },

  async update(req: Request, res: Response) {
    const id = req.params.id as string;
    const updated = await ProductService.update(id, req.body, req);
    return successResponse(res, updated, 200, "Product updated successfully");
  },

  async remove(req: Request, res: Response) {
    const id = req.params.id as string;
    await ProductService.remove(id, req);
    return successResponse(res, { deleted: true }, 200, "Product deleted successfully");
  },
};
