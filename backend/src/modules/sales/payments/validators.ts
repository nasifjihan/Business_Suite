import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";
import { PaymentMethod, PaymentStatus } from "@prisma/client";

export const CreatePaymentSchema = z.object({
  orderId: z.string().uuid(),
  invoiceId: z.string().uuid().optional(),
  amount: z.coerce.number().positive(),
  method: z.nativeEnum(PaymentMethod),
  status: z.nativeEnum(PaymentStatus).default(PaymentStatus.PAID),
  paidAt: z.coerce.date().optional(),
  transactionFee: z.coerce.number().min(0).optional().default(0),
  reference: z.string().trim().max(255).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type CreatePaymentDto = z.infer<typeof CreatePaymentSchema>;

export const ListPaymentsSchema = PaginationSchema.extend({
  orderId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
  status: z.nativeEnum(PaymentStatus).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ListPaymentsQuery = z.infer<typeof ListPaymentsSchema>;
