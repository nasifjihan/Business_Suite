import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";
import { OpportunityStage } from "@prisma/client";

export const CreateOpportunitySchema = z.object({
  name: z.string().trim().min(1).max(200),
  customerId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  stage: z.nativeEnum(OpportunityStage).optional().default(OpportunityStage.PROSPECTING),
  amount: z.coerce.number().positive().default(0),
  currency: z.string().default("USD"),
  probabilityPercent: z.coerce.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.coerce.date().optional(),
  assignedToId: z.string().uuid().optional(),
  notes: z.string().optional(),
});
export type CreateOpportunityDto = z.infer<typeof CreateOpportunitySchema>;

export const UpdateOpportunitySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  customerId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  stage: z.nativeEnum(OpportunityStage).optional(),
  amount: z.coerce.number().positive().optional(),
  currency: z.string().optional(),
  probabilityPercent: z.coerce.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.coerce.date().optional(),
  assignedToId: z.string().uuid().optional(),
  notes: z.string().optional(),
});
export type UpdateOpportunityDto = z.infer<typeof UpdateOpportunitySchema>;

export const ListOpportunitiesSchema = PaginationSchema.extend({
  stage: z.nativeEnum(OpportunityStage).optional(),
  customerId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
  expectedCloseDateFrom: z.coerce.date().optional(),
  expectedCloseDateTo: z.coerce.date().optional(),
});
export type ListOppsQuery = z.infer<typeof ListOpportunitiesSchema>;

export const PatchStageSchema = z.object({
  stage: z.nativeEnum(OpportunityStage),
  note: z.string().max(2000).optional(),
});
export type PatchStageDto = z.infer<typeof PatchStageSchema>;
