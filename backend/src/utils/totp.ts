/**
 * TOTP (RFC 6238) helpers — the only place that talks to `otplib`.
 * ------------------------------------------------------------------
 * Keeping the library behind this module means the auth service never has to
 * know about plugin options or about otplib's failure modes.
 *
 * otplib v13 note: `verify()` is ASYNC and, unlike v12, it THROWS on a secret
 * it cannot Base32-decode rather than returning `{ valid: false }`. Since the
 * secret comes from our own database, that throw means "corrupted or
 * key-rotated row", which is a boolean to the caller, not an exception.
 */
import { generateSecret, generateURI, verify } from "otplib";
import { randomBytes } from "crypto";
import { CONFIG } from "@/config/env";
import { sha256Hex } from "@/utils/crypto";

/** New Base32 secret, 160 bits — the size Google Authenticator recommends. */
export function createTotpSecret(): string {
  return generateSecret();
}

/**
 * otpauth:// URI for the enrolment QR code. The issuer shows as the app name
 * and the label as the account, so a user with several Business Suite accounts
 * can tell them apart.
 */
export function buildOtpAuthUri(secret: string, accountLabel: string): string {
  return generateURI({
    strategy: "totp",
    issuer: CONFIG.twoFactor.issuer,
    label: accountLabel,
    secret,
  });
}

/**
 * @param driftSteps how many 30-second steps either side of "now" to accept.
 *        1 tolerates ~30s of clock skew, which covers virtually every phone
 *        without meaningfully widening the brute-force window (a 6-digit code
 *        is ~1e-6 per guess either way; the rate limiter is the real control).
 */
export async function verifyTotpCode(
  secret: string,
  token: string,
  driftSteps = 1,
): Promise<boolean> {
  const expectedDigits = CONFIG.twoFactor.digits;
  // Reject before the crypto call: otplib would otherwise have to parse junk.
  if (!new RegExp(`^\\d{${expectedDigits}}$`).test(token)) return false;

  try {
    const result = await verify({
      secret,
      token,
      epochTolerance: driftSteps * CONFIG.twoFactor.periodSec,
    });
    return result.valid === true;
  } catch {
    return false;
  }
}

/* ── Recovery codes ────────────────────────────────────────────────────── */

/**
 * Human-transcribable one-time codes, e.g. `4F9A2-C10B7-8E3D5-A6F42`.
 *
 * Hex rather than a full alphabet on purpose: these get read off a screen and
 * typed on a phone, and 0/O and 1/l confusions are the main way that goes
 * wrong. 20 hex characters = 80 bits, ample for a code that is also
 * rate-limited and single-use.
 */
export function createRecoveryCodes(count = CONFIG.twoFactor.recoveryCodeCount): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(10).toString("hex").toUpperCase();
    return raw.match(/.{1,5}/g)!.join("-");
  });
}

/**
 * Canonical form for hashing and comparison: dash/space-free, uppercase.
 * The user may type the code from the screen (dashes) or paste it without
 * them, and both must hash to the same value.
 */
export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

export function hashRecoveryCode(code: string): string {
  return sha256Hex(normalizeRecoveryCode(code));
}
