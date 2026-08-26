"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Filter, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GlobalSelect } from "@/components/form/GlobalSelect";
import { GlobalInput } from "@/components/form/GlobalInput";

export type FilterOperator = "eq" | "neq" | "contains" | "startsWith" | "gt" | "lt" | "gte" | "lte" | "between";

export interface FilterFieldDef {
  key: string;
  label: string;
  type: "string" | "number" | "select";
  operators?: FilterOperator[];
  options?: { value: string; label: string }[];
}

export interface FilterValue {
  id: string;
  fieldKey: string;
  operator: FilterOperator;
  value: string;
  value2?: string;
}

export interface FilterPanelProps {
  fields: FilterFieldDef[];
  filters: FilterValue[];
  onApply: (filters: FilterValue[]) => void;
  onChange?: (filters: FilterValue[]) => void;
  onReset?: () => void;
  label?: string;
  className?: string;
  children?: ReactNode;
}

const STRING_OPERATORS: FilterOperator[] = ["eq", "neq", "contains", "startsWith"];
const NUMERIC_OPERATORS: FilterOperator[] = ["eq", "neq", "gt", "lt", "gte", "lte", "between"];
const SELECT_OPERATORS: FilterOperator[] = ["eq", "neq"];

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: "Equals",
  neq: "Not equal to",
  contains: "Contains",
  startsWith: "Starts with",
  gt: "Greater than",
  lt: "Less than",
  gte: "≥",
  lte: "≤",
  between: "Between",
};

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export function FilterPanel({
  fields,
  filters,
  onApply,
  onChange,
  onReset,
  label = "Filters",
  className,
  children,
}: FilterPanelProps) {
  const [draft, setDraft] = useState<FilterValue[]>(filters);

  useMemo(() => {
    setDraft(filters);
  }, [filters]);

  const fieldMap = useMemo(() => {
    const m = new Map<string, FilterFieldDef>();
    for (const f of fields) m.set(f.key, f);
    return m;
  }, [fields]);

  function updateAt(index: number, patch: Partial<FilterValue>) {
    const next = draft.map((f, i) => (i === index ? { ...f, ...patch } : f));
    setDraft(next);
    onChange?.(next);
  }

  function addFilter() {
    const firstField = fields[0];
    if (!firstField) return;
    const ops = defaultOpsFor(firstField);
    const next = [
      ...draft,
      {
        id: makeId(),
        fieldKey: firstField.key,
        operator: ops[0],
        value: "",
      },
    ];
    setDraft(next);
    onChange?.(next);
  }

  function removeFilter(id: string) {
    const next = draft.filter((f) => f.id !== id);
    setDraft(next);
    onChange?.(next);
  }

  function reset() {
    setDraft([]);
    onChange?.([]);
    onReset?.();
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-1.5", className)}>
          <Filter className="w-4 h-4" />
          {label}
          {draft.length > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
              {draft.length}
            </span>
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-[min(540px,calc(100vw-2rem))] rounded-xl border border-border bg-card p-4 shadow-xl animate-in fade-in-80 zoom-in-95"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Filters</h3>
            <button
              type="button"
              onClick={reset}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Reset all
            </button>
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-auto pr-1">
            {draft.length === 0 && (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No filters applied. Click Add filter to create one.
              </p>
            )}
            {draft.map((f, idx) => {
              const field = fieldMap.get(f.fieldKey);
              if (!field) return null;
              const operators = defaultOpsFor(field);
              return (
                <div
                  key={f.id}
                  className="grid grid-cols-12 gap-2 items-start rounded-lg border border-border bg-background p-2"
                >
                  <div className="col-span-12 sm:col-span-4">
                    <GlobalSelect
                      value={f.fieldKey}
                      options={fields.map((fd) => ({ value: fd.key, label: fd.label }))}
                      onChange={(k) => {
                        const fd = fieldMap.get(k)!;
                        updateAt(idx, { fieldKey: k, operator: defaultOpsFor(fd)[0], value: "" });
                      }}
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-3">
                    <GlobalSelect
                      value={f.operator}
                      options={operators.map((op) => ({ value: op, label: OPERATOR_LABELS[op] }))}
                      onChange={(op) => updateAt(idx, { operator: op as FilterOperator })}
                    />
                  </div>
                  <div className="col-span-11 sm:col-span-4">
                    {field.type === "select" ? (
                      <GlobalSelect
                        value={f.value}
                        options={field.options ?? []}
                        placeholder="Value"
                        onChange={(v) => updateAt(idx, { value: v })}
                      />
                    ) : (
                      <GlobalInput
                        inputType={field.type === "number" ? "number" : "text"}
                        placeholder="Value"
                        value={f.value}
                        onChange={(e) => updateAt(idx, { value: e.target.value })}
                      />
                    )}
                  </div>
                  <div className="col-span-1 flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => removeFilter(f.id)}
                      aria-label="Remove filter"
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {f.operator === "between" && (
                    <div className="col-span-12 sm:col-span-11 sm:col-start-2">
                      <GlobalInput
                        inputType={field.type === "number" ? "number" : "text"}
                        placeholder="And"
                        value={f.value2 ?? ""}
                        onChange={(e) => updateAt(idx, { value2: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={addFilter}
              className="w-full"
              type="button"
            >
              <Plus className="w-4 h-4 mr-1" /> Add filter
            </Button>
            {children}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" type="button" onClick={reset}>
                <Trash2 className="w-4 h-4 mr-1" />
                Clear
              </Button>
              <Button
                size="sm"
                type="button"
                onClick={() => onApply(draft)}
              >
                Apply filters
              </Button>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function defaultOpsFor(field: FilterFieldDef): FilterOperator[] {
  return (
    field.operators ??
    (field.type === "string"
      ? STRING_OPERATORS
      : field.type === "number"
      ? NUMERIC_OPERATORS
      : SELECT_OPERATORS)
  );
}
