import { z } from "zod";

export const UpdateOwnProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(50).optional(),
  lastName: z.string().trim().min(1).max(50).optional(),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  avatarUrl: z.string().trim().max(500).optional().or(z.literal("")),
});
export type UpdateOwnProfileDto = z.infer<typeof UpdateOwnProfileSchema>;
