import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";
import { CustomerStatus } from "@prisma/client";

export const AdjustCreditSchema = z.object({
  customerId: z.string().uuid(),
  deltaAmount: z.coerce.number(),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type AdjustCreditDto = z.infer<typeof AdjustCreditSchema>;

export const ListCreditsSchema = PaginationSchema.extend({
  withPositiveBalance: z.coerce.boolean().optional(),
  status: z.nativeEnum(CustomerStatus).optional(),
  minBalance: z.coerce.number().optional(),
});
export type ListCreditsQuery = z.infer<typeof ListCreditsSchema>;
