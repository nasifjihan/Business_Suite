import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";
import { MovementType } from "@prisma/client";

const UUID = z.string().uuid();

export const CreateMovementSchema = z.object({
  movementType: z.nativeEnum(MovementType),
  productId: UUID,
  warehouseId: UUID,
  quantity: z.coerce.number().int().positive(),
  reference: z.string().trim().max(255).optional().or(z.literal("")),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});
export type CreateMovementDto = z.infer<typeof CreateMovementSchema>;

export const TransferSchema = z.object({
  fromWarehouseId: UUID,
  toWarehouseId: UUID,
  productId: UUID,
  quantity: z.coerce.number().int().positive(),
  reference: z.string().trim().max(255).optional().or(z.literal("")),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});
export type TransferDto = z.infer<typeof TransferSchema>;

export const ListMovementsSchema = PaginationSchema.extend({
  movementType: z.nativeEnum(MovementType).optional(),
  productId: UUID.optional(),
  warehouseId: UUID.optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});
export type ListMovementsQuery = z.infer<typeof ListMovementsSchema>;

export const GetMovementSchema = z.object({
  id: UUID,
});
export type GetMovementParams = z.infer<typeof GetMovementSchema>;
