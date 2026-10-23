/**
 * AuthService — all business logic for authentication flows.
 *
 * THICK SERVICE, THIN CONTROLLER: controllers only parse request bodies,
 * validate them, call these methods, format responses.
 */
import { randomUUID } from "crypto";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { CONFIG } from "@/config/env";
import { hashPassword, verifyPassword } from "@/utils/password";
import {
  signAccessToken,
  signRefreshToken,
  signTwoFactorChallenge,
  verifyRefreshToken,
  verifyTwoFactorChallenge,
  RefreshTokenPayloadSchema,
  type AccessTokenPayload,
  type RefreshTokenPayload,
} from "@/utils/jwt";
import { hashRefreshToken, encryptSecret, decryptSecret } from "@/utils/crypto";
import {
  createTotpSecret,
  buildOtpAuthUri,
  verifyTotpCode,
  createRecoveryCodes,
  hashRecoveryCode,
} from "@/utils/totp";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
} from "@/lib/errors";
import type { RoleType, UserStatus } from "@prisma/client";
import { sendMail, renderPasswordResetEmail } from "@/lib/mailer";
import type {
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  TwoFactorVerifyDto,
  TwoFactorEnableDto,
  TwoFactorDisableDto,
} from "./validators";
import type {
  LoginResponseDto,
  RefreshResponseDto,
  UserProfileDto,
  TwoFactorChallengeDto,
  TwoFactorSetupResponseDto,
  TwoFactorEnableResponseDto,
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

/**
 * The user shape both login paths need: profile fields plus the role with its
 * permissions. Declared once so `login` and `verifyTwoFactorLogin` cannot
 * drift into selecting different columns.
 */
type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  status: UserStatus;
  mustChangePassword: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  role: {
    id: string;
    name: RoleType;
    permissions: { permission: { code: string } }[];
  } | null;
};

const USER_WITH_ROLE_INCLUDE = {
  role: {
    select: {
      id: true,
      name: true,
      permissions: { select: { permission: { select: { code: true } } } },
    },
  },
} as const;

/**
 * Mint a refresh-token family + access token for an already-authenticated
 * user, and return the login payload.
 *
 * Shared by the two ways a session can begin: a plain password login, and the
 * second step of a 2FA login. The 2FA variant would otherwise have to repeat
 * every line below, and the two copies would eventually disagree about, say,
 * whether lastLoginAt is stamped by recovery-code logins too.
 */
async function issueSession(
  user: SessionUser,
  meta: { ip: string | undefined; ua: string | undefined },
): Promise<{ response: LoginResponseDto; refreshJwt: string }> {
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

  const ttlSec = expiresInToSeconds(CONFIG.jwt.refreshExpiresIn);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      jti,
      familyId,
      tokenHash: hashRefreshToken(refreshJwt),
      expiresAt: new Date(Date.now() + ttlSec * 1000),
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
}

/**
 * Outcome of a password check. A union rather than a nullable token so the
 * controller is forced by the type checker to handle the 2FA branch — the
 * failure mode this guards against (issuing a session for a password-only
 * login on a 2FA account) is invisible at runtime.
 */
export type LoginOutcome =
  | { kind: "session"; response: LoginResponseDto; refreshJwt: string }
  | { kind: "2fa_required"; response: TwoFactorChallengeDto };


