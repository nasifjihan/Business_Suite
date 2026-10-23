/**
 * Fail-fast environment config validation using Zod.
 * ------------------------------------------------------------------
 * The #1 cause of "weird bugs" in dev is missing env vars.
 * By validating them ONCE at import, we throw a clean, readable error
 * instead of letting undefined values leak into JWT secrets or DB URLs.
 *
 * Usage: import { CONFIG } from "@/config/env"
 * Never read process.env directly in application code.
 */
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z
    .string()
    .default("5000")
    .refine((v) => !Number.isNaN(parseInt(v, 10)), "PORT must be numeric"),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL connection string"),
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 chars"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 chars"),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("7d"),
  FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL"),
  COOKIE_DOMAIN: z.string().default("localhost"),
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .default("900000")
    .refine((v) => !Number.isNaN(parseInt(v, 10))),
  RATE_LIMIT_MAX: z
    .string()
    .default("100")
    .refine((v) => !Number.isNaN(parseInt(v, 10))),
  // Local-development escape hatch (see CONFIG.rateLimit.disabled below).
  DISABLE_RATE_LIMIT: z.string().default("false"),
  // Number of reverse proxies in front of the app (see CONFIG.trustProxy).
  TRUST_PROXY: z.string().optional(),

  // ── Email / SMTP ───────────────────────────────────────────────────
  // Every one of these is OPTIONAL. MAIL_ENABLED=false (the default) is a
  // fully supported mode: forgot-password falls back to printing the reset
  // link in the server terminal, so local dev needs no credentials at all.
  //
  // They are declared here rather than read from process.env directly for the
  // Phase 14 lesson: a var used in docker-compose.yml but absent from this
  // schema is silently ignored, which looks exactly like working config.
  MAIL_ENABLED: z.string().default("false"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z
    .string()
    .optional()
    .refine((v) => v === undefined || !Number.isNaN(parseInt(v, 10)), "SMTP_PORT must be numeric"),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  // Accepts either "user@example.com" or the "Name <user@example.com>" form.
  MAIL_FROM: z.string().optional(),

  // ── Two-factor authentication ──────────────────────────────────────
  // Key material for encrypting stored TOTP secrets (AES-256-GCM). OPTIONAL:
  // falls back to JWT_ACCESS_SECRET so a local checkout needs no extra config.
  //
  // Set a dedicated value in production. Otherwise rotating
  // JWT_ACCESS_SECRET — a routine, security-positive action — silently makes
  // every enrolled TOTP secret undecryptable, locking users out until they
  // re-enrol or use a recovery code.
  TOTP_ENCRYPTION_KEY: z.string().optional(),
  // Shown in the authenticator app next to the account name.
  TOTP_ISSUER: z.string().default("Business Suite"),
});

const raw = envSchema.safeParse(process.env);

if (!raw.success) {
  const issues = raw.error.issues.map(
    (i) => `  ❌ ${i.path.join(".")}: ${i.message}`
  );
  console.error("================================================");
  console.error("FATAL: Environment configuration is invalid!");
  console.error("Check backend/.env for the following issues:\n");
  console.error(issues.join("\n"));
  console.error("================================================");
  process.exit(1);
}

export const CONFIG = {
  nodeEnv: raw.data.NODE_ENV,
  /**
   * How many reverse proxies sit in front of this app.
   *
   * Express only reads the client IP out of X-Forwarded-For when this is set.
   * Left unset behind a load balancer (Render, Fly, a Docker nginx), req.ip is
   * the PROXY address for every request - so express-rate-limit puts the whole
   * internet in one bucket and ten login attempts globally lock everybody out.
   *
   * Defaults to 1 in production (Render and our nginx each add exactly one hop)
   * and 0 in development, where there is no proxy. Raise it only to match real
   * hops: trusting more proxies than exist lets a client forge X-Forwarded-For
   * and bypass rate limiting entirely.
   */
  trustProxy: raw.data.TRUST_PROXY !== undefined
    ? parseInt(raw.data.TRUST_PROXY, 10)
    : raw.data.NODE_ENV === "production" ? 1 : 0,
  port: parseInt(raw.data.PORT, 10),
  databaseUrl: raw.data.DATABASE_URL,
  jwt: {
    accessSecret: raw.data.JWT_ACCESS_SECRET,
    refreshSecret: raw.data.JWT_REFRESH_SECRET,
    accessExpiresIn: raw.data.ACCESS_TOKEN_EXPIRES_IN,
    refreshExpiresIn: raw.data.REFRESH_TOKEN_EXPIRES_IN,
  },
  cors: {
    frontendUrl: raw.data.FRONTEND_URL,
    cookieDomain: raw.data.COOKIE_DOMAIN,
  },
  rateLimit: {
    windowMs: parseInt(raw.data.RATE_LIMIT_WINDOW_MS, 10),
    max: parseInt(raw.data.RATE_LIMIT_MAX, 10),
    // Bypass every limiter while clicking through the UI by hand in dev.
    // Double-guarded: the flag ALONE is not enough — NODE_ENV must also be
    // "development", so a stray DISABLE_RATE_LIMIT=true in a deployed
    // environment can never remove the brute-force shield from /auth/login.
    // Deliberately false under NODE_ENV=test: the suite controls limiter
    // behaviour itself via the express-rate-limit mock in src/tests/setup.ts.
    disabled:
      raw.data.NODE_ENV === "development" && raw.data.DISABLE_RATE_LIMIT === "true",
  },
  /**
   * Outbound email. `enabled` is the ONLY switch callers should read — never
   * test SMTP_HOST yourself, or the meaning of "mail is configured" drifts
   * between call sites.
   */
  mail: {
    enabled: raw.data.MAIL_ENABLED === "true",
    host: raw.data.SMTP_HOST,
    // 587 = STARTTLS submission (the common port). Set SMTP_SECURE=true (and
    // usually port 465) for implicit TLS.
    port: raw.data.SMTP_PORT ? parseInt(raw.data.SMTP_PORT, 10) : 587,
    secure: raw.data.SMTP_SECURE === "true",
    // Both unset = an unauthenticated relay (Mailhog/Mailpit in dev, or a
    // local MTA). One without the other is almost certainly a config mistake.
    user: raw.data.SMTP_USER,
    pass: raw.data.SMTP_PASS,
    from: raw.data.MAIL_FROM ?? "Business Suite <no-reply@business-suite.local>",
  },
  twoFactor: {
    // `||` (not `??`) on purpose: Docker passes unset variables through as
    // EMPTY STRINGS, and a blank key would silently produce a different AES
    // key than the documented fallback. sha256() in utils/crypto.ts turns
    // either value into a full-entropy 256-bit AES key.
    encryptionKey: raw.data.TOTP_ENCRYPTION_KEY || raw.data.JWT_ACCESS_SECRET,
    issuer: raw.data.TOTP_ISSUER,
    /** Digits in a TOTP code — also the length the API validates against. */
    digits: 6,
    /** Seconds a code stays valid. Authenticator apps assume 30. */
    periodSec: 30,
    /** Recovery codes handed out at enrolment. */
    recoveryCodeCount: 10,
  },
} as const;

export type ConfigShape = typeof CONFIG;
