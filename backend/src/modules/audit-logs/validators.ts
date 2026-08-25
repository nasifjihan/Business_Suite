import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";
import { AuditAction } from "@prisma/client";

export const ListAuditLogsSchema = PaginationSchema.extend({
  entityType: z.string().trim().max(50).optional(),
  action: z.nativeEnum(AuditAction).optional(),
  userId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ListAuditLogsQuery = z.infer<typeof ListAuditLogsSchema>;
