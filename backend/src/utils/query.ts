/**
 * Query-string schema primitives.
 *
 * Express delivers every query value as a string, so a raw `z.boolean()` on a
 * query schema rejects `?isActive=true` outright (422). Plain
 * `z.coerce.boolean()` is wrong in the other direction:
 * `Boolean("false") === true`, so `?lowOnly=false` silently behaved exactly
 * like `?lowOnly=true`.
 */
import { z } from "zod";

/** Accepts `"true"` / `"false"` (query strings) or real booleans (JSON bodies). */
export const booleanQuery = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((v) => v === true || v === "true");
