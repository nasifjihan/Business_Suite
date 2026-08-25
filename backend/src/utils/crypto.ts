/**
 * SHA-256 helpers for refresh & password-reset tokens.
 *
 * Why hash tokens we store? Defense-in-depth:
 *   - Raw refresh JWTs can mint new access tokens if stolen from DB.
 *   - Password reset raw tokens can change a user's password.
 * By storing only the SHA-256 hash, a SELECT * dump gives attacker zero usable links.
 * On verification we re-hash the incoming raw token, compare against DB hash.
 */
import { createHash, randomBytes } from "crypto";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function hashRefreshToken(jwtOrToken: string): string {
  return sha256Hex(jwtOrToken);
}

export function randomToken(lenBytes = 32): string {
  return createHash("sha512").update(randomBytes(lenBytes)).digest("hex");
}
