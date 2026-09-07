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

/**
 * Applied to every limiter below. Returns true only in local development with
 * DISABLE_RATE_LIMIT=true (see CONFIG.rateLimit.disabled). In test and
 * production this is always false.
 */
const skipInLocalDev = () => CONFIG.rateLimit.disabled;

export const standardLimiter = rateLimit({
  windowMs: CONFIG.rateLimit.windowMs,
  max: CONFIG.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler,
  skip: skipInLocalDev,
});

export const authStrictLimiter = rateLimit({
  windowMs: CONFIG.rateLimit.windowMs,
  // 10 attempts / 15 min. Kept deliberately low — this is the brute-force shield
  // on /auth/login + /auth/forgot-password. For local manual testing set
  // DISABLE_RATE_LIMIT=true in .env instead of raising this number, so the
  // production ceiling and the integration test stay in agreement.
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler,
  skip: skipInLocalDev,
});

export const authedLimiter = rateLimit({
  windowMs: CONFIG.rateLimit.windowMs,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler,
  skip: skipInLocalDev,
});

export const crudLimiter = rateLimit({
  windowMs: CONFIG.rateLimit.windowMs,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler,
  skip: skipInLocalDev,
});
