"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
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
  ShieldCheck,
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
import { PageHeader } from "@/components/common/PageHeader";
import { GlobalTable } from "@/components/tables/GlobalTable";
import {
  createColumns,
  getPaginationParamsFromSearchParams,
} from "@/lib/table-utils";
import {
  StatusBadge,
  type StatusBadgeTone,
} from "@/components/common/StatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { SearchInput } from "@/components/tables/SearchInput";
import {
  GlobalSelect,
  type SelectOption,
} from "@/components/form/GlobalSelect";
import { GlobalDatePicker } from "@/components/form/GlobalDatePicker";

const ACTION_TONES: Record<AuditLogAction, StatusBadgeTone> = {
  CREATE: "emerald",
  UPDATE: "sky",
  DELETE: "rose",
  LOGIN: "violet",
  LOGIN_FAILED: "teal",
  LOGOUT: "slate",
};

const ACTION_ICONS: Record<AuditLogAction, React.ReactNode> = {
  CREATE: <Zap className="w-3 h-3" />,
  UPDATE: <Zap className="w-3 h-3" />,
  DELETE: <Zap className="w-3 h-3" />,
  LOGIN: <ShieldCheck className="w-3 h-3" />,
  LOGIN_FAILED: <ShieldCheck className="w-3 h-3" />,
  LOGOUT: <ShieldCheck className="w-3 h-3" />,
};

const ENTITY_OPTIONS: SelectOption[] = [
  { value: "User", label: "User" },
  { value: "Role", label: "Role" },
  { value: "RefreshToken", label: "RefreshToken" },
  { value: "PasswordResetToken", label: "PasswordResetToken" },
  { value: "Employee", label: "Employee" },
  { value: "Department", label: "Department" },
  { value: "Designation", label: "Designation" },
  { value: "Customer", label: "Customer" },
  { value: "Lead", label: "Lead" },
  { value: "Product", label: "Product" },
  { value: "Category", label: "Category" },
  { value: "Warehouse", label: "Warehouse" },
  { value: "Stock", label: "Stock" },
  { value: "Supplier", label: "Supplier" },
  { value: "Order", label: "Order" },
  { value: "OrderItem", label: "OrderItem" },
  { value: "Invoice", label: "Invoice" },
  { value: "Payment", label: "Payment" },
  { value: "Attendance", label: "Attendance" },
  { value: "LeaveRequest", label: "LeaveRequest" },
];

const ACTION_OPTIONS: SelectOption[] = [
  { value: "CREATE", label: "CREATE" },
  { value: "UPDATE", label: "UPDATE" },
  { value: "DELETE", label: "DELETE" },
  { value: "LOGIN", label: "LOGIN" },
  { value: "LOGIN_FAILED", label: "LOGIN FAILED" },
  { value: "LOGOUT", label: "LOGOUT" },
];

