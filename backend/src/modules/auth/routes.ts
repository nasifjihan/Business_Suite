/**
 * Auth module route definitions.
 *
 * All routes prefixed under:   POST /api/v1/auth/*
 * Global middleware applied first: authStrictLimiter (10 req / 15 min / IP).
 */
import { Router } from "express";
import { authStrictLimiter } from "../../middleware/rateLimiter";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/auth";
import { AuthController } from "./controllers";
import {
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
} from "./validators";

export const authRouter = Router();

// ── Rate limiting ─────────────────────────────────────────────────────────
// authStrictLimiter (10 req / 15 min / IP) is applied PER-ROUTE below, not to
// the whole router. Applied router-wide it also covered /refresh, /me and
// /logout - endpoints the app calls on every page load and whenever the access
// token expires. A user browsing normally exhausted the 10-request budget in a
// couple of page loads, then every auth call returned 429, which the frontend
// reported as "your session expired". Clearing cookies did not help, because
// the counter lives in server memory keyed by IP, not in the browser.
//
// Those routes are still covered by standardLimiter (100 req / 15 min),
// applied application-wide in app.ts.

// ── Public (no access token needed) ───────────────────────────────────────
authRouter.post("/login",           authStrictLimiter, validate({ body: LoginSchema }),            AuthController.login);
authRouter.post("/refresh",                                              AuthController.refresh);
authRouter.post("/logout",                                               AuthController.logout);
authRouter.post("/forgot-password", authStrictLimiter, validate({ body: ForgotPasswordSchema }),  AuthController.forgotPassword);
authRouter.post("/reset-password",  authStrictLimiter, validate({ body: ResetPasswordSchema }),   AuthController.resetPassword);

// ── Protected (access token required) ────────────────────────────────────
authRouter.get("/me", authenticate(true), AuthController.me);
authRouter.post(
  "/change-password",
  authenticate(true),
  validate({ body: ChangePasswordSchema }),
  AuthController.changePassword
);
