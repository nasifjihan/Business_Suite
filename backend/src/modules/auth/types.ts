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
  permissions: string[];
};

export type RefreshResponseDto = {
  accessToken: string;
  tokenType: "Bearer";
  expiresInSec: number;
  user: UserProfileDto;
  permissions: string[];
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

/**
 * Returned by POST /auth/login when the password was correct but the account
 * has 2FA enabled. No access token and no refresh cookie are issued at this
 * point — `challengeToken` can only be spent at POST /auth/2fa/verify.
 *
 * `twoFactorRequired` is an explicit discriminator so the frontend can branch
 * on a field rather than on the ABSENCE of `accessToken`, which would silently
 * change meaning if the login payload ever gained optional fields.
 */
export type TwoFactorChallengeDto = {
  twoFactorRequired: true;
  challengeToken: string;
};

export type TwoFactorSetupResponseDto = {
  /** Base32 secret, for manual entry when a camera is unavailable. */
  secret: string;
  /** otpauth:// URI — what the QR code encodes. */
  otpauthUrl: string;
  /** data:image/png;base64,... — rendered directly in an <img src>. */
  qrDataUrl: string;
};

export type TwoFactorEnableResponseDto = {
  ok: true;
  /** Plaintext codes. Returned exactly once, never retrievable again. */
  recoveryCodes: string[];
};

export type TwoFactorStatusResponseDto = {
  enabled: boolean;
  /** How many unused recovery codes remain; 0 means a lockout risk. */
  recoveryCodesRemaining: number;
};
