import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";

export const CreateContactSchema = z.object({
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  mobile: z.string().trim().max(30).optional().or(z.literal("")),
  designation: z.string().trim().max(150).optional().or(z.literal("")),
  department: z.string().trim().max(100).optional().or(z.literal("")),
  isPrimary: z.boolean().optional().default(false),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type CreateContactDto = z.infer<typeof CreateContactSchema>;

export const UpdateContactSchema = z.object({
  firstName: z.string().trim().min(1).max(50).optional(),
  lastName: z.string().trim().min(1).max(50).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  mobile: z.string().trim().max(30).optional().or(z.literal("")),
  designation: z.string().trim().max(150).optional().or(z.literal("")),
  department: z.string().trim().max(100).optional().or(z.literal("")),
  isPrimary: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type UpdateContactDto = z.infer<typeof UpdateContactSchema>;

export const ListContactsSchema = PaginationSchema.extend({
  customerId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
});
export type ListContactsQuery = z.infer<typeof ListContactsSchema>;
