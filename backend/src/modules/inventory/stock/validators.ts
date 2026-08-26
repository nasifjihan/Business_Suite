import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";

const UUID = z.string().uuid();

export const ListStockSchema = PaginationSchema.extend({
  productId: UUID.optional(),
  warehouseId: UUID.optional(),
  lowOnly: z.coerce.boolean().optional(),
});
export type ListStockQuery = z.infer<typeof ListStockSchema>;

export const GetStockByKeySchema = z.object({
  productId: UUID,
  warehouseId: UUID,
});
export type GetStockByKeyParams = z.infer<typeof GetStockByKeySchema>;
