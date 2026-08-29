import type { Request, Response, NextFunction } from "express";
import { ContactService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListContactsQuery } from "./validators";

export const ContactsController = {
  async listByCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = req.params.customerId as string;
      const result = await ContactService.listByCustomer(customerId, req.query as unknown as ListContactsQuery);
      return successResponse(res, result, 200, "Contacts retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async createForCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = req.params.customerId as string;
      const contact = await ContactService.createForCustomer(customerId, req.body, req);
      return successResponse(res, contact, 201, "Contact created successfully");
    } catch (e) {
      next(e);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await ContactService.getById(id);
      return successResponse(res, result, 200, "Contact retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const updated = await ContactService.update(id, req.body, req);
      return successResponse(res, updated, 200, "Contact updated successfully");
    } catch (e) {
      next(e);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await ContactService.remove(id, req);
      return successResponse(res, { deleted: true }, 200, "Contact deleted successfully");
    } catch (e) {
      next(e);
    }
  },
};