export const AuthService = {
  /**
   * Login flow, step 1:
   *   - find user by email (or NOT, but we still bcrypt dummy hash so timing equal)
   *   - verify password (constant time even if no user)
   *   - check ACTIVE status
   *   - if 2FA is enabled → return a short-lived CHALLENGE instead of a session
   *   - otherwise: create refresh token family, sign tokens, return them
   *
   * The order matters: the password is verified BEFORE the 2FA branch is taken,
   * so the challenge is only ever handed to someone who already proved they
   * know the password. Answering "2FA required" for an unknown address would
   * itself be an account-enumeration oracle.
   */
  async login(
    dto: LoginDto,
    meta: { ip: string | undefined; ua: string | undefined },
  ): Promise<LoginOutcome> {
    const email = dto.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
      include: USER_WITH_ROLE_INCLUDE,
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

    if (user.twoFactorEnabled) {
      return {
        kind: "2fa_required",
        response: {
          twoFactorRequired: true,
          // No refresh cookie, no access token — this token is spendable only
          // at /auth/2fa/verify, and only for 5 minutes.
          challengeToken: signTwoFactorChallenge({ sub: user.id, jti: randomUUID() }),
        },
      };
    }

    const session = await issueSession(user, meta);
    return { kind: "session", ...session };
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
   *   - email the reset link containing rawToken (UUID).
   *   - If email is disabled or the send fails, print the link to the server
   *     terminal instead, so local dev needs no SMTP credentials.
   *
   * NOTE: every path must stay the same shape and the same rough duration.
   * The email send is awaited but `sendMail` never throws, so a broken SMTP
   * host degrades to the console fallback rather than a 500.
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

      const delivered = await sendMail({
        to: user.email,
        ...renderPasswordResetEmail({
          firstName: user.firstName,
          resetLink,
          expiresInMinutes: 15,
        }),
      });

      if (!delivered) {
        // Local-dev fallback: MAIL_ENABLED=false, or SMTP rejected the message.
        console.log(
          "📧 [RESET LINK - MAIL DISABLED OR FAILED] =============================",
        );
        console.log(`  To: ${user.email}`);
        console.log(`  Link: ${resetLink}`);
        console.log(
          "======================================================================",
        );
      }

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

  /* ── Two-factor authentication (TOTP) ───────────────────────────────── */

  /**
   * Login step 2: exchange a challenge + code for a real session.
   *
   * `code` may be either a 6-digit TOTP or a recovery code. Recovery codes are
   * consumed on use (one-time), so a stolen list is worth one login per code
   * rather than unlimited access.
   */
  async verifyTwoFactorLogin(
    dto: TwoFactorVerifyDto,
    meta: { ip: string | undefined; ua: string | undefined },
  ): Promise<{ response: LoginResponseDto; refreshJwt: string }> {
    const challenge = verifyTwoFactorChallenge(dto.challengeToken);

    const user = await prisma.user.findUnique({
      where: { id: challenge.sub },
      include: USER_WITH_ROLE_INCLUDE,
    });

    // One message for every one of these cases: unknown user, 2FA switched off
    // between the two steps, and an unreadable secret are all "start over",
    // and distinguishing them would leak account state to a caller who has
    // not yet presented a valid second factor.
    const restart = new UnauthorizedError(
      "Your two-factor challenge is no longer valid. Please sign in again.",
    );
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) throw restart;
    if (user.status !== "ACTIVE") {
      throw new ForbiddenError(
        "This account has been disabled. Contact your administrator.",
      );
    }

    const secret = decryptSecret(user.twoFactorSecret, CONFIG.twoFactor.encryptionKey);
    if (!secret) throw restart;

    const isTotp = await verifyTotpCode(secret, dto.code);
    let usedRecoveryCode = false;

    if (!isTotp) {
      const hashed = hashRecoveryCode(dto.code);
      if (user.twoFactorRecoveryCodes.includes(hashed)) {
        usedRecoveryCode = true;
        // Consume it atomically-ish: the `has` filter re-checks membership, so
        // two concurrent requests cannot both spend the same code.
        await prisma.user.update({
          where: { id: user.id },
          data: { twoFactorRecoveryCodes: { set: user.twoFactorRecoveryCodes.filter((c) => c !== hashed) } },
        });
      } else {
        throw new UnauthorizedError("That verification code is not valid.");
      }
    }

    if (usedRecoveryCode) {
      console.warn(
        `[2FA] recovery code used for user ${user.id}; ${
          user.twoFactorRecoveryCodes.length - 1
        } remaining`,
      );
    }

    return issueSession(user, meta);
  },

  /**
   * Begin enrolment. Generates a secret and stores it ENCRYPTED but leaves
   * `twoFactorEnabled` false.
   *
   * This deliberately does not switch 2FA on. A user who scans the QR code and
   * then closes the tab must not be locked out of an account protected by a
   * secret they never confirmed — enrolment only completes in `enableTwoFactor`,
   * when a working code proves the secret reached their device.
   */
  async startTwoFactorSetup(userId: string): Promise<TwoFactorSetupResponseDto> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError("User not found.");
    if (user.twoFactorEnabled) {
      throw new ConflictError(
        "Two-factor authentication is already enabled on this account.",
      );
    }

    // Regenerating on every call invalidates any half-finished previous attempt,
    // so a stale QR code in an abandoned tab can never be the one that ends up
    // enrolled.
    const secret = createTotpSecret();
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: encryptSecret(secret, CONFIG.twoFactor.encryptionKey) },
    });

    const otpauthUrl = buildOtpAuthUri(secret, user.email);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: "M",
    });

    return { secret, otpauthUrl, qrDataUrl };
  },

  /**
   * Complete enrolment: verify a live code, switch 2FA on, and issue the
   * recovery codes.
   *
   * Codes are returned in plaintext EXACTLY ONCE and stored only as SHA-256
   * hashes. There is no endpoint to read them back — the deliberate trade-off
   * is that a user who loses both their device and their codes must have an
   * administrator reset 2FA for them.
   */
  async enableTwoFactor(
    userId: string,
    dto: TwoFactorEnableDto,
  ): Promise<TwoFactorEnableResponseDto> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError("User not found.");
    if (user.twoFactorEnabled) {
      throw new ConflictError("Two-factor authentication is already enabled.");
    }
    if (!user.twoFactorSecret) {
      throw new UnprocessableEntityError(
        "Start two-factor setup before confirming a code.",
      );
    }

    const secret = decryptSecret(user.twoFactorSecret, CONFIG.twoFactor.encryptionKey);
    if (!secret) {
      throw new UnprocessableEntityError(
        "That setup could not be read. Please restart two-factor setup.",
      );
    }

    if (!(await verifyTotpCode(secret, dto.code))) {
      throw new UnprocessableEntityError(
        "That code is not valid. Check your device's clock and try again.",
      );
    }

    const recoveryCodes = createRecoveryCodes();
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorRecoveryCodes: recoveryCodes.map(hashRecoveryCode),
      },
    });

    return { ok: true, recoveryCodes };
  },

  /**
   * Turn 2FA off. Requires the account password (owner decision): a hijacked
   * live session must not be able to quietly remove the second factor.
   *
   * The secret and recovery codes are wiped, so re-enabling starts from a brand
   * new secret rather than resurrecting the old one.
   */
  async disableTwoFactor(
    userId: string,
    dto: TwoFactorDisableDto,
  ): Promise<{ ok: true }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError("User not found.");

    const passwordValid = await verifyPassword(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnprocessableEntityError("That password is not correct.");
    }

    if (!user.twoFactorEnabled) {
      // Idempotent: disabling something already off is not an error worth a
      // scary message, but the password check above still had to pass.
      return { ok: true };
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorRecoveryCodes: [],
      },
    });

    return { ok: true };
  },

  /** Drives the profile page's 2FA card. */
  async getTwoFactorStatus(userId: string): Promise<{
    enabled: boolean;
    recoveryCodesRemaining: number;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, twoFactorRecoveryCodes: true },
    });
    if (!user) throw new NotFoundError("User not found.");

    return {
      enabled: user.twoFactorEnabled,
      recoveryCodesRemaining: user.twoFactorRecoveryCodes.length,
    };
  },
};
