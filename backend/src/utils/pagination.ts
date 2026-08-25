/**
 * Pagination helpers (spec §9.100 — §10.23):
 *   page 1-based, default 25, max 100.
 *   meta shape: { page, pageSize, totalItems, totalPages, hasNext, hasPrevious }
 */
import { z } from "zod";

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_SIZE: 25,
  MAX_SIZE: 100,
} as const;

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(PAGINATION.DEFAULT_PAGE),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_SIZE)
    .default(PAGINATION.DEFAULT_SIZE),
  search: z.string().trim().max(100).optional(),
  sortBy: z.string().trim().max(50).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationQuery = z.infer<typeof PaginationSchema>;

export function buildPaginationMeta(args: {
  page: number;
  pageSize: number;
  totalItems: number;
}) {
  const { page, pageSize, totalItems } = args;
  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(1, pageSize)));
  const hasNext = page < totalPages;
  const hasPrevious = page > 1;
  return { page, pageSize, totalItems, totalPages, hasNext, hasPrevious };
}

export function applyPagination(args: { page: number; pageSize: number }) {
  const page = Math.max(1, args.page);
  const pageSize = Math.min(PAGINATION.MAX_SIZE, Math.max(1, args.pageSize));
  return { skip: (page - 1) * pageSize, take: pageSize };
}
