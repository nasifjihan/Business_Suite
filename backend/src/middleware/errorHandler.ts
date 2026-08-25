/**
 * Centralized Express error handler. MUST be mounted LAST (after all routes
 * and notFound). Signature (err, req, res, next) — 4 args — tells Express this
 * is THE error handler (not regular middleware).
 *
 * Pipeline:
 *   1. If err is AppError (isOperational) → respond with its status + message
 *   2. Else (programming/runtime bug) → log stack, respond generic 500
 *      (NEVER echo raw err.message to client in production — information leak)
 */
import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { ZodError } from "zod";
import { AppError } from "../lib/errors";
import { errorResponse } from "../lib/response";
import { logger } from "../config/logger";
import { CONFIG } from "../config/env";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Catch ZodError if one slipped past validate() middleware
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    errorResponse(res, StatusCodes.UNPROCESSABLE_ENTITY, {
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      details,
    });
    return;
  }

  if (err instanceof AppError) {
    errorResponse(res, err.statusCode, {
      code: toErrorCode(err.statusCode),
      message: err.message,
      details: err.details,
    });
    // Operational errors don't need full stack trace in production logs
    if (CONFIG.nodeEnv === "development") {
      logger.warn(`[AppError ${err.statusCode}] ${err.message}`);
    }
    return;
  }

  // — Unknown / programming error —
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error(`[UNHANDLED] ${message}`, stack ? { stack } : undefined);

  const safeMessage =
    CONFIG.nodeEnv === "production"
      ? "An unexpected error occurred. Our team has been notified."
      : message;

  errorResponse(res, StatusCodes.INTERNAL_SERVER_ERROR, {
    code: "INTERNAL_SERVER_ERROR",
    message: safeMessage,
  });
}

function toErrorCode(status: number): string {
  switch (status) {
    case StatusCodes.BAD_REQUEST: return "BAD_REQUEST";
    case StatusCodes.UNAUTHORIZED: return "UNAUTHORIZED";
    case StatusCodes.FORBIDDEN: return "FORBIDDEN";
    case StatusCodes.NOT_FOUND: return "NOT_FOUND";
    case StatusCodes.CONFLICT: return "CONFLICT";
    case StatusCodes.UNPROCESSABLE_ENTITY: return "VALIDATION_ERROR";
    case StatusCodes.TOO_MANY_REQUESTS: return "TOO_MANY_REQUESTS";
    default: return "HTTP_" + status;
  }
}
