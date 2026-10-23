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
import jwt, { type SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { CONFIG } from "@/config/env";
import { UnauthorizedError } from "@/lib/errors";
import { RoleType } from "@prisma/client";

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

/**
 * Second-step login (2FA) challenge.
 *
 * This token is handed out after a CORRECT password and before a TOTP code has
 * been checked, so it must be usable for exactly one thing: exchanging itself
 * for a session. Two properties enforce that —
 *   - `type` is a distinct literal, so `verifyAccessToken` rejects it and it
 *     can never be used as a Bearer token on any route;
 *   - it expires in 5 minutes, the size of the window a user actually needs to
 *     open their authenticator app.
 *
 * `jti` is carried so the challenge can be logged or, later, tracked
 * server-side; nothing is stored for it today, which is safe precisely because
 * it grants no access on its own.
 */
export const TwoFactorChallengePayloadSchema = z.object({
  sub: z.string().uuid(),
  jti: z.string().uuid(),
  type: z.literal("2fa_challenge"),
  iat: z.number().optional(),
  exp: z.number().optional(),
});
export type TwoFactorChallengePayload = z.infer<typeof TwoFactorChallengePayloadSchema>;

/** Challenge lifetime. Long enough to find a phone, short enough to not linger. */
export const TWO_FACTOR_CHALLENGE_TTL = "5m";

/* ── Sign ───────────────────────────────────────────────────────────────── */

export function signAccessToken(payload: Omit<AccessTokenPayload, "type" | "iat" | "exp">): string {
  return jwt.sign(
    { ...payload, type: "access" as const },
    CONFIG.jwt.accessSecret,
    { expiresIn: CONFIG.jwt.accessExpiresIn } as SignOptions
  );
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, "type" | "iat" | "exp">): string {
  return jwt.sign(
    { ...payload, type: "refresh" as const },
    CONFIG.jwt.refreshSecret,
    { expiresIn: CONFIG.jwt.refreshExpiresIn } as SignOptions
  );
}

export function signTwoFactorChallenge(
  payload: Omit<TwoFactorChallengePayload, "type" | "iat" | "exp">
): string {
  return jwt.sign(
    { ...payload, type: "2fa_challenge" as const },
    CONFIG.jwt.accessSecret,
    { expiresIn: TWO_FACTOR_CHALLENGE_TTL } as SignOptions
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

export function verifyTwoFactorChallenge(token: string): TwoFactorChallengePayload {
  try {
    const decoded = jwt.verify(token, CONFIG.jwt.accessSecret);
    const parsed = TwoFactorChallengePayloadSchema.safeParse(decoded);
    if (!parsed.success) {
      // Covers the important case: a validly-signed ACCESS token passed where a
      // challenge is expected. `type` fails the literal check and we reject it.
      throw new UnauthorizedError("Two-factor challenge is malformed.");
    }
    return parsed.data;
  } catch (e) {
    if (e instanceof UnauthorizedError) throw e;
    if (e instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError(
        "Your two-factor challenge expired. Please sign in again.",
      );
    }
    throw new UnauthorizedError("Two-factor challenge is invalid. Please sign in again.");
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
