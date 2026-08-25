/**
 * Express authentication middleware.
 * Phase 2 implements the real JWT logic.
 * Phase 1: skeleton — passes through all requests (req.user stays undefined).
 */
import type { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "../lib/errors";

export function authenticate(required = true) {
  return (_req: Request, _res: Response, next: NextFunction) => {
    // TODO(phase2): extract Bearer token from Authorization header
    //               verify JWT_ACCESS_SECRET
    //               attach req.user = { id, roleId, role }
    //               if required && !user -> throw UnauthorizedError
    if (required) {
      // Phase 1 stub: fail closed so Phase 2 catches omissions
      // For the /api/v1/health endpoint this middleware is NOT mounted.
      next(new UnauthorizedError("Authentication not implemented yet (Phase 2)."));
      return;
    }
    next();
  };
}
