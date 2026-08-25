/**
 * HTTP server entry point.
 *   - Validates env (side-effect import of env.ts triggers Zod parsing)
 *   - Constructs the Express app
 *   - Listens on CONFIG.port
 *   - Handles SIGTERM / SIGINT for graceful shutdown (drain open requests, disconnect Prisma)
 */
import { CONFIG } from "./config/env";
import { logger } from "./config/logger";
import { createApp } from "./app";
import { prisma } from "./lib/prisma";

async function bootstrap() {
  logger.info(`Environment: ${CONFIG.nodeEnv}`);

  // Warm the DB connection pool so the first /health call is fast
  try {
    const row = await prisma.$queryRawUnsafe<[{ version: string }]>(
      "SELECT version() as version LIMIT 1"
    );
    const version = Array.isArray(row) ? row[0]?.version ?? "unknown" : "unknown";
    const pgNumber = String(version).match(/PostgreSQL\s+(\d+(?:\.\d+)?)/)?.[1] ?? "unknown";
    logger.info(`Database connection OK (PostgreSQL ${pgNumber})`);
  } catch (err) {
    logger.warn(
      "Database NOT reachable at startup — API will boot anyway but /health will 503.",
      err instanceof Error ? err.message : undefined
    );
  }

  const app = createApp();

  const server = app.listen(CONFIG.port, () => {
    logger.info(`Server listening on port ${CONFIG.port}`);
    logger.info(`API base URL: http://localhost:${CONFIG.port}/api/v1`);
    logger.info(`CORS origin: ${CONFIG.cors.frontendUrl}`);
  });

  const graceful = async (signal: NodeJS.Signals) => {
    logger.info(`${signal} received — initiating graceful shutdown`);
    server.close(() => logger.info("HTTP server closed"));
    await prisma.$disconnect();
    logger.info("Prisma disconnected — exiting cleanly");
    process.exit(0);
  };

  process.on("SIGTERM", () => void graceful("SIGTERM"));
  process.on("SIGINT", () => void graceful("SIGINT"));
}

void bootstrap();
