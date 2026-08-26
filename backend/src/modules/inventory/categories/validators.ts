import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";

export const CreateCategorySchema = z.object({
  name: z.string().trim().min(1),
  parentId: z.string().uuid().optional(),
  description: z.string().trim().optional(),
});
export type CreateCategoryDto = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = z.object({
  name: z.string().trim().min(1).optional(),
  parentId: z.string().uuid().optional(),
  description: z.string().trim().optional(),
});
export type UpdateCategoryDto = z.infer<typeof UpdateCategorySchema>;

export const ListCategoriesSchema = PaginationSchema.extend({
  search: z.string().optional(),
  parentId: z.string().uuid().optional(),
});
export type ListCategoriesQuery = z.infer<typeof ListCategoriesSchema>;
