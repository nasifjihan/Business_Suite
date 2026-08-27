import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";
import { ProductStatus } from "@prisma/client";

export const CreateProductSchema = z.object({
  name: z.string().trim().min(1),
  barcode: z.string().trim().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.nativeEnum(ProductStatus).optional().default(ProductStatus.ACTIVE),
  description: z.string().trim().optional(),
  costPrice: z.coerce.number().gte(0),
  unitPrice: z.coerce.number().gte(0),
  unitOfMeasure: z.string().trim().default("EACH"),
  weightKg: z.coerce.number().positive().optional(),
}).strict();
export type CreateProductDto = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = z.object({
  name: z.string().trim().min(1).optional(),
  barcode: z.string().trim().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  description: z.string().trim().optional(),
  costPrice: z.coerce.number().gte(0).optional(),
  unitPrice: z.coerce.number().gte(0).optional(),
  unitOfMeasure: z.string().trim().optional(),
  weightKg: z.coerce.number().positive().optional(),
}).strict();
export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;

export const ListProductsSchema = PaginationSchema.extend({
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  sortBy: z.enum(["name", "unitPrice", "status", "createdAt"]).optional(),
}).strip();
export type ListProductsQuery = z.infer<typeof ListProductsSchema>;

export const ListLowStockSchema = PaginationSchema.extend({
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
}).strip();
export type ListLowStockQuery = z.infer<typeof ListLowStockSchema>;
