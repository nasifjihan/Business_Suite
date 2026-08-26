"use client";

import { useMemo, useState } from "react";
import {
  FileText,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Filter,
  RefreshCw,
  UserCircle2,
  Calendar,
  Tag,
  Zap,
  Info,
  Copy,
  CheckCircle2,
  Globe,
  Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useListAuditLogsQuery,
  useListUsersQuery,
} from "@/lib/api/adminEndpoints";
import type {
  AuditLogAction,
  AuditLogItem,
  ListAuditLogsArgs,
} from "@/lib/api/adminEndpoints";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const ACTION_TONES: Record<AuditLogAction, string> = {
  CREATE:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-900/60",
  UPDATE:
    "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200/60 dark:border-sky-900/60",
  DELETE:
    "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200/60 dark:border-rose-900/60",
  LOGIN:
    "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-900/60",
  LOGIN_FAILED:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200/60 dark:border-amber-900/60",
  LOGOUT:
    "bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/60",
};

const ENTITY_OPTIONS = [
  "User",
  "Role",
  "RefreshToken",
  "PasswordResetToken",
  "Employee",
  "Department",
  "Designation",
  "Customer",
  "Lead",
  "Product",
  "Category",
  "Warehouse",
  "Stock",
  "Supplier",
  "Order",
  "OrderItem",
  "Invoice",
  "Payment",
  "Attendance",
  "LeaveRequest",
];

const ACTION_OPTIONS: AuditLogAction[] = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
];

