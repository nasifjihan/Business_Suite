/**
 * Standard JSON response envelope (per docs/api.md).
 * ------------------------------------------------------------------
 * Success envelope:  { success: true,  data: T,  meta?: Meta }
 * Error envelope:    { success: false, error: { code, message, details?: [] } }
 *
 * Benefits of a single envelope:
 * 1. Frontend RTK query hooks can parse responses predictably.
 * 2. `success:boolean` is a visible contract on every response.
 * 3. `meta` carries pagination info for list endpoints.
 */
import type { Response } from "express";

export function successResponse<T>(
  res: Response,
  data: T,
  status = 200
): Response<{ success: true; data: T }> {
  return res.status(status).json({ success: true, data });
}

export function successResponsePaginated<T>(
  res: Response,
  data: T[],
  meta: {
    page: number;
    perPage: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  },
  status = 200
): Response<{ success: true; data: T[]; meta: typeof meta }> {
  return res.status(status).json({ success: true, data, meta });
}

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: unknown[];
}

export function errorResponse(
  res: Response,
  statusCode: number,
  error: ApiErrorShape
): Response<{ success: false; error: ApiErrorShape }> {
  return res.status(statusCode).json({ success: false, error });
}
