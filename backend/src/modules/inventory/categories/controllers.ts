import type { Request, Response, NextFunction } from "express";
import { CategoryService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListCategoriesQuery } from "./validators";

export const CategoriesController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await CategoryService.list(req.query as unknown as ListCategoriesQuery);
      return successResponse(res, result, 200, "Categories retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { category } = await CategoryService.create(req.body, req);
      return successResponse(res, category, 201, "Category created successfully");
    } catch (e) {
      next(e);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await CategoryService.getById(id);
      return successResponse(res, result, 200, "Category retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const updated = await CategoryService.update(id, req.body, req);
      return successResponse(res, updated, 200, "Category updated successfully");
    } catch (e) {
      next(e);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await CategoryService.remove(id, req);
      return successResponse(res, { deleted: true }, 200, "Category deleted successfully");
    } catch (e) {
      next(e);
    }
  },
};
