import type { Request, Response } from "express";
import { LeaveService } from "./services";
import { successResponse } from "@/lib/response";
import type {
  ApproveLeaveDto,
  CancelLeaveDto,
  CreateLeaveDto,
  ListLeavesQuery,
  RejectLeaveDto,
  UpdateLeaveDto,
} from "./validators";

export const LeavesController = {
  async list(req: Request, res: Response) {
    const result = await LeaveService.list(req.query as unknown as ListLeavesQuery, req);
    return successResponse(res, result, 200, "Leave requests retrieved successfully");
  },

  async getById(req: Request, res: Response) {
    const id = req.params.id as string;
    const result = await LeaveService.getById(id, req);
    return successResponse(res, result, 200, "Leave request retrieved successfully");
  },

  async create(req: Request, res: Response) {
    const { leave } = await LeaveService.create(req.body as CreateLeaveDto, req);
    return successResponse(res, leave, 201, "Leave request created successfully");
  },

  async update(req: Request, res: Response) {
    const id = req.params.id as string;
    const updated = await LeaveService.update(id, req.body as UpdateLeaveDto, req);
    return successResponse(res, updated, 200, "Leave request updated successfully");
  },

  async approve(req: Request, res: Response) {
    const id = req.params.id as string;
    const approved = await LeaveService.approve(id, req.body as ApproveLeaveDto, req);
    return successResponse(res, approved, 200, "Leave request approved successfully");
  },

  async reject(req: Request, res: Response) {
    const id = req.params.id as string;
    const rejected = await LeaveService.reject(id, req.body as RejectLeaveDto, req);
    return successResponse(res, rejected, 200, "Leave request rejected successfully");
  },

  async cancel(req: Request, res: Response) {
    const id = req.params.id as string;
    const cancelled = await LeaveService.cancel(id, req.body as CancelLeaveDto, req);
    return successResponse(res, cancelled, 200, "Leave request cancelled successfully");
  },

  async remove(req: Request, res: Response) {
    const id = req.params.id as string;
    await LeaveService.remove(id, req);
    return successResponse(res, { deleted: true }, 200, "Leave request deleted successfully");
  },
};
