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
  TwoFactorVerifySchema,
  TwoFactorEnableSchema,
  TwoFactorDisableSchema,
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
// Step 2 of login. Public (the caller has no session yet — that is the whole
// point) but rate-limited like /login, because the code space is small enough
// that an unthrottled endpoint would be brute-forceable.
authRouter.post("/2fa/verify",      authStrictLimiter, validate({ body: TwoFactorVerifySchema }), AuthController.verifyTwoFactor);
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

// ── Two-factor management (session required) ─────────────────────────────
// These all act on the caller's own account (req.user.id), so they are not
// admin endpoints and need no extra permission code.
authRouter.get("/2fa/status",  authenticate(true), AuthController.getTwoFactorStatus);
authRouter.post("/2fa/setup",  authenticate(true), AuthController.setupTwoFactor);
authRouter.post(
  "/2fa/enable",
  authenticate(true),
  validate({ body: TwoFactorEnableSchema }),
  AuthController.enableTwoFactor
);
authRouter.post(
  "/2fa/disable",
  authenticate(true),
  validate({ body: TwoFactorDisableSchema }),
  AuthController.disableTwoFactor
);
