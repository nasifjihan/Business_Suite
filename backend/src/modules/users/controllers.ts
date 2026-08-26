import type { Request, Response } from "express";
import { UserService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListUsersQuery } from "./validators";

export const UsersController = {
  async list(req: Request, res: Response) {
    const result = await UserService.list(req.query as unknown as ListUsersQuery);
    return successResponse(res, result, 200, "Users retrieved successfully");
  },

  async create(req: Request, res: Response) {
    const { user, tempPassword } = await UserService.create(req.body, req);
    return successResponse(
      res,
      { user, temporaryPassword: tempPassword },
      201,
      "User created successfully. The temporary password is shown ONCE in this response — share it securely.",
    );
  },

  async update(req: Request, res: Response) {
    const id = req.params.id as string;
    const updated = await UserService.update(id, req.body, req);
    return successResponse(res, updated, 200, "User updated successfully");
  },

  async activate(req: Request, res: Response) {
    const id = req.params.id as string;
    const updated = await UserService.setStatus(id, "ACTIVE" as const, req);
    return successResponse(res, updated, 200, "User activated");
  },

  async deactivate(req: Request, res: Response) {
    const id = req.params.id as string;
    const updated = await UserService.setStatus(id, "INACTIVE" as const, req);
    return successResponse(res, updated, 200, "User deactivated — all existing sessions have been revoked.");
  },

  async getById(req: Request, res: Response) {
    const id = req.params.id as string;
    const result = await UserService.getMe(id);
    return successResponse(res, result, 200, "User retrieved successfully");
  },
};
