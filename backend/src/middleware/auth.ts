/**
 * Authentication middleware: extracts Bearer <accessToken> from the
 * Authorization header, verifies signature + expiry, attaches `req.user`
 * AND `req.permissionCodes[]` (from DB via role → permissions).
 *
 * Also enforces: if User.status=INACTIVE, the request is rejected with
 * 401 (regardless of JWT validity). DB check happens on every request
 * so admin deactivations take effect within 1 request, not just on token
 * expiry (Pitfall #6 in teaching header).
 *
 * Usage:
 *   router.get('/protected', authenticate(), (req, res) => { ... })
 *     → Access tokens required. Missing/invalid tokens throw 401.
 *
 *   router.get('/maybe', authenticate(false), (req, res) => { ... })
 *     → Optional auth: if token present, attach req.user. If invalid, 401.
 *       If missing entirely, req.user = undefined, request continues.
 */
import type { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "@/lib/errors";
import { verifyAccessToken } from "@/utils/jwt";
import type { AuthenticatedUser } from "@/utils/authTypes";
import { prisma } from "@/lib/prisma";
import { UserStatus } from "@prisma/client";

const BEARER_RX = /^Bearer +([A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+)$/;

export function authenticate(required = true) {
  return function authMiddleware(req: Request, _res: Response, next: NextFunction) {
    (async () => {
      try {
        const header = req.headers.authorization;

        if (!header) {
          if (required) {
            throw new UnauthorizedError(
              "Authentication required. Provide an access token via the Authorization: Bearer <token> header."
            );
          }
          req.user = undefined;
          req.permissionCodes = [];
          return next();
        }

        const match = BEARER_RX.exec(header.trim());
        if (!match) {
          throw new UnauthorizedError("Malformed Authorization header. Expected 'Bearer <jwt>'.");
        }
        const token = match[1];
        const decoded = verifyAccessToken(token);

        // ── DB HIT: fresh status + perms ──────────────────────────────
        // Prevents: JWT still valid but admin deactivated user 5s ago.
        // Also loads permissions into req.permissionCodes for authorize().
        const row = await prisma.user.findUnique({
          where: { id: decoded.sub },
          select: {
            id: true,
            email: true,
            status: true,
            roleId: true,
            role: {
              select: {
                id: true,
                name: true,
                permissions: { select: { permission: { select: { code: true } } } },
              },
            },
          },
        });
        if (!row) {
          throw new UnauthorizedError("Authentication failed — user account not found.");
        }
        if (row.status === UserStatus.INACTIVE) {
          throw new UnauthorizedError(
            "Authentication failed — this account has been deactivated. Contact an administrator."
          );
        }
        const user: AuthenticatedUser = {
          id: row.id,
          roleId: row.role?.id ?? decoded.roleId,
          role: row.role?.name ?? decoded.role,
          jti: decoded.jti,
        };
        req.user = user;
        req.permissionCodes =
          row.role?.permissions?.map((rp) => rp.permission.code).filter(Boolean) ?? [];
        next();
      } catch (err) {
        // Even if optional auth, a PRESENT but INVALID token still returns 401.
        // Only the TOTAL ABSENCE of a header lets optional auth slip through.
        next(err);
      }
    })();
  };
}
