/**
 * RBAC authorization middleware factory.
 *
 * Usage:
 *   router.get('/users',
 *     authenticate(),
 *     authorize('users.read'),
 *     UsersController.list
 *   )
 *
 *   router.patch('/roles/:id',
 *     authenticate(),
 *     authorize('roles.update', 'system.settings'),  // ANY one match suffices (OR logic)
 *     RolesController.update
 *   )
 *
 * Requires authenticate() to run FIRST — it attaches both req.user
 * and req.permissionCodes (string[] of code names).
 */
import type { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "@/lib/errors";

type PermissionMatcher =
  | string                          // exact code: "users.read"
  | { all: string[] }              // require ALL of these codes (AND logic)
  | { any: string[] };             // same as rest-args OR; just sugar

export function authorize(...required: (string | PermissionMatcher)[]) {
  return function authorizeMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ) {
    const userCodes: string[] = req.permissionCodes ?? [];
    // Wildcard short-circuit: "*" in user permissions → bypass everything.
    // (SUPER_ADMIN gets this in some hardcoded systems; we assign all 60+
    // explicitly but leave this escape hatch as defence-in-depth.)
    if (userCodes.includes("*")) return next();

    const ok = required.every((rule) => checkRule(rule, userCodes));
    if (!ok) {
      throw new ForbiddenError(
        "Forbidden — you do not have sufficient permissions to perform this action.",
      );
    }
    return next();
  };
}

function checkRule(rule: PermissionMatcher | string, codes: string[]): boolean {
  if (typeof rule === "string") return codes.includes(rule);
  if ("all" in rule) return rule.all.every((c) => codes.includes(c));
  if ("any" in rule) return rule.any.some((c) => codes.includes(c));
  return false;
}
