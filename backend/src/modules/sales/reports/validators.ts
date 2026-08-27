import { z } from "zod";

export const DailySalesSummarySchema = z.object({
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date(),
  warehouseId: z.string().uuid().optional(),
});
export type DailySalesSummaryQuery = z.infer<typeof DailySalesSummarySchema>;
