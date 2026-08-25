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
  },
} as const;

export type ConfigShape = typeof CONFIG;
