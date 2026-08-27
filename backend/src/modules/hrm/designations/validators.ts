import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";

export const CreateDesignationSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().min(1).optional(),
  departmentId: z.string().uuid().optional(),
  description: z.string().trim().optional(),
});
export type CreateDesignationDto = z.infer<typeof CreateDesignationSchema>;

export const UpdateDesignationSchema = z.object({
  name: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
  departmentId: z.string().uuid().optional(),
  description: z.string().trim().optional(),
});
export type UpdateDesignationDto = z.infer<typeof UpdateDesignationSchema>;

export const ListDesignationsSchema = PaginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  departmentId: z.string().uuid().optional(),
});
export type ListDesignationsQuery = z.infer<typeof ListDesignationsSchema>;
