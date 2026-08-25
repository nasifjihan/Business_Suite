/**
 * Password hashing + constant-time comparison utilities.
 *
 * Why bcrypt?
 *   - Purpose-built slow hash (CPU-bound). 2^10 rounds = ~10 hashes/sec modern CPU.
 *   - Offline brute-force of a DB dump is impractical at 10 guesses/sec/user.
 * Why NOT SHA-256 for passwords?
 *   - SHA-256 is fast (10^9 hashes/sec on GPU). Fast hash = GPU crackable in hours.
 *
 * Critical: bcrypt.compare() is timing-attack-safe (constant-time). NEVER compare
 * password hashes with plain JS === or String.localeCompare. EVER.
 */
import bcrypt from "bcryptjs";

const BCRYPT_SALT_ROUNDS = 10;

/**
 * DUMMY hash generated at module load time.
 * Used for: if the submitted email has NO user row, we still run bcrypt.compare()
 * against a STANDARD dummy hash so attacker cannot measure timing difference
 * between "email not found" (0ms) vs "wrong password" (~100ms). This thwarts
 * timing-based user-enumeration attacks.
 */
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing-attack-protection", BCRYPT_SALT_ROUNDS);

export function hashPassword(plaintext: string): Promise<string> {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("Password must be a non-empty string.");
  }
  return bcrypt.hash(plaintext, BCRYPT_SALT_ROUNDS);
}

export async function verifyPassword(
  submitted: string | undefined,
  storedHash: string | undefined
): Promise<boolean> {
  // Either input absent → run dummy compare for constant timing, return false.
  const hashToCheck = storedHash ?? DUMMY_HASH;
  const pwToCheck = typeof submitted === "string" ? submitted : "@@@empty-submission-@@@";
  const ok = await bcrypt.compare(pwToCheck, hashToCheck);
  // Additional safety: if user record did not exist, we MUST still return false
  // regardless of what bcrypt.compare said (it should be false anyway).
  return ok && Boolean(storedHash);
}
