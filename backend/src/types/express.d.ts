/**
 * Shared API / express types.
 * ------------------------------------------------------------------
 * Augments Express Request with `user` and `permissions` so our
 * auth + RBAC middleware can attach them safely (typed, no any).
 *
 * Only augment Express types HERE, never spread declarations
 * across files (that causes type conflicts when refactoring).
 */
import type { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      /** Attached by authenticate() middleware when a valid access token is present. */
      user?: {
        id: string;
        roleId: string;
        role: string; // RoleType enum value (SUPER_ADMIN / ADMIN / MANAGER / etc.)
      };
      /** Attached by authorize() middleware: the caller's flattened permission strings. */
      permissions?: string[];
    }
  }
}

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  role: string;
  roleId: string;
  jti: string;
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  jti: string;
}

export type PaginationMeta = {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type PaginatedResponse<T> = {
  success: true;
  data: T[];
  meta: PaginationMeta;
};

export type ApiResponse<T> =
  | { success: true; data: T; meta?: PaginationMeta }
  | { success: false; error: { code: string; message: string; details?: unknown[] } };
