/**
 * TypeScript shapes returned by auth endpoints.
 */
import type { RoleType } from "@prisma/client";

export type UserProfileDto = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: RoleType;
  roleId: string | null;
  status: "ACTIVE" | "INACTIVE";
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export type LoginResponseDto = {
  accessToken: string;
  tokenType: "Bearer";
  expiresInSec: number; // Access token TTL in seconds (used by frontend to show warning)
  user: UserProfileDto;
};

export type RefreshResponseDto = {
  accessToken: string;
  tokenType: "Bearer";
  expiresInSec: number;
};

export type ForgotPasswordResponseDto = {
  ok: true;
};

export type ResetPasswordResponseDto = {
  ok: true;
};

export type LogoutResponseDto = {
  ok: true;
};
