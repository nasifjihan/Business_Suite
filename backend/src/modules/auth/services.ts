/**
 * AuthService — all business logic for authentication flows.
 *
 * THICK SERVICE, THIN CONTROLLER: controllers only parse request bodies,
 * validate them, call these methods, format responses.
 */
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { CONFIG } from "@/config/env";
import { hashPassword, verifyPassword } from "@/utils/password";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  RefreshTokenPayloadSchema,
  type AccessTokenPayload,
  type RefreshTokenPayload,
} from "@/utils/jwt";
import { hashRefreshToken } from "@/utils/crypto";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
} from "@/lib/errors";
import type { RoleType, UserStatus } from "@prisma/client";
import type {
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from "./validators";
import type {
  LoginResponseDto,
  RefreshResponseDto,
  UserProfileDto,
} from "./types";
import type { Request } from "express";

/* ── Helper maps ────────────────────────────────────────────────────────── */

function expiresInToSeconds(s: string): number {
  const m = s.match(/^(\d+)(ms|s|m|h|d|w|y)?$/);
  if (!m) return 15 * 60; // fallback 15m
  const [, nRaw, unit = "m"] = m;
  const n = parseInt(nRaw, 10);
  const mult: Record<string, number> = {
    ms: 0.001,
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
    y: 31536000,
  };
  return Math.floor(n * (mult[unit] ?? 60));
}

function userToDto(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: { name: RoleType; id: string } | null;
  status: UserStatus;
  mustChangePassword: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}): UserProfileDto {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    role: user.role?.name ?? ("VIEWER" as RoleType),
    roleId: user.role?.id ?? null,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
  };
}

/* ── Service class ─────────────────────────────────────────────────────── */

