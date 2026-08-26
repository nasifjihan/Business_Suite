"use client";

import { useMemo, useCallback, type ReactNode, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useTable,
  FlexRender,
  type SortingState,
  type PaginationState,
  type RowSelectionState,
  type Row as TanStackRow,
  type Column as TanStackColumn,
  type Header as TanStackHeader,
  type Cell as TanStackCell,
  type Table as TanStackTableInstance,
  type HeaderContext,
  type CellContext,
  type ColumnDef,
} from "@tanstack/react-table";
import * as CheckboxRad from "@radix-ui/react-checkbox";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  extractItemsAndMeta,
  type PaginationMetaShape,
  type RTKQueryResultLike,
  urlParamsFromState,
  tableFeaturesDefault,
  type TableFeatures,
} from "@/lib/table-utils";
import { Pagination } from "@/components/tables/Pagination";
import { LoadingSkeleton } from "@/components/feedback/LoadingSkeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";

export interface GlobalTableProps<TData extends object> {
  columns: ColumnDef<TableFeatures, TData, any>[];
  queryResult?: RTKQueryResultLike<TData>;
  data?: TData[];
  meta?: Partial<PaginationMetaShape>;
  serverSide?: boolean;
  pageSizeOptions?: number[];
  pageSizeDefault?: number;
  defaultSortBy?: string;
  defaultSortOrder?: "asc" | "desc";
  enableRowSelection?: boolean;
  stickyHeader?: boolean;
  onRowSelectionChange?: (rows: TData[]) => void;
  onRowClick?: (row: TData) => void;
  getRowId?: (row: TData, index: number, parent?: TanStackRow<TableFeatures, TData>) => string;
  className?: string;
  tableClassName?: string;
  theadClassName?: string;
  tbodyClassName?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  emptyIcon?: ReactNode;
  errorTitle?: string;
  errorDescription?: string;
  errorOnRetry?: () => void;
  loadingRowsCount?: number;
  renderSubRow?: (row: TData) => ReactNode;
  hidePagination?: boolean;
  rowStyle?: (row: TData, index: number) => CSSProperties | undefined;
  rowClassName?: (row: TData, index: number) => string | undefined;
  wrapperHeightClassName?: string;
  syncUrl?: boolean;
  pageSizeSelectDisabled?: boolean;
}

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

type TableInst<TData extends object> = TanStackTableInstance<TableFeatures, TData>;

