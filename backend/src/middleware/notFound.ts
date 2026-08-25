/**
 * 404 handler — mounted AFTER all route mounts, BEFORE errorHandler.
 * Any URL that didn't match any route lands here.
 * Falls through to errorHandler with a NotFoundError so the envelope
 * is consistent with all other error responses.
 */
import type { Request, Response, NextFunction } from "express";
import { NotFoundError } from "../lib/errors";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new NotFoundError(`No ${req.method} route at ${req.originalUrl}`));
}
