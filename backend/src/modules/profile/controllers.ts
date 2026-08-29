import type { Request, Response, NextFunction } from "express";
import { ProfileService } from "./services";
import { UserService } from "@/modules/users/services";
import { successResponse } from "@/lib/response";

export const ProfileController = {
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return successResponse(res, null, 401);
      const profile = await ProfileService.get(req.user.id);
      return successResponse(res, profile, 200, "Profile retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return successResponse(res, null, 401);
      const updated = await ProfileService.update(req.user.id, req.body, req);
      return successResponse(res, updated, 200, "Profile updated successfully");
    } catch (e) {
      next(e);
    }
  },

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return successResponse(res, null, 401);
      await UserService.changeOwnPassword(req.user.id, req.body, req);
      return successResponse(res, null, 200, "Password changed successfully. Existing sessions on other devices have been revoked.");
    } catch (e) {
      next(e);
    }
  },
};
