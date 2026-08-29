import type { Request, Response, NextFunction } from "express";
import { LeaveTypeService } from "./services";
import { successResponse } from "@/lib/response";
import type { CreateLeaveTypeDto, ListLeaveTypesQuery, UpdateLeaveTypeDto } from "./validators";

export const LeaveTypesController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await LeaveTypeService.list(req.query as unknown as ListLeaveTypesQuery);
      return successResponse(res, result, 200, "Leave types retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await LeaveTypeService.getById(id);
      return successResponse(res, result, 200, "Leave type retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { leaveType } = await LeaveTypeService.create(req.body as CreateLeaveTypeDto, req);
      return successResponse(res, leaveType, 201, "Leave type created successfully");
    } catch (e) {
      next(e);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const updated = await LeaveTypeService.update(id, req.body as UpdateLeaveTypeDto, req);
      return successResponse(res, updated, 200, "Leave type updated successfully");
    } catch (e) {
      next(e);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await LeaveTypeService.remove(id, req);
      return successResponse(res, { deleted: true }, 200, "Leave type deleted successfully");
    } catch (e) {
      next(e);
    }
  },
};