export const AuthService = {
  /**
   * Login flow:
   *   - find user by email (or NOT, but we still bcrypt dummy hash so timing equal)
   *   - verify password (constant time even if no user)
   *   - check ACTIVE status
   *   - create refresh token family (jti, familyId new UUIDs, hashed token in DB)
   *   - sign access token (15 min) + refresh token (7d)
   *   - issue Set-Cookie with refresh, return access + user JSON
   */
  async login(
    dto: LoginDto,
    meta: { ip: string | undefined; ua: string | undefined },
  ): Promise<{ response: LoginResponseDto; refreshJwt: string }> {
    const email = dto.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        role: {
          select: {
            id: true, name: true,
            permissions: { select: { permission: { select: { code: true } } } },
          },
        },
      },
    });

    const passwordValid = await verifyPassword(
      dto.password,
      user?.passwordHash,
    );

    if (!user || !passwordValid) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    if (user.status !== "ACTIVE") {
      throw new ForbiddenError(
        "This account has been disabled. Contact your administrator.",
      );
    }

    // Flat permissions list
    const permissions =
      user.role?.permissions?.map((rp) => rp.permission.code).filter(Boolean) ?? [];

    const jti = randomUUID();
    const familyId = randomUUID();

    const accessPayload: Omit<AccessTokenPayload, "type" | "iat" | "exp"> = {
      sub: user.id,
      roleId: user.role?.id ?? "",
      role: user.role?.name ?? "VIEWER",
      jti,
    };
    const refreshPayload: Omit<RefreshTokenPayload, "type" | "iat" | "exp"> = {
      sub: user.id,
      jti,
      familyId,
    };
    const accessJwt = signAccessToken(accessPayload);
    const refreshJwt = signRefreshToken(refreshPayload);

    const hashed = hashRefreshToken(refreshJwt);
    const ttlSec = expiresInToSeconds(CONFIG.jwt.refreshExpiresIn);
    const expiresAt = new Date(Date.now() + ttlSec * 1000);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        jti,
        familyId,
        tokenHash: hashed,
        expiresAt,
        ipAddress: meta.ip ?? null,
        userAgent: meta.ua ?? null,
      },
    });

    void prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      refreshJwt,
      response: {
        accessToken: accessJwt,
        tokenType: "Bearer",
        expiresInSec: expiresInToSeconds(CONFIG.jwt.accessExpiresIn),
        user: userToDto({
          ...user,
          role: user.role ? { id: user.role.id, name: user.role.name } : null,
        }),
        permissions,
      },
    };
  },

  /**
   * Refresh token flow with ROTATION + REUSE DETECTION.
   *
   * Steps:
   *   1. Verify refresh JWT signature + shape → jti, familyId, sub.
   *   2. Find row in RefreshToken by jti (fast, indexed).
   *   3. Reuse detection: if row.isUsed = true → ATTACK REPLAY detected!
   *      → Revoke ENTIRE family (ban every row with same familyId)
   *      → Return 401 "This session has been logged out due to suspicious activity"
   *   4. Check row.not revoked, not expired, sub matches token.sub.
   *   5. Mark row isUsed=true, usedAt=now (ROTATION).
   *   6. Create BRAND NEW refresh token (same familyId, new jti).
   *   7. Create BRAND NEW access token.
   *   8. Return {newAccessJwt, newRefreshJwt}.
   */
  async refresh(
    rawRefreshJwt: string | undefined,
    meta: { ip: string | undefined; ua: string | undefined },
  ): Promise<{ response: RefreshResponseDto; newRefreshJwt: string }> {
    if (!rawRefreshJwt) {
      throw new UnauthorizedError(
        "Refresh token cookie not present. Please log in again.",
      );
    }
    const decoded = verifyRefreshToken(rawRefreshJwt);
    // Double-verify decoded shape (redundant with verifyRefreshToken but belt-and-braces)
    const payload = RefreshTokenPayloadSchema.parse(decoded);

    const row = await prisma.refreshToken.findUnique({
      where: { jti: payload.jti },
      include: {
        user: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                permissions: { select: { permission: { select: { code: true } } } },
              },
            },
          },
        },
      },
    });

    if (!row) {
      throw new UnauthorizedError(
        "Refresh token not found in store. Please log in again.",
      );
    }

    // 1. Reuse detection (DEFENSE-IN-DEPTH with 5s tolerance window).
    //    Legitimate race: StrictMode double effect / TCP retransmit → browser sends
    //    the same refresh request POST twice. Old logic banned the family outright,
    //    which caused the persistent login-loop we've been fixing.
    //    Tolerance: if first-use was < 5 seconds ago, mint a fresh sibling access
    //    token (refresh cookie already set by winner; we don't need new rotation)
    //    so loser's response still succeeds (caller can proceed).
    if (row.isUsed) {
      const firstUsedAgoMs = Date.now() - (row.usedAt?.getTime() ?? 0);
      if (firstUsedAgoMs <= 5_000) {
        const userQ = await prisma.user.findFirst({
          where: { id: row.userId },
          include: {
            role: {
              select: {
                id: true,
                name: true,
                permissions: {
                  select: { permission: { select: { code: true } } },
                },
              },
            },
          },
        });
        if (userQ) {
          const role = userQ.role ?? null;
          const permissions =
            role?.permissions
              ?.map((rp) => rp.permission.code)
              .filter(Boolean) ?? [];
          // Mint a sibling access token (cheaper than another rotation; browser
          // already got the new refresh cookie from the winning request anyway)
          const siblingJti = randomUUID();
          const accessJwt = signAccessToken({
            sub: userQ.id,
            roleId: role?.id ?? "",
            role: role?.name ?? "VIEWER",
            jti: siblingJti,
          });
          return {
            newRefreshJwt: "replay_tolerated__use_winner_cookie",
            response: {
              accessToken: accessJwt,
              tokenType: "Bearer",
              expiresInSec: expiresInToSeconds(CONFIG.jwt.accessExpiresIn),
              user: userToDto({
                ...userQ,
                role: role ? { id: role.id, name: role.name } : null,
              }),
              permissions,
            },
          };
        }
      }
      // > 5s reuse OR sibling lookup failed = TRUE attacker replay. BAN FAMILY.
      await prisma.refreshToken.updateMany({
        where: { familyId: row.familyId },
        data: { isFamilyRevoked: true, revokedAt: new Date() },
      });
      throw new UnauthorizedError(
        "Suspicious activity detected: this refresh token was used twice. For your security, the entire session family has been logged out. Please log in again.",
      );
    }

    if (row.isFamilyRevoked || row.revokedAt !== null) {
      throw new UnauthorizedError(
        "Session has been revoked. Please log in again.",
      );
    }
    if (new Date() > row.expiresAt) {
      throw new UnauthorizedError(
        "Refresh token expired. Please log in again.",
      );
    }
    if (row.userId !== payload.sub) {
      throw new UnauthorizedError(
        "Refresh token does not match user id. Please log in again.",
      );
    }
    if (!row.user || row.user.status !== "ACTIVE") {
      throw new ForbiddenError("This account has been disabled.");
    }

    // 5. Rotate: mark current isUsed + usedAt
    await prisma.refreshToken.update({
      where: { jti: payload.jti },
      data: {
        isUsed: true,
        usedAt: new Date(),
        ipAddress: meta.ip ?? row.ipAddress,
        userAgent: meta.ua ?? row.userAgent,
      },
    });

    // 6 + 7: Mint new tokens (same family, NEW jti so ROTATION step is 100% complete)
    const newJti = randomUUID();
    const accessPayload: Omit<AccessTokenPayload, "type" | "iat" | "exp"> = {
      sub: row.userId,
      roleId: row.user.role?.id ?? "",
      role: row.user.role?.name ?? "VIEWER",
      jti: newJti,
    };
    const refreshPayload: Omit<RefreshTokenPayload, "type" | "iat" | "exp"> = {
      sub: row.userId,
      jti: newJti,
      familyId: row.familyId, // 👈 IMPORTANT: same family, so reuse detection still links them!
    };
    const newAccess = signAccessToken(accessPayload);
    const newRefresh = signRefreshToken(refreshPayload);
    const newHash = hashRefreshToken(newRefresh);
    const ttlSec = expiresInToSeconds(CONFIG.jwt.refreshExpiresIn);

    await prisma.refreshToken.create({
      data: {
        userId: row.userId,
        jti: newJti,
        familyId: row.familyId,
        tokenHash: newHash,
        expiresAt: new Date(Date.now() + ttlSec * 1000),
        ipAddress: meta.ip ?? null,
        userAgent: meta.ua ?? null,
      },
    });

    const permissions =
      row.user.role?.permissions?.map((rp) => rp.permission.code).filter(Boolean) ?? [];

    return {
      newRefreshJwt: newRefresh,
      response: {
        accessToken: newAccess,
        tokenType: "Bearer",
        expiresInSec: expiresInToSeconds(CONFIG.jwt.accessExpiresIn),
        user: userToDto({
          ...row.user,
          role: row.user.role ? { id: row.user.role.id, name: row.user.role.name } : null,
        }),
        permissions,
      },
    };
  },

  /**
   * Logout: revoke the specific refresh token row that matches current cookie jti
   * (NOT the whole family — only if user explicitly logs out themselves).
   * If no cookie, return success anyway (idempotent; UX doesn't care).
   */
  async logout(rawRefreshJwt: string | undefined): Promise<{ ok: true }> {
    if (!rawRefreshJwt) return { ok: true };
    try {
      const decoded = verifyRefreshToken(rawRefreshJwt);
      await prisma.refreshToken.update({
        where: { jti: decoded.jti },
        data: { revokedAt: new Date() },
      });
    } catch {
      // signature invalid or already revoked? no-op on logout.
    }
    return { ok: true };
  },

  /**
   * Forgot password: ALWAYS return { ok: true } regardless of whether the user exists,
   * to prevent user enumeration (email not found would otherwise leak).
   *
   * If user EXISTS:
   *   - create PasswordResetToken row: { userId, tokenHash=sha256(rawToken), expiresAt=+15m, usedAt=NULL }
   *   - rawToken (UUID) is embedded in reset link returned to user.
   *   - In LOCAL DEV: console.log the clickable reset link directly in backend terminal.
   *     (No email service configured. Production: integrate SendGrid/Resend/SES here.)
   */
  async forgotPassword(
    dto: ForgotPasswordDto,
    _meta: { ip?: string; ua?: string },
  ): Promise<{ ok: true; rawToken?: string; resetLink?: string }> {
    const email = dto.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const rawToken = randomUUID();
      const tokenHash = hashRefreshToken(rawToken); // Reuse sha256 helper; 256-bit collision resistance.
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
          ipAddress: _meta.ip ?? null,
          userAgent: _meta.ua ?? null,
        },
      });
      const resetLink = `${CONFIG.cors.frontendUrl}/reset-password?token=${rawToken}`;
      // NO EMAIL SERVICE in local dev — print to terminal (admin can click)
      console.log(
        "📧 [FAKE EMAIL - LOCAL DEV ONLY] ============================================",
      );
      console.log(`  To: ${user.email}`);
      console.log(`  Subject: Password reset link (expires in 15 minutes)`);
      console.log(`  Link: ${resetLink}`);
      console.log(
        "======================================================================",
      );
      return { ok: true, rawToken, resetLink };
    }

    // User not found → DO NOTHING (still return ok so enumeration impossible).
    // Small fixed 100ms delay so response timing cannot leak "found vs not".
    await new Promise((r) => setTimeout(r, 100));
    return { ok: true };
  },

  /**
   * Reset password:
   *   - token (raw UUID URL param from email link)
   *   - SHA256 it → look up PasswordResetToken by hash
   *   - If not found / usedAt != NULL / expiresAt < now / family revoked → 422 invalid/expired
   *   - One-shot: flip usedAt, UPDATE user.passwordHash, flip mustChangePassword to false
   *   - Also: revoke ALL refresh tokens for this user (logout everywhere = safe practice)
   */
  async resetPassword(
    dto: ResetPasswordDto,
    _meta: { ip?: string; ua?: string },
  ): Promise<{ ok: true }> {
    const tokenHash = hashRefreshToken(dto.token);
    const row = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!row) {
      throw new UnprocessableEntityError(
        "This reset link is invalid or has already been used.",
      );
    }
    if (row.usedAt !== null) {
      throw new UnprocessableEntityError(
        "This reset link has already been used. Please request a new one.",
      );
    }
    if (new Date() > row.expiresAt) {
      throw new UnprocessableEntityError(
        "This reset link has expired. Please request a new one.",
      );
    }
    if (!row.user) {
      throw new NotFoundError("No user found for this reset link.");
    }

    const passwordHash = await hashPassword(dto.newPassword);

    await prisma.$transaction([
      // 1. Flip reset token used flag
      prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
      // 2. Update user password + clear mustChangePassword flag
      prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash, mustChangePassword: false },
      }),
      // 3. Logout EVERYWHERE (revoke active refresh tokens for this userId — attacker cannot keep session if they had old pass)
      prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date(), isFamilyRevoked: true },
      }),
    ]);

    return { ok: true };
  },

  /**
   * GET /api/v1/auth/me — returns current user profile + permission codes.
   * Route-level authenticate() middleware already ran & attached req.user.
   * Useful for: Frontend on page reload to "hydrate" Redux auth state AND
   * drive all PermissionGate wrappers (which rely on permissions list).
   */
  async me(userId: string): Promise<{ user: UserProfileDto; permissions: string[] }> {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            displayName: true,
            permissions: {
              select: { permission: { select: { code: true } } },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundError("User not found.");
    if (row.status !== "ACTIVE") throw new ForbiddenError("Account is inactive.");
    const permissions =
      row.role?.permissions?.map((rp) => rp.permission.code).filter(Boolean) ?? [];
    return {
      user: userToDto({
        ...row,
        role: row.role
          ? { id: row.role.id, name: row.role.name }
          : null,
      }),
      permissions,
    };
  },

  /**
   * POST /auth/change-password — authenticated user changes their own password.
   * (NOT password reset via email! That's the reset-password endpoint above.)
   *
   * Flow:
   *   1. Fetch user by req.user.id
   *   2. bcrypt.compare(currentPassword, user.passwordHash) — fail with 422 if wrong
   *   3. newPassword same as old → ConflictError "Must choose a new password."
   *   4. bcrypt.hash(newPassword) → UPDATE user
   *   5. Flip mustChangePassword flag to false (so seed admin can finally pass the gate)
   *   6. Revoke ALL existing refresh tokens for this user → logout everywhere
   *   7. Return { ok: true }
   */
  async changePassword(
    dto: ChangePasswordDto & { userId: string }
  ): Promise<{ ok: true }> {
    const user = await prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundError("User not found.");
    if (user.status !== "ACTIVE") throw new ForbiddenError("Account is inactive.");

    const currentPwValid = await verifyPassword(dto.currentPassword, user.passwordHash);
    if (!currentPwValid) {
      throw new UnprocessableEntityError(
        "Current password is incorrect. Please try again or use Forgot Password."
      );
    }

    // Guard against reusing the same password (policy)
    const sameAsOld = await verifyPassword(dto.newPassword, user.passwordHash);
    if (sameAsOld) {
      throw new ConflictError("New password must be different from the current password.");
    }

    const passwordHash = await hashPassword(dto.newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangePassword: false },
      }),
      // Logout EVERYWHERE (security best practice after password change)
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date(), isFamilyRevoked: true },
      }),
    ]);

    return { ok: true };
  },
};
