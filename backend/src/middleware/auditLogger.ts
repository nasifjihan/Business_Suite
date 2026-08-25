/**
 * Audit log middleware — implemented in Phase 3.
 * Skeleton: pass-through in Phase 1 so app.ts middleware order is final
 * (don't re-order middleware later which causes subtle bugs).
 */
import type { Request, Response, NextFunction } from "express";

export function auditLogger(req: Request, res: Response, next: NextFunction) {
  // TODO(phase3): after response is sent (res.on('finish')), record:
  //   userId (req.user.id), action (method + route), entityPath, ip, userAgent,
  //   statusCode, changes (if PATCH/PUT — compare before/after snapshots)
  void req;
  void res;
  next();
}
