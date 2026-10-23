import type { Request, Response, NextFunction } from "express";
import { HealthService } from "./services";
import { successResponse } from "../../lib/response";

export const healthCheck = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await HealthService.getStatus();

    // A degraded probe must not be reported as `success: true`. Every other
    // non-2xx in this API carries the failure envelope, and the frontend's RTK
    // Query slice only reads `data` on 2xx — a `success: true` body on a 503 is
    // a contradiction that only the Docker HEALTHCHECK (which ignores the body)
    // was tolerating. `data` is kept alongside `error` so an operator hitting
    // /health by hand can still see WHY the probe failed.
    if (data.db !== "connected") {
      return res.status(503).json({
        success: false,
        data,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Database is unreachable.",
        },
      });
    }

    successResponse(res, data, 200);
  } catch (e) {
    next(e);
  }
};
