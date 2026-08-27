import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";
import { LeaveStatus } from "@prisma/client";

export const CreateLeaveSchema = z.object({
  employeeId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  halfDay: z.boolean().default(false),
  reason: z.string().trim().min(1),
  supportingDoc: z.string().trim().optional(),
});
export type CreateLeaveDto = z.infer<typeof CreateLeaveSchema>;

export const UpdateLeaveSchema = z.object({
  leaveTypeId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  halfDay: z.boolean().optional(),
  reason: z.string().trim().min(1).optional(),
  supportingDoc: z.string().trim().optional().nullable(),
});
export type UpdateLeaveDto = z.infer<typeof UpdateLeaveSchema>;

export const ApproveLeaveSchema = z.object({});
export type ApproveLeaveDto = z.infer<typeof ApproveLeaveSchema>;

export const RejectLeaveSchema = z.object({
  rejectReason: z.string().trim().min(1),
});
export type RejectLeaveDto = z.infer<typeof RejectLeaveSchema>;

export const CancelLeaveSchema = z.object({});
export type CancelLeaveDto = z.infer<typeof CancelLeaveSchema>;

export const ListLeavesSchema = PaginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  employeeId: z.string().uuid().optional(),
  leaveTypeId: z.string().uuid().optional(),
  status: z.nativeEnum(LeaveStatus).optional(),
  startDateFrom: z.coerce.date().optional(),
  startDateTo: z.coerce.date().optional(),
  endDateFrom: z.coerce.date().optional(),
  endDateTo: z.coerce.date().optional(),
  sortBy: z.enum(["startDate", "endDate", "status", "totalDays", "createdAt"]).optional(),
});
export type ListLeavesQuery = z.infer<typeof ListLeavesSchema>;
