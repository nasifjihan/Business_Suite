import type { Request, Response } from "express";
import { CustomerCreditService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListCreditsQuery } from "./validators";

export const CreditsController = {
  async list(req: Request, res: Response) {
    const result = await CustomerCreditService.listCredits(req.query as unknown as ListCreditsQuery);
    return successResponse(res, result, 200, "Customer credits retrieved successfully");
  },

  async adjust(req: Request, res: Response) {
    const result = await CustomerCreditService.adjust(req.body, req);
    return successResponse(res, result, 200, "Customer credit adjusted successfully");
  },
};