function JsonBlock({ data }: { data: unknown }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const text = useMemo(
    () => (data == null ? "—" : JSON.stringify(data, null, 2)),
    [data],
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

  const empty =
    data == null ||
    (typeof data === "object" && Object.keys(data as object).length === 0);

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

function AuditLogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const baseParams = getPaginationParamsFromSearchParams(searchParams, {
    page: 1,
    pageSize: 25,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const [searchTerm, setSearchTerm] = useState(baseParams.search ?? "");
  const [entityType, setEntityType] = useState<string | undefined>(
    searchParams.get("entityType") ?? undefined,
  );
  const [action, setAction] = useState<string | undefined>(
    searchParams.get("action") ?? undefined,
  );
  const [userId, setUserId] = useState<string | undefined>(
    searchParams.get("userId") ?? undefined,
  );
  const [dateFrom, setDateFrom] = useState<string | undefined>(
    searchParams.get("dateFrom") ?? undefined,
  );
  const [dateTo, setDateTo] = useState<string | undefined>(
    searchParams.get("dateTo") ?? undefined,
  );

  const filters: ListAuditLogsArgs = useMemo(
    () => ({
      page: baseParams.page,
      pageSize: baseParams.pageSize,
      sortBy: baseParams.sortBy,
      sortOrder: baseParams.sortOrder,
      search: searchTerm || undefined,
      entityType: entityType || undefined,
      action: action ? (action as AuditLogAction) : undefined,
      userId: userId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [baseParams, searchTerm, entityType, action, userId, dateFrom, dateTo],
  );

  const {
    data: auditRes,
    isFetching,
    refetch,
  } = useListAuditLogsQuery(filters, { refetchOnMountOrArgChange: true });

  const { data: usersRes } = useListUsersQuery({ pageSize: 100 });
  const users = usersRes?.data?.items ?? [];

  const userOptions: SelectOption[] = useMemo(
    () =>
      users.map((u) => ({
        value: u.id,
        label: `${u.firstName} ${u.lastName} (${u.email})`,
      })),
    [users],
  );

  const userName = (row: AuditLogItem) => {
    if (row.user) {
      return `${row.user.firstName} ${row.user.lastName}`.trim();
    }
    return "—";
  };

  const userInitials = (row: AuditLogItem) =>
    row.user
      ? `${row.user.firstName?.[0] ?? ""}${row.user.lastName?.[0] ?? ""}`.toUpperCase() ||
        "?"
      : "?";

  function syncFiltersToUrl(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k);
      else next.set(k, v);
    }
    next.set("page", "1");
    const qs = next.toString();
    router.push(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  }

  function handleSearchChange(v: string) {
    setSearchTerm(v);
    syncFiltersToUrl({ search: v });
  }

  function handleEntityChange(v: string) {
    setEntityType(v);
    syncFiltersToUrl({ entityType: v });
  }

  function handleActionChange(v: string) {
    setAction(v);
    syncFiltersToUrl({ action: v });
  }

  function handleUserChange(v: string) {
    setUserId(v);
    syncFiltersToUrl({ userId: v });
  }

  function handleDateFromChange(v: string | null) {
    const val = v ?? undefined;
    setDateFrom(val);
    syncFiltersToUrl({ dateFrom: val });
  }

  function handleDateToChange(v: string | null) {
    const val = v ?? undefined;
    setDateTo(val);
    syncFiltersToUrl({ dateTo: val });
  }

  const columns = useMemo(() => {
    const col = createColumns<AuditLogItem>();
    return [
      col.accessor("createdAt", {
        id: "createdAt",
        header: "Timestamp",
        cell: ({ row: { original: r } }) => (
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="leading-tight">
              <p className="text-xs font-medium text-foreground">
                <DateDisplay date={r.createdAt} format="short" />
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                {format(new Date(r.createdAt), "HH:mm:ss")}
              </p>
            </div>
          </div>
        ),
      }),
      col.display({
        id: "actor",
        header: "Actor",
        cell: ({ row: { original: r } }) => (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 h-8 w-8 shrink-0 flex items-center justify-center font-semibold text-[11px] border border-slate-300 dark:border-slate-600">
              {userInitials(r)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">
                {r.userId ? userName(r) : "System"}
              </p>
              {r.user?.email && (
                <p className="text-[10px] text-slate-500 truncate">
                  {r.user.email}
                </p>
              )}
            </div>
          </div>
        ),
      }),
      col.accessor("action", {
        id: "action",
        header: "Action",
        cell: ({ row: { original: r } }) => (
          <StatusBadge
            tone={
              ACTION_TONES[r.action as keyof typeof ACTION_TONES] ?? "slate"
            }
            icon={ACTION_ICONS[r.action as keyof typeof ACTION_ICONS]}
            size="sm"
            label={r.action.replace("_", " ")}
            className="uppercase tracking-wider font-semibold"
          />
        ),
      }),
      col.display({
        id: "entity",
        header: "Entity",
        cell: ({ row: { original: r } }) => (
          <div className="flex items-start gap-2 min-w-0">
            <Tag className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium">{r.entityType ?? "—"}</p>
              {r.entityId && (
                <p
                  className="text-[10px] text-slate-500 font-mono truncate max-w-[200px]"
                  title={r.entityId}
                >
                  ID: {r.entityId.slice(0, 12)}…
                </p>
              )}
            </div>
          </div>
        ),
      }),
      col.display({
        id: "client",
        header: "Client",
        enableSorting: false,
        cell: ({ row: { original: r } }) => (
          <div className="flex flex-col gap-0.5 text-[10px] hidden lg:flex">
            {r.ipAddress && (
              <span className="inline-flex items-center gap-1 text-slate-500">
                <Globe className="w-3 h-3" />{" "}
                <span className="font-mono">{r.ipAddress}</span>
              </span>
            )}
            {r.userAgent && (
              <span
                className="inline-flex items-center gap-1 text-slate-500 truncate max-w-[220px]"
                title={r.userAgent}
              >
                <Monitor className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {r.userAgent.slice(0, 32)}
                  {r.userAgent.length > 32 ? "…" : ""}
                </span>
              </span>
            )}
            {!r.ipAddress && !r.userAgent && (
              <span className="text-slate-400 italic">—</span>
            )}
          </div>
        ),
      }),
    ];
  }, []);

  const renderSubRow = (row: AuditLogItem) => (
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
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Audit log"
        description="Append-only record of every action performed in the system."
        breadcrumbs={[
          { label: "Administration", href: "/administration/users" },
          { label: "Audit log" },
        ]}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={cn("w-4 h-4", isFetching && "animate-spin")}
            />
            Refresh
          </Button>
        }
      />

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2">
            <SearchInput
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search entity ID, user name, or metadata…"
              className="w-full sm:max-w-none"
            />
          </div>
          <GlobalSelect
            placeholder="All entities"
            options={ENTITY_OPTIONS}
            value={entityType}
            onChange={handleEntityChange}
          />
          <GlobalSelect
            placeholder="All actions"
            options={ACTION_OPTIONS}
            value={action}
            onChange={handleActionChange}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <GlobalSelect
            placeholder="All users"
            options={userOptions}
            value={userId}
            onChange={handleUserChange}
          />
          <GlobalDatePicker
            placeholder="From date"
            value={dateFrom}
            onChange={handleDateFromChange}
          />
          <GlobalDatePicker
            placeholder="To date"
            value={dateTo}
            onChange={handleDateToChange}
          />
        </div>
      </div>

      <GlobalTable<AuditLogItem>
        columns={columns}
        queryResult={auditRes as any}
        serverSide
        defaultSortBy="createdAt"
        defaultSortOrder="desc"
        pageSizeDefault={25}
        renderSubRow={renderSubRow}
        emptyIcon={<FileText className="w-10 h-10 opacity-40" />}
        emptyTitle="No audit log entries"
        emptyDescription="No audit log entries match the current filters."
        syncUrl
        getRowId={(r) => r.id}
      />
    </div>
  );
}

export default function AuditLogPage() {
  return (
    <Suspense fallback={<div>Loading audit log...</div>}>
      <AuditLogContent />
    </Suspense>
  );
}
