/**
 * Shared API envelope type (matches backend successResponsePaginated output shape).
 */
export type ApiErrorShape = {
  code: string;
  message: string;
  details?: unknown[];
};

export type ApiResponse<T> =
  | { success: true; data: T; meta?: PaginationMeta }
  | { success: false; error: ApiErrorShape };

export type PaginationMeta = {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type Paginated<T> = {
  success: true;
  data: T[];
  meta: PaginationMeta;
};
