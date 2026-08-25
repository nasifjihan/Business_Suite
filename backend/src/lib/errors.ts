/**
 * Centralized typed error classes.
 * ------------------------------------------------------------------
 * Controllers and services ONLY throw these classes.
 * The errorHandler middleware (#last-in-chain) maps them to the
 * correct HTTP status + standard JSON envelope.
 *
 * Design:
 * - AppError is the base; it takes an HTTP status code, a public
 *   message, and optional details (array of Zod issues etc).
 * - Specific subclasses reduce boilerplate in controllers.
 * - `isPublic: true` tells the errorHandler it's safe to echo the
 *   message back to the client (never echo raw JS Error messages).
 */
import { StatusCodes } from "http-status-codes";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown[];

  constructor(
    statusCode: number,
    message: string,
    options?: { details?: unknown[]; cause?: unknown }
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = options?.details;
    if (options?.cause && options.cause instanceof Error) {
      this.stack = options.cause.stack;
    } else {
      Error.captureStackTrace(this);
    }
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: unknown[]) {
    super(StatusCodes.BAD_REQUEST, message, { details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized — please log in again") {
    super(StatusCodes.UNAUTHORIZED, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden — you lack permission to perform this action") {
    super(StatusCodes.FORBIDDEN, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(StatusCodes.NOT_FOUND, message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict — record already exists or state prevents this action") {
    super(StatusCodes.CONFLICT, message);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = "Validation failed", details?: unknown[]) {
    super(StatusCodes.UNPROCESSABLE_ENTITY, message, { details });
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests — slow down and try again later") {
    super(StatusCodes.TOO_MANY_REQUESTS, message);
  }
}
