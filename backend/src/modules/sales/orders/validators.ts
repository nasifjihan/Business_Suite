import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";
import { OrderStatus, PaymentStatus, PaymentMethod } from "@prisma/client";

export const CreateOrderItemDto = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1),
  discountAmount: z.coerce.number().gte(0).default(0),
  taxRatePercent: z.coerce.number().int().gte(0).lte(100).default(0),
}).strict();

export const CreatePaymentDto = z.object({
  amount: z.coerce.number().gte(0),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  transactionFee: z.coerce.number().gte(0).default(0),
}).strict();

export const CreateOrderCheckoutDto = z.object({
  customerId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  items: z.array(CreateOrderItemDto).min(1),
  discountAmount: z.coerce.number().gte(0).default(0),
  notes: z.string().trim().optional(),
  referenceNo: z.string().trim().optional(),
  dueDate: z.coerce.date().optional(),
  payments: z.array(CreatePaymentDto).optional().default([]),
}).strict();
export type CreateOrderCheckoutDto = z.infer<typeof CreateOrderCheckoutDto>;

export const UpdateOrderStatusDto = z.object({
  status: z.nativeEnum(OrderStatus),
  notes: z.string().trim().optional(),
}).strict();
export type UpdateOrderStatusDto = z.infer<typeof UpdateOrderStatusDto>;

export const ListOrdersQuery = PaginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  customerId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  orderDateFrom: z.coerce.date().optional(),
  orderDateTo: z.coerce.date().optional(),
  sortBy: z.enum(["orderNumber", "orderDate", "totalAmount", "status", "createdAt"]).optional(),
}).strip();
export type ListOrdersQuery = z.infer<typeof ListOrdersQuery>;
