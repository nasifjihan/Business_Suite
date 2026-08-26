import type { Request, Response } from "express";
import { LeadService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListLeadsQuery } from "./validators";

export const LeadsController = {
  async list(req: Request, res: Response) {
    const result = await LeadService.list(req.query as unknown as ListLeadsQuery);
    return successResponse(res, result, 200, "Leads retrieved successfully");
  },

  async create(req: Request, res: Response) {
    const created = await LeadService.create(req.body, req);
    return successResponse(res, created, 201, "Lead created successfully");
  },

  async getById(req: Request, res: Response) {
    const id = req.params.id as string;
    const result = await LeadService.getById(id, true);
    return successResponse(res, result, 200, "Lead retrieved successfully");
  },

  async update(req: Request, res: Response) {
    const id = req.params.id as string;
    const updated = await LeadService.update(id, req.body, req);
    return successResponse(res, updated, 200, "Lead updated successfully");
  },

  async remove(req: Request, res: Response) {
    const id = req.params.id as string;
    await LeadService.remove(id, req);
    return successResponse(res, { deleted: true }, 200, "Lead deleted successfully");
  },

  async convertLead(req: Request, res: Response) {
    const id = req.params.id as string;
    const result = await LeadService.convertLead(id, req.body, req);
    return successResponse(res, result, 200, "Lead converted successfully");
  },
};
