import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";

export const CreateRoleSchema = z.object({
  name: z.string().trim().min(2).max(50),
  displayName: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  permissionCodes: z.array(z.string().trim().min(3).max(100)).optional(),
});
export type CreateRoleDto = z.infer<typeof CreateRoleSchema>;

export const UpdateRoleSchema = z.object({
  name: z.string().trim().min(2).max(50).optional(),
  displayName: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  permissionCodes: z.array(z.string().trim().min(3).max(100)).optional(),
});
export type UpdateRoleDto = z.infer<typeof UpdateRoleSchema>;

export const ListRolesSchema = PaginationSchema;
export type ListRolesQuery = z.infer<typeof ListRolesSchema>;
