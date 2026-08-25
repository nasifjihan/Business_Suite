/**
 * Health module — verifies backend + database connectivity.
 * GET /api/v1/health returns { status: 'ok', dbOk: true, timestamp }
 *
 * Architecture: routes → controllers → services (one-way dependency).
 * No DB calls allowed directly in controller. All DB lives in services.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { successResponse } from "../../lib/response";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { StatusCodes } from "http-status-codes";

// ── Services ────────────────────────────────────────────────────────────────

export class HealthService {
  static async check(): Promise<{
    status: "ok" | "degraded";
    dbOk: boolean;
    timestamp: string;
    version: string;
  }> {
    let dbOk = false;
    try {
      // A trivial raw query to confirm the adapter + Postgres talk.
      const row = await prisma.$queryRawUnsafe<[{ ok: number }]>("SELECT 1::int as ok");
      dbOk = Array.isArray(row) && row[0]?.ok === 1;
    } catch (err) {
      throw new AppError(StatusCodes.SERVICE_UNAVAILABLE, "Database connection failed", {
        cause: err instanceof Error ? err : undefined,
      });
    }
    return {
      status: dbOk ? "ok" : "degraded",
      dbOk,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "0.0.0",
    };
  }
}

// ── Controllers ─────────────────────────────────────────────────────────────

export const healthController = {
  async check(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await HealthService.check();
      successResponse(res, data, data.dbOk ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE);
    } catch (err) {
      next(err);
    }
  },
};

// ── Routes ──────────────────────────────────────────────────────────────────

export const healthRouter = Router();
healthRouter.get("/", healthController.check);
