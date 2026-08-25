/**
 * Express app assembly — middleware stack ORDER MATTERS.
 * Stack from top to bottom:
 *   1. helmet      (security headers — every response, even 404s, should have them)
 *   2. cors        (OPTIONS preflight needs a response BEFORE auth rejects)
 *   3. compression (gzip JSON)
 *   4. express.json ({ limit: '10mb' }) — parse JSON bodies
 *   5. cookieParser
 *   6. standardLimiter (global rate limit)
 *   7. auditLogger (start capture — it listens to res 'finish')
 *   8. /api/v1 routes
 *   9. notFoundHandler (any URL not matched above)
 *  10. errorHandler (CATCH ALL, LAST — never move this)
 */
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import { CONFIG } from "./config/env";
import { standardLimiter } from "./middleware/rateLimiter";
import { auditLogger } from "./middleware/auditLogger";
import { notFoundHandler } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";
import { apiV1Router } from "./routes";

export function createApp() {
  const app = express();

  // 1. Security headers first (CSP tweaked for local Next.js inline styles from Tailwind)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", CONFIG.cors.frontendUrl],
        },
      },
    })
  );

  // 2. CORS — single-origin + credentialed (needed for HTTP-only refresh token cookie)
  app.use(
    cors({
      origin: CONFIG.cors.frontendUrl,
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
      exposedHeaders: ["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      maxAge: 86400,
    })
  );

  // 3. Compression
  app.use(compression());

  // 4. Body + cookie parsers
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // 5. Global rate limiting
  app.use(standardLimiter);

  // 6. Audit logger (records after res finish)
  app.use(auditLogger);

  // 7. API routes
  app.use("/api/v1", apiV1Router);

  // 8. 404
  app.use(notFoundHandler);

  // 9. ★ ABSOLUTELY LAST: centralized error handler ★
  app.use(errorHandler);

  return app;
}
