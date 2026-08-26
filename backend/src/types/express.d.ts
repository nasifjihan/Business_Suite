/**
 * Augment Express core types so req.user (AuthenticatedUser) is
 * TypeScript-safe across ALL route handlers & controllers.
 *
 * Without this file: `req.user` is type `any`.
 * With this file:  tsc --strict flags every typo.
 */
import type { AuthenticatedUser } from "../utils/authTypes";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      // Phase 3 RBAC middleware attaches permissionCodes[] here:
      permissionCodes?: string[];
      // Audit logger middleware attaches requestId for correlation:
      requestId?: string;
    }
  }
}

export {};
