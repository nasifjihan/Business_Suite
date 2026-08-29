import type { Request, Response, NextFunction } from "express";
import { LeadService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListLeadsQuery } from "./validators";

export const LeadsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await LeadService.list(req.query as unknown as ListLeadsQuery);
      return successResponse(res, result, 200, "Leads retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const created = await LeadService.create(req.body, req);
      return successResponse(res, created, 201, "Lead created successfully");
    } catch (e) {
      next(e);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await LeadService.getById(id, true);
      return successResponse(res, result, 200, "Lead retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const updated = await LeadService.update(id, req.body, req);
      return successResponse(res, updated, 200, "Lead updated successfully");
    } catch (e) {
      next(e);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await LeadService.remove(id, req);
      return successResponse(res, { deleted: true }, 200, "Lead deleted successfully");
    } catch (e) {
      next(e);
    }
  },

  async convertLead(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await LeadService.convertLead(id, req.body, req);
      return successResponse(res, result, 200, "Lead converted successfully");
    } catch (e) {
      next(e);
    }
  },
};
