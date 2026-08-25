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

// ── Global strict rate limit for ALL auth routes ───────────────────────────
authRouter.use(authStrictLimiter);

// ── Public (no access token needed) ───────────────────────────────────────
authRouter.post("/login",           validate({ body: LoginSchema }),            AuthController.login);
authRouter.post("/refresh",                                              AuthController.refresh);
authRouter.post("/logout",                                               AuthController.logout);
authRouter.post("/forgot-password", validate({ body: ForgotPasswordSchema }),  AuthController.forgotPassword);
authRouter.post("/reset-password",  validate({ body: ResetPasswordSchema }),   AuthController.resetPassword);

// ── Protected (access token required) ────────────────────────────────────
authRouter.get("/me", authenticate(true), AuthController.me);
authRouter.post(
  "/change-password",
  authenticate(true),
  validate({ body: ChangePasswordSchema }),
  AuthController.changePassword
);
