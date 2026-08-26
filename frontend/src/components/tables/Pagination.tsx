"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalSelect } from "@/components/form/GlobalSelect";
import { cn } from "@/lib/utils";

export interface PaginationMetaShape {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

export interface PaginationProps {
  meta: Partial<PaginationMetaShape> | null | undefined;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  showPageSizeSelect?: boolean;
  showInfoText?: boolean;
  className?: string;
  nextLabel?: ReactNode;
  prevLabel?: ReactNode;
}

function pageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 0) return [];
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "...")[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);

  if (left > 2) pages.push("...");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push("...");
  pages.push(total);

  return pages;
}

export function Pagination({
  meta,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  showPageSizeSelect = true,
  showInfoText = true,
  className,
  nextLabel,
  prevLabel,
}: PaginationProps) {
  const page = meta?.page ?? 1;
  const pageSize = meta?.pageSize ?? pageSizeOptions[1] ?? 10;
  const totalItems = meta?.totalItems ?? 0;
  const totalPages = meta?.totalPages ?? Math.max(1, Math.ceil(totalItems / pageSize));
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  const numbers = pageNumbers(page, totalPages);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-3",
        className
      )}
    >
      {showInfoText && (
        <div className="text-xs text-muted-foreground">
          {totalItems === 0 ? (
            <span>No items</span>
          ) : (
            <span>
              Showing{" "}
              <span className="font-medium text-foreground">{from}</span>
              {" – "}
              <span className="font-medium text-foreground">{to}</span>
              {" of "}
              <span className="font-semibold text-foreground">{totalItems.toLocaleString()}</span>
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {showPageSizeSelect && onPageSizeChange && (
          <GlobalSelect
            value={String(pageSize)}
            placeholder="Page size"
            className="!w-auto [--radix-select-trigger-width:6rem]"
            options={pageSizeOptions.map((n) => ({
              value: String(n),
              label: `${n} / page`,
            }))}
            onChange={(v) => {
              const n = parseInt(v, 10);
              onPageSizeChange(n);
              onPageChange(1);
            }}
          />
        )}
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="outline"
            type="button"
            disabled={!hasPrevious}
            onClick={() => onPageChange(1)}
            aria-label="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            type="button"
            disabled={!hasPrevious}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            aria-label="Previous page"
          >
            {prevLabel ?? <ChevronLeft className="w-4 h-4" />}
          </Button>
          <div className="hidden sm:flex items-center gap-0.5">
            {numbers.map((n, idx) =>
              n === "..." ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="h-9 w-9 inline-flex items-center justify-center text-xs text-muted-foreground"
                >
                  …
                </span>
              ) : (
                <Button
                  key={n}
                  size="icon"
                  type="button"
                  variant={n === page ? "default" : "outline"}
                  className="h-9 w-9"
                  onClick={() => onPageChange(n)}
                >
                  {n}
                </Button>
              )
            )}
          </div>
          <Button
            size="icon"
            variant="outline"
            type="button"
            disabled={!hasNext}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            aria-label="Next page"
          >
            {nextLabel ?? <ChevronRight className="w-4 h-4" />}
          </Button>
          <Button
            size="icon"
            variant="outline"
            type="button"
            disabled={!hasNext}
            onClick={() => onPageChange(totalPages)}
            aria-label="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
