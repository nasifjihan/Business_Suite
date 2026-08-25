/**
 * JWT utilities: sign access/refresh tokens, verify with runtime Zod check.
 *
 * Access token (short-lived, 15m): carries user identity in `sub`, role info,
 *   sent as JSON response body. Lives in REDUX MEMORY on client (NOT persisted).
 *
 * Refresh token (long-lived, 7d): carries ONLY userId + jti (JWT ID).
 *   Stored server-side in RefreshToken table for revocation.
 *   Sent in HTTP-only SET-COOKIE header — NEVER in JSON body (prevent XSS).
 */
import jwt from "jsonwebtoken";
import { z } from "zod";
import { CONFIG } from "@/config/env";
import { UnauthorizedError } from "@/lib/errors";
import type { RoleType } from "@prisma/client";

/**
 * Zod runtime schemas: even though `jsonwebtoken.verify` signature says string,
 * we must RUNTIME-VALIDATE decoded payload shape because JWT is only SIGNED,
 * not encrypted/validated — an attacker who knows the secret can craft any payload.
 */
export const AccessTokenPayloadSchema = z.object({
  sub: z.string().uuid("sub claim must be userId UUID"),
  roleId: z.string().uuid("roleId claim must be UUID"),
  role: z.nativeEnum(RoleType),
  jti: z.string().uuid("jti claim must be UUID"),
  type: z.literal("access"),
  iat: z.number().optional(),
  exp: z.number().optional(),
});
export type AccessTokenPayload = z.infer<typeof AccessTokenPayloadSchema>;

export const RefreshTokenPayloadSchema = z.object({
  sub: z.string().uuid(),
  jti: z.string().uuid(),
  familyId: z.string().uuid(),
  type: z.literal("refresh"),
  iat: z.number().optional(),
  exp: z.number().optional(),
});
export type RefreshTokenPayload = z.infer<typeof RefreshTokenPayloadSchema>;

/* ── Sign ───────────────────────────────────────────────────────────────── */

export function signAccessToken(payload: Omit<AccessTokenPayload, "type" | "iat" | "exp">): string {
  return jwt.sign(
    { ...payload, type: "access" as const },
    CONFIG.jwt.accessSecret,
    { expiresIn: CONFIG.jwt.accessExpiresIn }
  );
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, "type" | "iat" | "exp">): string {
  return jwt.sign(
    { ...payload, type: "refresh" as const },
    CONFIG.jwt.refreshSecret,
    { expiresIn: CONFIG.jwt.refreshExpiresIn }
  );
}

/* ── Verify ─────────────────────────────────────────────────────────────── */

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, CONFIG.jwt.accessSecret);
    const parsed = AccessTokenPayloadSchema.safeParse(decoded);
    if (!parsed.success) {
      throw new UnauthorizedError("Access token payload is malformed.");
    }
    return parsed.data;
  } catch (e) {
    if (e instanceof UnauthorizedError) throw e;
    if (e instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("Access token expired. Use refresh token to obtain a new one.");
    }
    if (e instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError("Access token is invalid or malformed.");
    }
    throw new UnauthorizedError("Access token verification failed.");
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(token, CONFIG.jwt.refreshSecret);
    const parsed = RefreshTokenPayloadSchema.safeParse(decoded);
    if (!parsed.success) {
      throw new UnauthorizedError("Refresh token payload is malformed.");
    }
    return parsed.data;
  } catch (e) {
    if (e instanceof UnauthorizedError) throw e;
    if (e instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("Refresh token expired. Please log in again.");
    }
    if (e instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError("Refresh token is invalid or malformed.");
    }
    throw new UnauthorizedError("Refresh token verification failed.");
  }
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

/**
 * Decode WITHOUT verification. Used ONLY to extract jti BEFORE DB lookup
 * when we already know we verified the signature via verifyRefreshToken.
 */
export function decodeJwtNoVerify<P = unknown>(token: string): P {
  return jwt.decode(token, { json: true }) as P;
}
