/**
 * Refresh-token cookie options. Single source of truth — every place that writes
 * a Set-Cookie for refresh uses this function:
 *   - AuthService.login    (new cookie, Max-Age full refresh lifetime)
 *   - AuthService.refresh  (rotation = NEW cookie, full lifetime again)
 *   - AuthService.logout   (clear cookie = expires Thu 01 Jan 1970)
 */
import { CookieOptions } from "express";
import { CONFIG } from "@/config/env";

/**
 * Convert the Zod-parsed refresh expiresIn config string ("7d"/"15m") into
 * a numeric MAX-AGE in seconds (cookie spec = Max-Age takes precedence over Expires).
 */
function expiresInToSeconds(s: string): number {
  const matches = s.match(/^(\d+)(ms|s|m|h|d|w|y)?$/);
  if (!matches) return 7 * 24 * 60 * 60; // fallback 7d
  const [, nRaw, unit = "d"] = matches;
  const n = parseInt(nRaw, 10);
  const multiplier: Record<string, number> = {
    ms: 0.001, s: 1, m: 60, h: 3600, d: 86400, w: 604800, y: 31536000,
  };
  return Math.floor(n * (multiplier[unit] ?? 86400));
}

export function buildRefreshCookieOptions(maxAgeSec?: number): CookieOptions {
  const isProd = CONFIG.nodeEnv === "production";
  const seconds = maxAgeSec ?? expiresInToSeconds(CONFIG.jwt.refreshExpiresIn);
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    path: "/",
    domain: CONFIG.cors.cookieDomain === "localhost" ? undefined : CONFIG.cors.cookieDomain,
    maxAge: seconds,
  };
}

export const CLEAR_REFRESH_COOKIE_OPTIONS: CookieOptions = {
  ...buildRefreshCookieOptions(0),
  expires: new Date(0),   // Force-expire for old browsers that ignore Max-Age.
  maxAge: 0,
};
