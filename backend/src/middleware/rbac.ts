/**
 * RBAC authorization middleware — requires authenticate() BEFORE it.
 * Phase 3 implements the real permission check.
 * Phase 1: skeleton — if called, it fails closed.
 */
import type { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../lib/errors";

export function authorize(..._required: string[]) {
  return (_req: Request, _res: Response, next: NextFunction) => {
    // TODO(phase3): look up req.user.roleId
    //               fetch permissions (including wildcard *) from DB/cache
    //               match against required; if no match throw ForbiddenError
    next(new ForbiddenError("RBAC not implemented yet (Phase 3)."));
  };
}
