import type { Request, Response, NextFunction } from "express";
import { AttendanceService } from "./services";
import { successResponse } from "@/lib/response";
import type { ListAttendanceQuery } from "./validators";

export const AttendanceController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AttendanceService.list(req.query as unknown as ListAttendanceQuery, req);
      return successResponse(res, result, 200, "Attendance records retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async getByEmployeeAndDate(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId, attendanceDate } = req.params;
      const result = await AttendanceService.getByEmployeeAndDate(
        employeeId as string,
        new Date(attendanceDate as string),
        req,
      );
      return successResponse(res, result, 200, "Attendance record retrieved successfully");
    } catch (e) {
      next(e);
    }
  },

  async selfCheckIn(req: Request, res: Response, next: NextFunction) {
    try {
      const { attendance } = await AttendanceService.selfCheckIn(req.body, req);
      return successResponse(res, attendance, 200, "Check-in recorded successfully");
    } catch (e) {
      next(e);
    }
  },

  async selfCheckOut(req: Request, res: Response, next: NextFunction) {
    try {
      const { attendance } = await AttendanceService.selfCheckOut(req.body, req);
      return successResponse(res, attendance, 200, "Check-out recorded successfully");
    } catch (e) {
      next(e);
    }
  },

  async adminCreate(req: Request, res: Response, next: NextFunction) {
    try {
      const { attendance } = await AttendanceService.adminCreate(req.body, req);
      return successResponse(res, attendance, 201, "Attendance record created successfully");
    } catch (e) {
      next(e);
    }
  },

  async adminUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId, attendanceDate } = req.params;
      const updated = await AttendanceService.adminUpdate(
        employeeId as string,
        new Date(attendanceDate as string),
        req.body,
        req,
      );
      return successResponse(res, updated, 200, "Attendance record updated successfully");
    } catch (e) {
      next(e);
    }
  },

  async adminDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId, attendanceDate } = req.params;
      await AttendanceService.adminDelete(
        employeeId as string,
        new Date(attendanceDate as string),
        req,
      );
      return successResponse(res, { deleted: true }, 200, "Attendance record deleted successfully");
    } catch (e) {
      next(e);
    }
  },
};
