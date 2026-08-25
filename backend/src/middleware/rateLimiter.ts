/**
 * express-rate-limit — two reusable configurations:
 *   standardLimiter = app-wide 100 req/15min
 *   authStrictLimiter = /api/v1/auth/* 10 req/15min
 *
 * Also exports a custom handler that throws TooManyRequestsError so
 * the centralized errorHandler formats it with our JSON envelope.
 */
import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";
import { TooManyRequestsError } from "../lib/errors";
import { CONFIG } from "../config/env";

function defaultHandler(_req: Request, _res: Response) {
  throw new TooManyRequestsError();
}

export const standardLimiter = rateLimit({
  windowMs: CONFIG.rateLimit.windowMs,
  max: CONFIG.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler,
});

export const authStrictLimiter = rateLimit({
  windowMs: CONFIG.rateLimit.windowMs,
  max: 10, // Very low ceiling on login/forgot endpoints (brute-force shield)
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler,
});
