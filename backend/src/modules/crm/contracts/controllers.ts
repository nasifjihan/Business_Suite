import type { Request, Response } from "express";
import { ContractService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListContractsQuery } from "./validators";

export const ContractsController = {
  async list(req: Request, res: Response) {
    const result = await ContractService.list(req.query as unknown as ListContractsQuery);
    return successResponse(res, result, 200, "Contracts retrieved successfully");
  },

  async create(req: Request, res: Response) {
    const created = await ContractService.create(req.body, req);
    return successResponse(res, created, 201, "Contract created successfully");
  },

  async getById(req: Request, res: Response) {
    const id = req.params.id as string;
    const result = await ContractService.getById(id);
    return successResponse(res, result, 200, "Contract retrieved successfully");
  },

  async update(req: Request, res: Response) {
    const id = req.params.id as string;
    const updated = await ContractService.update(id, req.body, req);
    return successResponse(res, updated, 200, "Contract updated successfully");
  },

  async remove(req: Request, res: Response) {
    const id = req.params.id as string;
    await ContractService.remove(id, req);
    return successResponse(res, { deleted: true }, 200, "Contract deleted successfully");
  },
};
