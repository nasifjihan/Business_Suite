/**
 * Auth module skeleton — Phase 2 real implementation.
 * Present in Phase 1 so the routes aggregator compiles with stable import path.
 */
import { Router } from "express";
import { authStrictLimiter } from "../../middleware/rateLimiter";

export const authRouter = Router();

// Apply the stricter rate limit to all /auth/* endpoints first
authRouter.use(authStrictLimiter);

// Endpoints stubbed out (Phase 2 wires them up):
// POST /auth/login
// POST /auth/refresh
// POST /auth/logout
// POST /auth/forgot-password
// POST /auth/reset-password
