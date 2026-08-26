"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/tables/SearchInput";
import {
  FilterPanel,
  type FilterFieldDef,
  type FilterValue,
} from "@/components/tables/FilterPanel";
import { Button } from "@/components/ui/button";
import { Download, SquarePlus } from "lucide-react";

export interface TableToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filterFields?: FilterFieldDef[];
  filters?: FilterValue[];
  onFiltersChange?: (filters: FilterValue[]) => void;
  onFiltersApply?: (filters: FilterValue[]) => void;
  onFiltersReset?: () => void;
  onCreateNew?: () => void;
  createNewLabel?: string;
  showExport?: boolean;
  onExport?: () => void;
  exportLabel?: string;
  disableCreateNew?: boolean;
  startContent?: ReactNode;
  endContent?: ReactNode;
  className?: string;
}

export function TableToolbar({
  searchTerm,
  onSearchChange,
  searchPlaceholder = "Search...",
  filterFields,
  filters = [],
  onFiltersChange,
  onFiltersApply,
  onFiltersReset,
  onCreateNew,
  createNewLabel = "Create new",
  showExport,
  onExport,
  exportLabel = "Export",
  disableCreateNew,
  startContent,
  endContent,
  className,
}: TableToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <SearchInput
          value={searchTerm}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          className="w-full sm:max-w-xs"
        />
        {filterFields && (
          <FilterPanel
            fields={filterFields}
            filters={filters}
            onChange={onFiltersChange}
            onApply={(f) => onFiltersApply?.(f)}
            onReset={onFiltersReset}
          />
        )}
        {startContent}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {showExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="w-4 h-4 mr-1" />
            {exportLabel}
          </Button>
        )}
        {endContent}
        {onCreateNew && (
          <Button
            size="sm"
            onClick={onCreateNew}
            disabled={disableCreateNew}
          >
            <SquarePlus className="w-4 h-4 mr-1" />
            {createNewLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
