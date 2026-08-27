import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";
import { UserStatus } from "@prisma/client";

export const CreateLeaveTypeSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(100),
  defaultDays: z.coerce.number().int().min(0).default(10),
  maxCarryOver: z.coerce.number().int().min(0).default(0),
  requiresDocuments: z.boolean().default(false),
  status: z.nativeEnum(UserStatus).optional(),
  description: z.string().trim().optional(),
});
export type CreateLeaveTypeDto = z.infer<typeof CreateLeaveTypeSchema>;

export const UpdateLeaveTypeSchema = z.object({
  code: z.string().trim().min(1).max(50).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  defaultDays: z.coerce.number().int().min(0).optional(),
  maxCarryOver: z.coerce.number().int().min(0).optional(),
  requiresDocuments: z.boolean().optional(),
  status: z.nativeEnum(UserStatus).optional(),
  description: z.string().trim().optional().nullable(),
});
export type UpdateLeaveTypeDto = z.infer<typeof UpdateLeaveTypeSchema>;

export const ListLeaveTypesSchema = PaginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  sortBy: z.enum(["code", "name", "defaultDays", "status", "createdAt"]).optional(),
});
export type ListLeaveTypesQuery = z.infer<typeof ListLeaveTypesSchema>;
