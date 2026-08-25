import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";
import { UserStatus } from "@prisma/client";

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const CreateUserSchema = z.object({
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  email: z.string().trim().email().max(255),
  roleId: z.string().uuid(),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  avatarUrl: z.string().trim().max(500).optional().or(z.literal("")),
});
export type CreateUserDto = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  firstName: z.string().trim().min(1).max(50).optional(),
  lastName: z.string().trim().min(1).max(50).optional(),
  email: z.string().trim().email().max(255).optional(),
  roleId: z.string().uuid().optional(),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  avatarUrl: z.string().trim().max(500).optional().or(z.literal("")),
  status: z.nativeEnum(UserStatus).optional(),
  mustChangePassword: z.boolean().optional(),
});
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;

export const ListUsersSchema = PaginationSchema.extend({
  status: z.nativeEnum(UserStatus).optional(),
  roleId: z.string().uuid().optional(),
});
export type ListUsersQuery = z.infer<typeof ListUsersSchema>;

export const ChangeOwnPasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().regex(passwordRegex, {
    message:
      "Password must be at least 8 characters with uppercase, lowercase, digit, and one special character.",
  }),
});
export type ChangeOwnPasswordDto = z.infer<typeof ChangeOwnPasswordSchema>;
