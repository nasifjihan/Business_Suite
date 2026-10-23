/**
 * SHA-256 helpers for refresh & password-reset tokens.
 *
 * Why hash tokens we store? Defense-in-depth:
 *   - Raw refresh JWTs can mint new access tokens if stolen from DB.
 *   - Password reset raw tokens can change a user's password.
 * By storing only the SHA-256 hash, a SELECT * dump gives attacker zero usable links.
 * On verification we re-hash the incoming raw token, compare against DB hash.
 */
import { createHash, randomBytes, createCipheriv, createDecipheriv } from "crypto";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function hashRefreshToken(jwtOrToken: string): string {
  return sha256Hex(jwtOrToken);
}

export function randomToken(lenBytes = 32): string {
  return createHash("sha512").update(randomBytes(lenBytes)).digest("hex");
}

/* ── Reversible encryption for secrets that must be read back ─────────────
 *
 * Hashing is the right tool for anything we only need to COMPARE (passwords,
 * refresh tokens, recovery codes). It is the wrong tool for a TOTP secret:
 * verifying a code requires recomputing it from the original secret, so the
 * secret has to be recoverable. Encryption, not hashing.
 *
 * AES-256-GCM gives confidentiality AND tamper detection — a modified
 * ciphertext fails the auth-tag check instead of decrypting to garbage that
 * would then be used as a TOTP secret.
 */

/** Any passphrase -> a full-entropy 256-bit key. */
function keyBytes(keyMaterial: string): Buffer {
  return createHash("sha256").update(keyMaterial, "utf8").digest();
}

/**
 * Format:  v1.<iv>.<authTag>.<ciphertext>   (all base64url)
 *
 * The version prefix is there so a future key-rotation or algorithm change can
 * be detected and migrated instead of being silently misparsed.
 */
export function encryptSecret(plaintext: string, keyMaterial: string): string {
  const iv = randomBytes(12); // 96-bit nonce, the GCM standard
  const cipher = createCipheriv("aes-256-gcm", keyBytes(keyMaterial), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * @returns the plaintext, or null if the payload is malformed, was encrypted
 *          with a different key, or has been tampered with.
 *
 * Deliberately does NOT throw. The caller is a login path, and "this secret
 * cannot be read" is a state the app must survive gracefully (the user
 * re-enrols, or uses a recovery code) — not a 500.
 */
export function decryptSecret(payload: string, keyMaterial: string): string | null {
  try {
    const [version, iv, tag, data] = payload.split(".");
    if (version !== "v1" || !iv || !tag || !data) return null;

    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyBytes(keyMaterial),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
