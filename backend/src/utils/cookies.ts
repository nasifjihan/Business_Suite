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
    // "none" in production because the frontend (Vercel) and the API (Render)
    // are different sites. Browsers do not send a Strict/Lax cookie on a
    // cross-site request, so the refresh cookie would never reach the API and
    // every session would die at the first token refresh.
    // SameSite=None is only honoured together with Secure, which is set above
    // for production. Cross-site reads stay blocked by the CORS allow-list.
    sameSite: isProd ? "none" : "lax",
    path: "/",
    domain: CONFIG.cors.cookieDomain === "localhost" ? undefined : CONFIG.cors.cookieDomain,
    // Express res.cookie() takes maxAge in MILLISECONDS and divides by 1000 to
    // write the header. Passing seconds here produced "Max-Age=604" (~10 min)
    // for a 7-day token: the JWT stayed valid but the browser discarded the
    // cookie, so refresh failed and the user was silently logged out.
    maxAge: seconds * 1000,
  };
}

export const CLEAR_REFRESH_COOKIE_OPTIONS: CookieOptions = {
  ...buildRefreshCookieOptions(0),
  expires: new Date(0),   // Force-expire for old browsers that ignore Max-Age.
  maxAge: 0,
};
