import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";
import { AttendanceStatus } from "@prisma/client";

export const CheckInSchema = z.object({
  attendanceDate: z.coerce.date().optional(),
  checkInAt: z.coerce.date().optional(),
  checkInNote: z.string().trim().optional(),
});
export type CheckInDto = z.infer<typeof CheckInSchema>;

export const SelfCheckInSchema = z.object({
  attendanceDate: z.coerce.date().optional(),
  checkInNote: z.string().trim().optional(),
});
export type SelfCheckInDto = z.infer<typeof SelfCheckInSchema>;

export const CheckOutSchema = z.object({
  attendanceDate: z.coerce.date().optional(),
  checkOutAt: z.coerce.date().optional(),
  checkOutNote: z.string().trim().optional(),
});
export type CheckOutDto = z.infer<typeof CheckOutSchema>;

export const SelfCheckOutSchema = z.object({
  attendanceDate: z.coerce.date().optional(),
  checkOutNote: z.string().trim().optional(),
});
export type SelfCheckOutDto = z.infer<typeof SelfCheckOutSchema>;

export const CreateAttendanceSchema = z.object({
  employeeId: z.string().uuid(),
  attendanceDate: z.coerce.date(),
  checkInAt: z.coerce.date().optional(),
  checkOutAt: z.coerce.date().optional(),
  status: z.nativeEnum(AttendanceStatus).optional().default(AttendanceStatus.ABSENT),
  workHours: z.coerce.number().gte(0).optional(),
  checkInNote: z.string().trim().optional(),
  checkOutNote: z.string().trim().optional(),
});
export type CreateAttendanceDto = z.infer<typeof CreateAttendanceSchema>;

export const UpdateAttendanceSchema = z.object({
  checkInAt: z.coerce.date().optional().nullable(),
  checkOutAt: z.coerce.date().optional().nullable(),
  status: z.nativeEnum(AttendanceStatus).optional(),
  workHours: z.coerce.number().gte(0).optional().nullable(),
  checkInNote: z.string().trim().optional(),
  checkOutNote: z.string().trim().optional(),
});
export type UpdateAttendanceDto = z.infer<typeof UpdateAttendanceSchema>;

export const ListAttendanceSchema = PaginationSchema.extend({
  search: z.string().optional(),
  employeeId: z.string().uuid().optional(),
  status: z.nativeEnum(AttendanceStatus).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  sortBy: z.enum(["attendanceDate", "checkInAt", "checkOutAt", "status", "createdAt"]).optional(),
});
export type ListAttendanceQuery = z.infer<typeof ListAttendanceSchema>;

export const GetByEmployeeAndDateSchema = z.object({
  employeeId: z.string().uuid(),
  attendanceDate: z.coerce.date(),
});
export type GetByEmployeeAndDateQuery = z.infer<typeof GetByEmployeeAndDateSchema>;
