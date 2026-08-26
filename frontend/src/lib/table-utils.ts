import type { ReadonlyURLSearchParams } from "next/navigation";
import {
  createColumnHelper,
  tableFeatures,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowExpandingFeature,
  createSortedRowModel,
  createPaginatedRowModel,
  createExpandedRowModel,
  type SortingState,
  type PaginationState,
} from "@tanstack/react-table";

export type TableFeatures = ReturnType<typeof DEFAULT_FEATURES_FACTORY>;

export const DEFAULT_FEATURES_FACTORY = () =>
  tableFeatures({
    rowSortingFeature,
    rowPaginationFeature,
    rowSelectionFeature,
    rowExpandingFeature,
    sortedRowModel: createSortedRowModel(),
    paginatedRowModel: createPaginatedRowModel(),
    expandedRowModel: createExpandedRowModel(),
  });

export const tableFeaturesDefault = DEFAULT_FEATURES_FACTORY();

export interface PaginationMetaShape {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

export interface ListEnvelopeData<T> {
  items: T[];
  meta: PaginationMetaShape;
}

export interface RTKQueryResultLike<T> {
  data?:
    | { success?: boolean; data?: ListEnvelopeData<T> }
    | { success?: boolean; data?: T[]; message?: string }
    | null;
  isFetching?: boolean;
  isError?: boolean;
  error?: any;
  refetch?: () => any;
  isLoading?: boolean;
}

export function createColumns<TData extends object>() {
  return createColumnHelper<TableFeatures, TData>();
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
}

export function getPaginationParamsFromSearchParams(
  sp: ReadonlyURLSearchParams | URLSearchParams,
  defaults?: Partial<PaginationParams>
): PaginationParams {
  const pageRaw = sp.get("page");
  const pageSizeRaw = sp.get("pageSize");
  const sortBy = sp.get("sortBy") ?? defaults?.sortBy ?? undefined;
  const sortOrderRaw = sp.get("sortOrder");
  const search = sp.get("search") ?? defaults?.search ?? undefined;

  const page = pageRaw ? parseInt(pageRaw, 10) : defaults?.page ?? 1;
  const pageSize = pageSizeRaw ? parseInt(pageSizeRaw, 10) : defaults?.pageSize ?? 25;

  const sortOrder =
    sortOrderRaw === "asc" || sortOrderRaw === "desc"
      ? sortOrderRaw
      : defaults?.sortOrder ?? "desc";

  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 25,
    sortBy,
    sortOrder,
    search,
  };
}

export function urlParamsFromState(
  pagination: PaginationState,
  sorting: SortingState,
  search?: string,
  extra?: Record<string, string | string[] | undefined | null>
): Record<string, string> {
  const params: Record<string, string> = {
    page: String(pagination.pageIndex + 1),
    pageSize: String(pagination.pageSize),
  };
  if (sorting.length > 0) {
    const first = sorting[0];
    params.sortBy = first.id;
    params.sortOrder = first.desc ? "desc" : "asc";
  }
  if (search) params.search = search;
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        if (v.length === 0) continue;
        params[k] = v.join(",");
      } else {
        params[k] = v;
      }
    }
  }
  return params;
}

export function extractItemsAndMeta<TData extends object>(
  result: RTKQueryResultLike<TData>["data"]
): { items: TData[]; meta: PaginationMetaShape | undefined } {
  if (!result) return { items: [], meta: undefined };
  if (Array.isArray((result as any).data)) {
    return { items: (result as any).data as TData[], meta: undefined };
  }
  if ((result as any).data && typeof (result as any).data === "object") {
    const inner = (result as any).data;
    if (Array.isArray(inner.items) && inner.meta) {
      return {
        items: inner.items as TData[],
        meta: inner.meta as PaginationMetaShape,
      };
    }
  }
  return { items: [], meta: undefined };
}

export type {
  SortingState,
  PaginationState,
  TableOptions as TableOptionsAny,
} from "@tanstack/react-table";
