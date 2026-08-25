/**
 * Pagination helpers — keep every list endpoint consistent.
 * ------------------------------------------------------------------
 * Endpoints that list many records (CRM/customers, Sales/orders, etc.)
 * share the same query-params: ?page=1&perPage=20&sortBy=createdAt&sortOrder=desc
 *
 * These helpers parse the raw query string, compute the skip/take for Prisma,
 * and build the `meta` object for the success envelope.
 */
import type { Request } from "express";
import { z } from "zod";

export const PAGINATION_DEFAULTS = {
  page: 1,
  perPage: 20,
  perPageMax: 200,
} as const;

const schema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : PAGINATION_DEFAULTS.page))
    .pipe(z.number().int().min(1).default(PAGINATION_DEFAULTS.page)),
  perPage: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : PAGINATION_DEFAULTS.perPage))
    .pipe(
      z
        .number()
        .int()
        .min(1)
        .max(PAGINATION_DEFAULTS.perPageMax)
        .default(PAGINATION_DEFAULTS.perPage)
    ),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().trim().optional(),
});

export type ParsedPagination = z.infer<typeof schema> & {
  skip: number;
  take: number;
};

export function parsePaginationQuery(req: Request): ParsedPagination {
  const parsed = schema.parse(req.query);
  const page = parsed.page;
  const perPage = parsed.perPage;
  return {
    ...parsed,
    skip: (page - 1) * perPage,
    take: perPage,
  };
}

export function buildPaginationMeta(input: {
  page: number;
  perPage: number;
  totalItems: number;
}) {
  const { page, perPage, totalItems } = input;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  return {
    page,
    perPage,
    totalItems,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
