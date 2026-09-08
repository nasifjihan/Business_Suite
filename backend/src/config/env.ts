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
} as const;

export type ConfigShape = typeof CONFIG;
