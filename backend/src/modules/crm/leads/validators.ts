import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";
import { LeadStatus, LeadSource } from "@prisma/client";

export const CreateLeadSchema = z.object({
  name: z.string().trim().min(1).max(200),
  companyName: z.string().trim().max(200).optional().or(z.literal("")),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  source: z.nativeEnum(LeadSource).optional().default(LeadSource.OTHER),
  status: z.nativeEnum(LeadStatus).optional().default(LeadStatus.NEW),
  value: z.coerce.number().positive().default(0),
  currency: z.string().default("USD"),
  probability: z.coerce.number().int().min(0).max(100).default(0),
  assignedToId: z.string().uuid().optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type CreateLeadDto = z.infer<typeof CreateLeadSchema>;

export const UpdateLeadSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  companyName: z.string().trim().max(200).optional().or(z.literal("")),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  source: z.nativeEnum(LeadSource).optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  value: z.coerce.number().positive().optional(),
  currency: z.string().optional(),
  probability: z.coerce.number().int().min(0).max(100).optional(),
  assignedToId: z.string().uuid().optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type UpdateLeadDto = z.infer<typeof UpdateLeadSchema>;

export const ListLeadsSchema = PaginationSchema.extend({
  status: z.nativeEnum(LeadStatus).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  assignedToId: z.string().uuid().optional(),
});
export type ListLeadsQuery = z.infer<typeof ListLeadsSchema>;

export const ConvertLeadSchema = z.object({
  customerName: z.string().trim().min(1).max(200),
  createOpportunity: z.boolean().default(true),
  opportunityName: z.string().trim().max(200).optional(),
  opportunityAmount: z.coerce.number().default(0),
  expectedCloseDate: z.string().optional(),
  assignedToId: z.string().uuid().optional(),
});
export type ConvertLeadDto = z.infer<typeof ConvertLeadSchema>;

export const PatchLeadStageSchema = z.object({
  stage: z.nativeEnum(LeadStatus),
  note: z.string().max(2000).optional(),
});
export type PatchLeadStageDto = z.infer<typeof PatchLeadStageSchema>;
