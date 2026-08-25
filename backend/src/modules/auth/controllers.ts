/**
 * Thin controller layer: glue between Express Request/Response and AuthService methods.
 *
 * RULES:
 *   - Controllers NEVER include business logic (if/else password checks).
 *   - Controllers ONLY: parse input, call service, serialize output, set cookies.
 *   - Service may throw typed error classes; middleware errorHandler maps them to HTTP.
 */
import type { Request, Response } from "express";
import { AuthService } from "./services";
import { successResponse } from "@/lib/response";
import { buildRefreshCookieOptions, CLEAR_REFRESH_COOKIE_OPTIONS } from "@/utils/cookies";
import type { LoginDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from "./validators";

const REFRESH_COOKIE_NAME = "refreshToken";

function extractMeta(req: Request) {
  return {
    ip: req.ip || (req.socket?.remoteAddress ?? undefined),
    ua: req.headers["user-agent"] ?? undefined,
  };
}

export const AuthController = {
  async login(req: Request, res: Response) {
    const { response, refreshJwt } = await AuthService.login(req.body, extractMeta(req));
    res.cookie(REFRESH_COOKIE_NAME, refreshJwt, buildRefreshCookieOptions());
    return successResponse(res, response, 200);
  },

  async refresh(req: Request, res: Response) {
    const cookie = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    try {
      const { response, newRefreshJwt } = await AuthService.refresh(cookie, extractMeta(req));
      res.cookie(REFRESH_COOKIE_NAME, newRefreshJwt, buildRefreshCookieOptions());
      return successResponse(res, response, 200);
    } catch (err) {
      res.cookie(REFRESH_COOKIE_NAME, "", CLEAR_REFRESH_COOKIE_OPTIONS);
      throw err;
    }
  },

  async logout(req: Request, res: Response) {
    const cookie = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    await AuthService.logout(cookie);
    res.cookie(REFRESH_COOKIE_NAME, "", CLEAR_REFRESH_COOKIE_OPTIONS);
    return successResponse(res, { ok: true }, 200);
  },

  async forgotPassword(req: Request, res: Response) {
    await AuthService.forgotPassword(req.body, extractMeta(req));
    // Always 200, never leak user existence via response body.
    return successResponse(res, { ok: true }, 200);
  },

  async resetPassword(req: Request, res: Response) {
    await AuthService.resetPassword(req.body, extractMeta(req));
    return successResponse(res, { ok: true }, 200);
  },

  async me(req: Request, res: Response) {
    // authenticate() middleware already ran and set req.user (not optional here).
    const user = await AuthService.me(req.user!.id);
    return successResponse(res, user, 200);
  },

  async changePassword(req: Request, res: Response) {
    const result = await AuthService.changePassword({
      ...(req.body as ChangePasswordDto),
      userId: req.user!.id,
    });
    // Clear refresh cookie (we just revoked all refresh tokens for user above)
    res.cookie("refreshToken", "", CLEAR_REFRESH_COOKIE_OPTIONS);
    return successResponse(res, result, 200);
  },
};
