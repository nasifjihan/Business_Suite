import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";

export const CreateWarehouseSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().optional().transform((v) => (v ? v.toUpperCase() : v)),
  location: z.string().trim().optional(),
  isActive: z.boolean().optional().default(true),
});
export type CreateWarehouseDto = z.infer<typeof CreateWarehouseSchema>;

export const UpdateWarehouseSchema = z.object({
  name: z.string().trim().min(1).optional(),
  code: z.string().trim().optional().transform((v) => (v ? v.toUpperCase() : v)),
  location: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateWarehouseDto = z.infer<typeof UpdateWarehouseSchema>;

export const ListWarehousesSchema = PaginationSchema.extend({
  search: z.string().optional(),
  isActive: z.boolean().optional(),
});
export type ListWarehousesQuery = z.infer<typeof ListWarehousesSchema>;
