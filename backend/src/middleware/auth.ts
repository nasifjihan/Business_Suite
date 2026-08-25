/**
 * Authentication middleware: extracts Bearer <accessToken> from the
 * Authorization header, verifies signature + expiry, attaches `req.user`.
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

const BEARER_RX = /^Bearer +([A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+)$/;

export function authenticate(required = true) {
  return function authMiddleware(req: Request, _res: Response, next: NextFunction) {
    try {
      const header = req.headers.authorization;

      if (!header) {
        if (required) {
          throw new UnauthorizedError(
            "Authentication required. Provide an access token via the Authorization: Bearer <token> header."
          );
        }
        req.user = undefined;
        return next();
      }

      const match = BEARER_RX.exec(header.trim());
      if (!match) {
        throw new UnauthorizedError("Malformed Authorization header. Expected 'Bearer <jwt>'.");
      }
      const token = match[1];
      const decoded = verifyAccessToken(token);
      const user: AuthenticatedUser = {
        id: decoded.sub,
        roleId: decoded.roleId,
        role: decoded.role,
        jti: decoded.jti,
      };
      req.user = user;
      next();
    } catch (err) {
      // Even if optional auth, a PRESENT but INVALID token still returns 401.
      // Only the TOTAL ABSENCE of a header lets optional auth slip through.
      next(err);
    }
  };
}
