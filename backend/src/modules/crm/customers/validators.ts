import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";
import { CustomerStatus, LeadSource } from "@prisma/client";

export const CreateCustomerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  companyName: z.string().trim().max(200).optional().or(z.literal("")),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  country: z.string().trim().max(100).optional().or(z.literal("")),
  postalCode: z.string().trim().max(30).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  source: z.nativeEnum(LeadSource).optional().default(LeadSource.OTHER),
  status: z.nativeEnum(CustomerStatus).optional().default(CustomerStatus.ACTIVE),
});
export type CreateCustomerDto = z.infer<typeof CreateCustomerSchema>;

export const UpdateCustomerSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  companyName: z.string().trim().max(200).optional().or(z.literal("")),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  country: z.string().trim().max(100).optional().or(z.literal("")),
  postalCode: z.string().trim().max(30).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  source: z.nativeEnum(LeadSource).optional(),
  status: z.nativeEnum(CustomerStatus).optional(),
});
export type UpdateCustomerDto = z.infer<typeof UpdateCustomerSchema>;

export const ListCustomersSchema = PaginationSchema.extend({
  status: z.nativeEnum(CustomerStatus).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  sortBy: z.enum(["name", "status", "createdAt", "totalSpent"]).optional(),
});
export type ListCustomersQuery = z.infer<typeof ListCustomersSchema>;
