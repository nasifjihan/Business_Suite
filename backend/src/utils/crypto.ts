/**
 * Cryptographic utils NOT related to JWT signing (JWT uses jsonwebtoken package).
 *   - randomToken(n) = cryptographically random URL-safe string (for password reset links, refresh token jti)
 *   - sha256(str)   = hex-encoded sha256 (for storing refresh-token families, so DB leak doesn't give usable tokens)
 */
import { randomBytes, createHash } from "node:crypto";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
