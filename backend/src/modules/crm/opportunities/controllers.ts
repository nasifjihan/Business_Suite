import type { Request, Response } from "express";
import { OpportunityService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListOppsQuery } from "./validators";

export const OpportunitiesController = {
  async list(req: Request, res: Response) {
    const result = await OpportunityService.list(req.query as unknown as ListOppsQuery);
    return successResponse(res, result, 200, "Opportunities retrieved successfully");
  },

  async create(req: Request, res: Response) {
    const created = await OpportunityService.create(req.body, req);
    return successResponse(res, created, 201, "Opportunity created successfully");
  },

  async getById(req: Request, res: Response) {
    const id = req.params.id as string;
    const result = await OpportunityService.getById(id, true);
    return successResponse(res, result, 200, "Opportunity retrieved successfully");
  },

  async update(req: Request, res: Response) {
    const id = req.params.id as string;
    const updated = await OpportunityService.update(id, req.body, req);
    return successResponse(res, updated, 200, "Opportunity updated successfully");
  },

  async remove(req: Request, res: Response) {
    const id = req.params.id as string;
    await OpportunityService.remove(id, req);
    return successResponse(res, { deleted: true }, 200, "Opportunity deleted successfully");
  },

  async patchStage(req: Request, res: Response) {
    const id = req.params.id as string;
    const updated = await OpportunityService.patchStage(id, req.body.stage, req.body.note, req);
    return successResponse(res, updated, 200, "Opportunity stage updated successfully");
  },
};
