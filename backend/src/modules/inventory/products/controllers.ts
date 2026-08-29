import type { Request, Response, NextFunction } from "express";
import { ProductService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListLowStockQuery, ListProductsQuery } from "./validators";

export const ProductsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductService.list(req.query as unknown as ListProductsQuery);
      return successResponse(res, result, 200, "Products retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async listLowStock(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ProductService.listLowStockProducts(req.query as unknown as ListLowStockQuery);
      return successResponse(res, result, 200, "Low stock products retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { product } = await ProductService.create(req.body, req);
      return successResponse(res, product, 201, "Product created successfully");
    } catch (e) {
      next(e);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await ProductService.getById(id);
      return successResponse(res, result, 200, "Product retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async stockSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await ProductService.stockSummary(id);
      return successResponse(res, result, 200, "Product stock summary retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const updated = await ProductService.update(id, req.body, req);
      return successResponse(res, updated, 200, "Product updated successfully");
    } catch (e) {
      next(e);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await ProductService.remove(id, req);
      return successResponse(res, { deleted: true }, 200, "Product deleted successfully");
    } catch (e) {
      next(e);
    }
  },
};
