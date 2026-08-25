/**
 * Authenticated user shape attached to Express Request object.
 * Populated by middleware authenticate() by decoding the Bearer access token.
 */
import type { RoleType } from "@prisma/client";

export interface AuthenticatedUser {
  id: string;
  roleId: string;
  role: RoleType;
  jti: string;
}