// Pretty JSON helper
function JsonBlock({ data }: { data: unknown }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const text = useMemo(
    () => (data == null ? "—" : JSON.stringify(data, null, 2)),
    [data]
  );

  const copy = async (k: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(k);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const empty = data == null || (typeof data === "object" && Object.keys(data as object).length === 0);

  if (empty) {
    return (
      <div className="text-xs text-slate-400 italic py-3 text-center">
        <Info className="w-3.5 h-3.5 inline mr-1.5 opacity-70" />
        No data captured for this side of the change.
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => copy(text.slice(0, 40))}
        className="absolute right-2 top-2 inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border border-border bg-card/90 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
      >
        {copiedKey === text.slice(0, 40) ? (
          <>
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Copied
          </>
        ) : (
          <>
            <Copy className="w-3 h-3" /> Copy
          </>
        )}
      </button>
      <pre className="text-[11px] leading-relaxed font-mono rounded-lg border border-border bg-slate-50 dark:bg-slate-950/60 p-3 pt-8 overflow-x-auto whitespace-pre-wrap break-words">
        {text}
      </pre>
    </div>
  );
}

export default function AuditLogPage() {
  const [filters, setFilters] = useState<ListAuditLogsArgs>({
    page: 1,
    pageSize: 25,
    search: "",
    entityType: undefined,
    action: undefined,
    userId: undefined,
    dateFrom: undefined,
    dateTo: undefined,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  const searchInput = filters.search ?? "";
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const {
    data: auditRes,
    isFetching,
    refetch,
  } = useListAuditLogsQuery(filters, { refetchOnMountOrArgChange: true });

  const { data: usersRes } = useListUsersQuery({ pageSize: 100 });
  const users = usersRes?.data?.items ?? [];

  const items = auditRes?.data?.items ?? [];
  const meta = auditRes?.data?.meta;

  const toggleExpand = (id: string) =>
    setExpandedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const userName = (row: AuditLogItem) => {
    if (row.user) {
      return `${row.user.firstName} ${row.user.lastName}`.trim();
    }
    return "—";
  };

  const userInitials = (row: AuditLogItem) =>
    row.user
      ? `${row.user.firstName?.[0] ?? ""}${row.user.lastName?.[0] ?? ""}`
          .toUpperCase() || "?"
      : "?";

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Append-only record of every action performed in the system.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={cn(
                "w-4 h-4",
                isFetching && "animate-spin"
              )}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) =>
                setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))
              }
              placeholder="Search entity ID, user name, or metadata…"
              className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            />
          </div>
          <div className="inline-flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filters.entityType ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  entityType: e.target.value || undefined,
                  page: 1,
                }))
              }
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <option value="">All entities</option>
              {ENTITY_OPTIONS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <select
            value={filters.action ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                action: e.target.value
                  ? (e.target.value as AuditLogAction)
                  : undefined,
                page: 1,
              }))
            }
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <option value="">All actions</option>
            {ACTION_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            value={filters.userId ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                userId: e.target.value || undefined,
                page: 1,
              }))
            }
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName} ({u.email})
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="date"
              value={filters.dateFrom ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  dateFrom: e.target.value || undefined,
                  page: 1,
                }))
              }
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="date"
              value={filters.dateTo ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  dateTo: e.target.value || undefined,
                  page: 1,
                }))
              }
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-border text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="w-10 px-3 py-3" />
                <th className="text-left font-medium px-3 py-3">Timestamp</th>
                <th className="text-left font-medium px-3 py-3">Actor</th>
                <th className="text-left font-medium px-3 py-3">Action</th>
                <th className="text-left font-medium px-3 py-3">Entity</th>
                <th className="text-left font-medium px-3 py-3 hidden lg:table-cell">
                  Client
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 && !isFetching && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-16 text-center text-slate-500"
                  >
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">
                      No audit log entries match the current filters.
                    </p>
                  </td>
                </tr>
              )}
              {items.map((row: AuditLogItem) => {
                const expanded = expandedIds.has(row.id);
                return (
                  <>
                    <tr
                      key={row.id}
                      className={cn(
                        "hover:bg-slate-50/60 dark:hover:bg-slate-800/40",
                        expanded && "bg-slate-50/60 dark:bg-slate-800/40"
                      )}
                    >
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => toggleExpand(row.id)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                          {expanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <div className="leading-tight">
                            <p className="text-xs font-medium text-foreground">
                              {format(new Date(row.createdAt), "MMM d, yyyy")}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              {format(new Date(row.createdAt), "HH:mm:ss")}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 h-8 w-8 shrink-0 flex items-center justify-center font-semibold text-[11px] border border-slate-300 dark:border-slate-600">
                            {userInitials(row)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">
                              {row.userId ? userName(row) : "System"}
                            </p>
                            {row.user?.email && (
                              <p className="text-[10px] text-slate-500 truncate">
                                {row.user.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider",
                            ACTION_TONES[row.action as keyof typeof ACTION_TONES] ?? ACTION_TONES.UPDATE
                          )}
                        >
                          <Zap className="w-3 h-3" />
                          {row.action.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-start gap-2 min-w-0">
                          <Tag className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium">
                              {row.entityType ?? "—"}
                            </p>
                            {row.entityId && (
                              <p
                                className="text-[10px] text-slate-500 font-mono truncate max-w-[200px]"
                                title={row.entityId}
                              >
                                ID: {row.entityId.slice(0, 12)}…
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell">
                        <div className="flex flex-col gap-0.5 text-[10px]">
                          {row.ipAddress && (
                            <span className="inline-flex items-center gap-1 text-slate-500">
                              <Globe className="w-3 h-3" />{" "}
                              <span className="font-mono">{row.ipAddress}</span>
                            </span>
                          )}
                          {row.userAgent && (
                            <span
                              className="inline-flex items-center gap-1 text-slate-500 truncate max-w-[220px]"
                              title={row.userAgent}
                            >
                              <Monitor className="w-3 h-3 shrink-0" />
                              <span className="truncate">
                                {row.userAgent.slice(0, 32)}
                                {row.userAgent.length > 32 ? "…" : ""}
                              </span>
                            </span>
                          )}
                          {!row.ipAddress && !row.userAgent && (
                            <span className="text-slate-400 italic">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr key={`${row.id}-exp`} className="bg-slate-50/80 dark:bg-slate-800/60">
                        <td />
                        <td colSpan={5} className="px-3 pb-5 pt-2">
                          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                            {!!(row.beforeData || row.afterData) && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2 inline-flex items-center gap-1.5">
                                    <FileText className="w-3 h-3" /> Before
                                  </p>
                                  <JsonBlock data={row.beforeData} />
                                </div>
                                <div>
                                  <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2 inline-flex items-center gap-1.5">
                                    <Zap className="w-3 h-3" /> After
                                  </p>
                                  <JsonBlock data={row.afterData} />
                                </div>
                              </div>
                            )}
                            {!!row.metadata && (
                              <div>
                                <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2 inline-flex items-center gap-1.5">
                                  <Info className="w-3 h-3" /> Metadata
                                </p>
                                <JsonBlock data={row.metadata} />
                              </div>
                            )}
                            {row.entityId && (
                              <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border text-[11px] text-slate-500">
                                <div>
                                  <span className="font-medium uppercase tracking-wider text-slate-400 mr-2">
                                    Audit ID
                                  </span>
                                  <span className="font-mono">{row.id}</span>
                                </div>
                                <div>
                                  <span className="font-medium uppercase tracking-wider text-slate-400 mr-2">
                                    Entity ID
                                  </span>
                                  <span className="font-mono">{row.entityId}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {meta && (
          <div className="border-t border-border px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Showing {meta.totalItems === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1}
              — {Math.min(meta.page * meta.pageSize, meta.totalItems)} of{" "}
              {meta.totalItems}
            </p>
            <div className="inline-flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={!meta.hasPrevious}
                onClick={() =>
                  setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))
                }
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </Button>
              <span className="px-3 text-xs text-muted-foreground">
                Page {meta.page} / {meta.totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!meta.hasNext}
                onClick={() =>
                  setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))
                }
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
