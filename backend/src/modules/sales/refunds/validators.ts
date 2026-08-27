import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";
import { RefundReason } from "@prisma/client";

export const RefundItemSchema = z.object({
  orderItemId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().min(0).optional(),
});

export const CreateRefundSchema = z.object({
  orderId: z.string().uuid(),
  paymentId: z.string().uuid().optional(),
  items: z.array(RefundItemSchema).min(1),
  reason: z.nativeEnum(RefundReason),
  restock: z.boolean().default(true),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type CreateRefundDto = z.infer<typeof CreateRefundSchema>;
export type RefundItemDto = z.infer<typeof RefundItemSchema>;

export const ListRefundsSchema = PaginationSchema.extend({
  orderId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  reason: z.nativeEnum(RefundReason).optional(),
  restock: z.coerce.boolean().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ListRefundsQuery = z.infer<typeof ListRefundsSchema>;
