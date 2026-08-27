import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";
import { UserStatus } from "@prisma/client";

export const CreateDepartmentSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().min(1).optional(),
  managerId: z.string().uuid().optional(),
  description: z.string().trim().optional(),
  status: z.nativeEnum(UserStatus).optional(),
});
export type CreateDepartmentDto = z.infer<typeof CreateDepartmentSchema>;

export const UpdateDepartmentSchema = z.object({
  name: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
  managerId: z.string().uuid().optional(),
  description: z.string().trim().optional(),
  status: z.nativeEnum(UserStatus).optional(),
});
export type UpdateDepartmentDto = z.infer<typeof UpdateDepartmentSchema>;

export const ListDepartmentsSchema = PaginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  isActive: z.coerce.boolean().optional(),
});
export type ListDepartmentsQuery = z.infer<typeof ListDepartmentsSchema>;
