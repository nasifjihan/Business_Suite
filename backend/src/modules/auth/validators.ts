/**
 * Zod schemas for DTOs accepted by auth endpoints.
 *
 * Password policy (Section 8.3):
 *   Min 8 characters, at least 1 lowercase, 1 uppercase, 1 digit, 1 non-alphanumeric.
 *
 * All schema error messages are user-facing (displayed inline on forms).
 */
import { z } from "zod";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_MESSAGE =
  "Password must be at least 8 characters and include at least one lowercase letter, one uppercase letter, one digit, and one special character.";

export const LoginSchema = z.object({
  email: z.string().email("Please enter a valid email address.").trim(),
  password: z
    .string()
    .min(1, "Password is required.")
    .max(128, "Password cannot exceed 128 characters."),
});
export type LoginDto = z.infer<typeof LoginSchema>;

export const ForgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address.").trim().toLowerCase(),
});
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
  token: z.string().uuid("Reset token is not a valid UUID format."),
  newPassword: z.string().regex(PASSWORD_REGEX, PASSWORD_MESSAGE),
});
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().regex(PASSWORD_REGEX, PASSWORD_MESSAGE),
});
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;

/* Utility: return password strength 0..4 for meter UI (frontend reusable copy). */
export function measurePasswordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  let score = 0;
  if (!pw) return 0;
  if (pw.length >= 8) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (pw.length >= 14) score += 0; // bonus cap at 4
  if (score > 4) return 4;
  return score as 0 | 1 | 2 | 3 | 4;
}
