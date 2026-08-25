/**
 * Zod-based request validation middleware factory.
 * Usage:
 *   router.post('/', validate({ body: CreateUserZodSchema }), controller)
 *
 * Validates req.params / req.query / req.body according to the provided
 * Zod schemas and mutates req in-place (safe because schemas default to
 * passthrough or strict as configured). Throws UnprocessableEntityError
 * with flattened error details on failure.
 */
import type { Request, Response, NextFunction } from "express";
import type { z, ZodSchema } from "zod";
import { UnprocessableEntityError } from "../lib/errors";

type ValidateTarget = "params" | "query" | "body";

export type ValidationSchemas = Partial<Record<ValidateTarget, ZodSchema>>;

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: Array<{ field: string; message: string }> = [];
    (Object.keys(schemas) as ValidateTarget[]).forEach((target) => {
      const schema = schemas[target] as z.ZodTypeAny | undefined;
      if (!schema) return;
      const result = schema.safeParse(req[target]);
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            field: issue.path.join("."),
            message: issue.message,
          });
        }
      } else {
        // Replace raw data with parsed data (Zod transforms/coercions applied)
        (req as unknown as Record<ValidateTarget, unknown>)[target] = result.data;
      }
    });
    if (errors.length) {
      next(new UnprocessableEntityError("Validation failed", errors));
      return;
    }
    next();
  };
}
