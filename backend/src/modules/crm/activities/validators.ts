import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";
import { ActivityType } from "@prisma/client";

export const CreateActivitySchema = z
  .object({
    type: z.nativeEnum(ActivityType),
    subject: z.string().trim().min(1).max(250),
    description: z.string().trim().max(5000).optional().or(z.literal("")),
    activityAt: z.coerce.date().default(() => new Date()),
    outcome: z.string().trim().max(500).optional().or(z.literal("")),
    userId: z.string().uuid(),
    leadId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    opportunityId: z.string().uuid().optional(),
  })
  .refine(
    (v) => [v.leadId, v.customerId, v.opportunityId].filter(Boolean).length === 1,
    {
      message: "Exactly one of leadId, customerId, or opportunityId must be provided",
      path: ["root"],
    },
  );
export type CreateActivityDto = z.infer<typeof CreateActivitySchema>;

export const ListActivitiesSchema = PaginationSchema.extend({
  type: z.nativeEnum(ActivityType).optional(),
  userId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
  since: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
});
export type ListActivitiesQuery = z.infer<typeof ListActivitiesSchema>;