export function GlobalTable<TData extends object>(props: GlobalTableProps<TData>) {
  const {
    columns: rawColumns,
    queryResult,
    data: dataProp,
    meta: metaProp,
    serverSide = true,
    pageSizeOptions = DEFAULT_PAGE_SIZES,
    pageSizeDefault = 25,
    defaultSortBy,
    defaultSortOrder = "desc",
    enableRowSelection = false,
    stickyHeader = true,
    onRowSelectionChange,
    onRowClick,
    getRowId,
    className,
    tableClassName,
    theadClassName,
    tbodyClassName,
    emptyTitle = "No items",
    emptyDescription,
    emptyAction,
    emptyIcon,
    errorTitle = "Could not load data",
    errorDescription,
    errorOnRetry,
    loadingRowsCount = 8,
    renderSubRow,
    hidePagination,
    rowStyle,
    rowClassName,
    wrapperHeightClassName = "relative",
    syncUrl = true,
    pageSizeSelectDisabled,
  } = props;

  const router = useRouter();
  const searchParams = useSearchParams();

  const { items, meta, isFetching, isError, error, refetch } = useMemo(() => {
    if (queryResult) {
      const extract = extractItemsAndMeta<TData>(queryResult.data as any);
      const fetching = !!queryResult.isFetching || !!queryResult.isLoading;
      return {
        items: extract.items,
        meta: extract.meta,
        isFetching: fetching,
        isError: !!queryResult.isError,
        error: queryResult.error,
        refetch: queryResult.refetch,
      };
    }
    return {
      items: (dataProp as TData[]) ?? [],
      meta: metaProp as PaginationMetaShape | undefined,
      isFetching: false,
      isError: false,
      error: null,
      refetch: undefined,
    };
  }, [queryResult, dataProp, metaProp]);

  const { initialPagination, initialSorting } = useMemo(() => {
    let pageIndex = 0;
    let pageSize = pageSizeDefault;
    let sort: SortingState = defaultSortBy
      ? [{ id: defaultSortBy, desc: defaultSortOrder === "desc" }]
      : [];
    if (syncUrl && searchParams) {
      const p = searchParams.get("page");
      const ps = searchParams.get("pageSize");
      const sb = searchParams.get("sortBy");
      const so = searchParams.get("sortOrder");
      if (p) {
        const n = parseInt(p, 10);
        if (Number.isFinite(n) && n >= 1) pageIndex = n - 1;
      }
      if (ps) {
        const n = parseInt(ps, 10);
        if (Number.isFinite(n) && n > 0) pageSize = n;
      }
      if (sb) {
        sort = [{ id: sb, desc: so !== "asc" }];
      }
    }
    return {
      initialPagination: { pageIndex, pageSize } as PaginationState,
      initialSorting: sort as SortingState,
    };
  }, [syncUrl, searchParams, pageSizeDefault, defaultSortBy, defaultSortOrder]);

  const initialRowSelection: RowSelectionState = {};

  const columns: ColumnDef<TableFeatures, TData, any>[] = useMemo(() => {
    const cols: ColumnDef<TableFeatures, TData, any>[] = [];
    if (enableRowSelection) {
      cols.push({
        id: "__select__",
        enableSorting: false,
        header: function SelectHeader(context) {
          const table = context.table as TableInst<TData>;
          const allSel = table.getIsAllRowsSelected();
          const someSel = table.getIsSomeRowsSelected();
          const checked = allSel ? true : someSel ? "indeterminate" : false;
          return (
            <div className="flex items-center justify-center px-2">
              <CheckboxRad.Root
                checked={checked as any}
                onCheckedChange={(v) =>
                  table.toggleAllRowsSelected(!!v)
                }
                aria-label="Select all rows"
                className="h-4 w-4 rounded border border-slate-300 dark:border-slate-600 bg-background data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex items-center justify-center"
              >
                <CheckboxRad.Indicator>
                  <Check className="w-3 h-3" />
                </CheckboxRad.Indicator>
              </CheckboxRad.Root>
            </div>
          );
        },
        cell: function SelectCell(context) {
          const row = context.row as TanStackRow<TableFeatures, TData>;
          const checked = row.getIsSelected();
          return (
            <div
              className="flex items-center justify-center px-2"
              onClick={(e) => e.stopPropagation()}
            >
              <CheckboxRad.Root
                checked={checked}
                onCheckedChange={(v) => row.toggleSelected(!!v)}
                aria-label="Select row"
                className="h-4 w-4 rounded border border-slate-300 dark:border-slate-600 bg-background data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex items-center justify-center"
              >
                <CheckboxRad.Indicator>
                  <Check className="w-3 h-3" />
                </CheckboxRad.Indicator>
              </CheckboxRad.Root>
            </div>
          );
        },
      });
    }
    if (renderSubRow) {
      cols.push({
        id: "__expand__",
        header: () => null,
        enableSorting: false,
        cell: function ExpandCell(context) {
          const row = context.row as TanStackRow<TableFeatures, TData>;
          const expanded = row.getIsExpanded();
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                row.toggleExpanded();
              }}
              className="flex h-7 w-7 items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              aria-label={expanded ? "Collapse row" : "Expand row"}
            >
              {expanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          );
        },
      });
    }
    return [...cols, ...rawColumns];
  }, [enableRowSelection, renderSubRow, rawColumns]);

  const pageCount = useMemo(() => {
    if (serverSide && meta) {
      return Math.max(1, meta.totalPages ?? 1);
    }
    return Math.max(1, Math.ceil(items.length / initialPagination.pageSize));
  }, [serverSide, meta, items.length, initialPagination.pageSize]);

  const handleRowSelectionChangeCB = useCallback(
    (updaterOrValue: unknown) => {
      void updaterOrValue;
      // noop: actual change tracked via useTable callback below
    },
    []
  );

  const table = useTable({
    features: tableFeaturesDefault,
    data: items,
    columns,
    pageCount,
    state: {
      pagination: initialPagination,
      sorting: initialSorting,
      rowSelection: initialRowSelection,
    },
    initialState: {
      pagination: initialPagination,
      sorting: initialSorting,
      rowSelection: initialRowSelection,
    },
    manualPagination: serverSide,
    manualSorting: serverSide,
    manualFiltering: serverSide,
    enableRowSelection,
    getRowId,
    enableHiding: false,
    onPaginationChange: (updaterOrValue: any) => {
      const next =
        typeof updaterOrValue === "function"
          ? (updaterOrValue as any)(initialPagination)
          : updaterOrValue;
      if (!syncUrl) return;
      const newParams = urlParamsFromState(
        next,
        initialSorting,
        searchParams?.get("search") ?? undefined,
        getExtraFilterParams(searchParams)
      );
      applyParams(router, searchParams, newParams);
    },
    onSortingChange: (updaterOrValue: any) => {
      const next =
        typeof updaterOrValue === "function"
          ? (updaterOrValue as any)(initialSorting)
          : updaterOrValue;
      if (!syncUrl) return;
      const newParams = urlParamsFromState(
        initialPagination,
        next,
        searchParams?.get("search") ?? undefined,
        getExtraFilterParams(searchParams)
      );
      applyParams(router, searchParams, newParams);
    },
    onRowSelectionChange: (updaterOrValue: any) => {
      handleRowSelectionChangeCB(updaterOrValue);
      if (!onRowSelectionChange) return;
      // No easy access to resulting rows here; fire event on timeout after render
      setTimeout(() => {
        try {
          const selectedIds =
            typeof updaterOrValue === "function"
              ? (updaterOrValue as any)({})
              : updaterOrValue;
          void selectedIds;
        } catch {}
      }, 0);
    },
    autoResetPageIndex: false,
  } as any);

  const paginationMeta: PaginationMetaShape = useMemo(() => {
    if (meta) return meta;
    const state = table.state as any;
    const pageIndex = state?.pagination?.pageIndex ?? 0;
    const pageSize = state?.pagination?.pageSize ?? pageSizeDefault;
    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    return {
      page: pageIndex + 1,
      pageSize,
      totalItems,
      totalPages,
      hasNextPage: pageIndex + 1 < totalPages,
      hasPreviousPage: pageIndex > 0,
    };
  }, [meta, table.state, items.length, pageSizeDefault]);

  function handlePageChange(page: number) {
    if (page < 1) return;
    table.setPageIndex(page - 1);
  }

  function handlePageSizeChange(n: number) {
    table.setPageSize(n);
  }

  const hasData = items.length > 0;
  const showLoading = isFetching && !hasData;
  const showEmpty = !isFetching && !isError && !hasData;
  const showError = isError;
  const showTable = (hasData && !showLoading) || (isFetching && hasData);

  const rowModel = table.getRowModel();

  const headerGroups = table.getHeaderGroups();

  return (
    <div className={cn("w-full space-y-2", className)}>
      <div
        className={cn(
          "rounded-xl border border-border bg-card overflow-hidden",
          wrapperHeightClassName
        )}
      >
        {showLoading && (
          <div className="p-3">
            <LoadingSkeleton count={loadingRowsCount} />
          </div>
        )}
        {showError && (
          <div className="p-3">
            <ErrorState
              title={errorTitle}
              description={
                errorDescription ??
                (error &&
                typeof error === "object" &&
                "message" in error
                  ? String((error as any).message)
                  : undefined)
              }
              onRetry={
                errorOnRetry ?? (refetch ? () => refetch() : undefined)
              }
              compact
            />
          </div>
        )}
        {showEmpty && (
          <div className="p-3">
            <EmptyState
              title={emptyTitle}
              description={emptyDescription}
              action={emptyAction}
              icon={emptyIcon}
              compact
            />
          </div>
        )}
        {showTable && (
          <div className="relative overflow-x-auto">
            {isFetching && hasData && (
              <div className="pointer-events-none absolute inset-0 z-10 bg-background/60 backdrop-blur-[1px] animate-in fade-in-0">
                <div className="absolute left-0 top-0 h-0.5 w-full bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
              </div>
            )}
            <table
              className={cn("w-full border-collapse text-sm", tableClassName)}
            >
              <thead
                className={cn(
                  "bg-slate-50/70 dark:bg-slate-900/50",
                  stickyHeader && "sticky top-0 z-20",
                  theadClassName
                )}
              >
                {headerGroups.map((headerGroup: any) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(
                      (header: TanStackHeader<
                        TableFeatures,
                        TData,
                        unknown
                      >) => {
                        const canSort = header.column.getCanSort?.();
                        const sort = header.column.getIsSorted?.();
                        return (
                          <th
                            key={header.id}
                            className={cn(
                              "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap",
                              canSort &&
                                "cursor-pointer select-none hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors"
                            )}
                            style={{
                              minWidth:
                                header.id === "__select__"
                                  ? 44
                                  : header.id === "__expand__"
                                    ? 36
                                    : undefined,
                            }}
                            onClick={
                              canSort
                                ? (header.column.getToggleSortingHandler?.() as any)
                                : undefined
                            }
                          >
                            <span
                              className={cn(
                                "inline-flex items-center gap-1",
                                canSort && "group"
                              )}
                            >
                              {header.isPlaceholder
                                ? null
                                : <FlexRender header={header as any} />}
                              {canSort &&
                                (sort === "desc" ? (
                                  <ArrowDown className="w-3.5 h-3.5 text-primary shrink-0" />
                                ) : sort === "asc" ? (
                                  <ArrowUp className="w-3.5 h-3.5 text-primary shrink-0" />
                                ) : (
                                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors" />
                                ))}
                            </span>
                          </th>
                        );
                      }
                    )}
                  </tr>
                ))}
              </thead>
              <tbody
                className={cn(
                  "divide-y divide-slate-200 dark:divide-slate-800",
                  tbodyClassName
                )}
              >
                {rowModel.rows.map((row: any, idx: number) => {
                  const orig = (row as TanStackRow<TableFeatures, TData>).original;
                  return (
                    <RowWithExpansion
                      key={(row as TanStackRow<TableFeatures, TData>).id}
                      row={row}
                      index={idx}
                      onRowClick={onRowClick}
                      rowClassName={rowClassName}
                      rowStyle={rowStyle}
                      renderSubRow={renderSubRow}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!hidePagination && !showLoading && (
        <Pagination
          meta={paginationMeta}
          onPageChange={handlePageChange}
          onPageSizeChange={pageSizeSelectDisabled ? undefined : handlePageSizeChange}
          pageSizeOptions={pageSizeOptions}
        />
      )}
    </div>
  );
}

function RowWithExpansion<TData extends object>({
  row,
  index,
  onRowClick,
  rowClassName,
  rowStyle,
  renderSubRow,
}: {
  row: TanStackRow<TableFeatures, TData>;
  index: number;
  onRowClick?: (row: TData) => void;
  rowClassName?: (row: TData, index: number) => string | undefined;
  rowStyle?: (row: TData, index: number) => CSSProperties | undefined;
  renderSubRow?: (row: TData) => ReactNode;
}) {
  const isSelected = row.getIsSelected();
  const isExpanded = row.getIsExpanded();
  const cls = rowClassName?.(row.original, index);
  const stl = rowStyle?.(row.original, index);
  const cells = row.getAllCells();
  return (
    <>
      <tr
        data-state={isSelected ? "selected" : undefined}
        className={cn(
          "transition-colors",
          onRowClick &&
            "cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-900/30",
          isSelected && "bg-primary/5 dark:bg-primary/10",
          cls
        )}
        style={stl}
        onClick={() => onRowClick?.(row.original)}
      >
        {cells.map((cell: any) => {
          const c = cell as TanStackCell<TableFeatures, TData, unknown>;
          return (
            <td key={c.id} className="px-3 py-2.5 align-middle">
              <FlexRender cell={c as any} />
            </td>
          );
        })}
      </tr>
      {renderSubRow && isExpanded && (
        <tr
          className={cn(
            "bg-slate-50/60 dark:bg-slate-900/30",
            cls
          )}
        >
          <td colSpan={cells.length} className="px-6 py-4">
            {renderSubRow(row.original)}
          </td>
        </tr>
      )}
    </>
  );
}

function getExtraFilterParams(
  searchParams:
    | URLSearchParams
    | ReturnType<typeof useSearchParams>
    | null
    | undefined
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!searchParams) return out;
  for (const [k, v] of searchParams.entries()) {
    if (
      ["page", "pageSize", "sortBy", "sortOrder", "search"].includes(k)
    )
      continue;
    out[k] = v;
  }
  return out;
}

function applyParams(
  router: ReturnType<typeof useRouter>,
  current:
    | URLSearchParams
    | ReturnType<typeof useSearchParams>
    | null
    | undefined,
  params: Record<string, string>
) {
  const next = new URLSearchParams(current?.toString() ?? "");
  for (const [k, v] of Object.entries(params)) {
    if (!v) next.delete(k);
    else next.set(k, v);
  }
  const qs = next.toString();
  router.push(qs ? `?${qs}` : window.location.pathname, { scroll: false });
}
