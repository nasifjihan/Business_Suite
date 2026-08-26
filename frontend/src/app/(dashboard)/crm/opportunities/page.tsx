"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Target,
  Pencil,
  Trash2,
  Eye,
  DollarSign,
  TrendingUp,
  CalendarDays,
  Clock,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { TableToolbar } from "@/components/tables/TableToolbar";
import { GlobalTable } from "@/components/tables/GlobalTable";
import { GlobalModal } from "@/components/feedback/GlobalModal";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { GlobalInput } from "@/components/form/GlobalInput";
import { GlobalSelect } from "@/components/form/GlobalSelect";
import { GlobalDatePicker } from "@/components/form/GlobalDatePicker";
import { StatusBadge, type StatusBadgeTone } from "@/components/common/StatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { MoneyDisplay } from "@/components/common/MoneyDisplay";
import { PermissionGate, useHasPermission } from "@/components/auth/PermissionGate";
import { createColumns, type TableFeatures } from "@/lib/table-utils";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import {
  useListOpportunitiesQuery,
  useCreateOpportunityMutation,
  useUpdateOpportunityMutation,
  useDeleteOpportunityMutation,
  useListCustomersQuery,
  useListLeadsQuery,
} from "@/lib/api/crmEndpoints";
import type {
  OpportunityItem,
  OpportunityStage,
  ListOppsArgs,
  CreateOpportunityRequest,
} from "@/lib/api/crmEndpoints";

const extract = <T,>(resp?: { success: true; data: { items: T[]; meta: unknown } }) =>
  resp?.data ?? { items: [] as T[], meta: undefined };

const OPPORTUNITY_STAGE_TONE: Record<
  OpportunityStage,
  StatusBadgeTone
> = {
  PROSPECTING: "slate",
  QUALIFICATION: "sky",
  NEEDS_ANALYSIS: "violet",
  PROPOSAL: "teal",
  NEGOTIATION: "violet",
  CLOSED_WON: "emerald",
  CLOSED_LOST: "rose",
};

const stageFilterOptions = [
  { value: "", label: "All stages" },
  { value: "PROSPECTING", label: "Prospecting" },
  { value: "QUALIFICATION", label: "Qualification" },
  { value: "NEEDS_ANALYSIS", label: "Needs Analysis" },
  { value: "PROPOSAL", label: "Proposal" },
  { value: "NEGOTIATION", label: "Negotiation" },
  { value: "CLOSED_WON", label: "Closed Won" },
  { value: "CLOSED_LOST", label: "Closed Lost" },
];

const stageFormOptions = stageFilterOptions.filter((o) => o.value !== "");

const stageLabel = (s: OpportunityStage) =>
  s === "CLOSED_WON"
    ? "Closed Won"
    : s === "CLOSED_LOST"
      ? "Closed Lost"
      : s === "NEEDS_ANALYSIS"
        ? "Needs Analysis"
        : s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ");

const opportunityFormSchema = z.object({
  name: z.string().trim().min(1, "Required").max(255),
  customerId: z.string().trim().optional().or(z.literal("")),
  leadId: z.string().trim().optional().or(z.literal("")),
  stage: z.enum([
    "PROSPECTING",
    "QUALIFICATION",
    "NEEDS_ANALYSIS",
    "PROPOSAL",
    "NEGOTIATION",
    "CLOSED_WON",
    "CLOSED_LOST",
  ] as const),
  amount: z.coerce.number().optional(),
  probabilityPercent: z.coerce.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.string().optional(),
  assignedToId: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
type OpportunityFormValues = z.infer<typeof opportunityFormSchema>;

type ModalState =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; opportunity: OpportunityItem }
  | { kind: "delete"; opportunity: OpportunityItem };

export default function OpportunitiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canCreate = useHasPermission({ one: "crm.opportunities.create" });
  const canUpdate = useHasPermission({ one: "crm.opportunities.update" });
  const canDelete = useHasPermission({ one: "crm.opportunities.delete" });

  const filters: ListOppsArgs = useMemo(() => {
    const page = parseInt(searchParams?.get("page") ?? "1", 10) || 1;
    const pageSize = parseInt(searchParams?.get("pageSize") ?? "25", 10) || 25;
    return {
      page,
      pageSize,
      search: searchParams?.get("search") ?? "",
      stage: (searchParams?.get("stage") as OpportunityStage | undefined) || undefined,
      sortBy: searchParams?.get("sortBy") ?? "createdAt",
      sortOrder: (searchParams?.get("sortOrder") as "asc" | "desc") ?? "desc",
    };
  }, [searchParams]);

  const { data: oppsRes, isFetching, refetch } = useListOpportunitiesQuery(filters, {
    refetchOnMountOrArgChange: true,
  });

  const { data: customersRes } = useListCustomersQuery({ pageSize: 100 });
  const { data: leadsRes } = useListLeadsQuery({ pageSize: 100 });

  const opportunities = extract(oppsRes as any).items as OpportunityItem[];
  const meta = extract(oppsRes as any).meta;
  const customers = extract(customersRes as any).items;
  const leads = extract(leadsRes as any).items;

  const customerOptions = useMemo(
    () => customers.map((c: any) => ({ value: c.id, label: c.name })),
    [customers]
  );
  const leadOptions = useMemo(
    () => leads.map((l: any) => ({ value: l.id, label: l.name })),
    [leads]
  );

  const summaryStats = useMemo(() => {
    const openOpps = opportunities.filter(
      (o) => o.stage !== "CLOSED_WON" && o.stage !== "CLOSED_LOST"
    );
    const totalPipeline = openOpps.reduce((sum, o) => {
      const amt = typeof o.amount === "string" ? parseFloat(o.amount) : o.amount;
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0);
    const now = new Date();
    const wonThisMonth = opportunities
      .filter((o) => o.stage === "CLOSED_WON")
      .filter((o) => {
        const d = o.updatedAt ? new Date(o.updatedAt) : null;
        if (!d) return false;
        return (
          d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        );
      })
      .reduce((sum, o) => {
        const amt = typeof o.amount === "string" ? parseFloat(o.amount) : o.amount;
        return sum + (isNaN(amt) ? 0 : amt);
      }, 0);
    return {
      openCount: openOpps.length,
      totalPipeline,
      wonThisMonth,
      avgCycle: "—",
    };
  }, [opportunities]);

  const buildParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      Object.entries(patch).forEach(([k, v]) => {
        if (v === undefined || v === "" || v === null) {
          params.delete(k);
        } else {
          params.set(k, v);
        }
      });
      params.delete("page");
      return params.toString();
    },
    [searchParams]
  );

  const pushParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const qs = buildParams(patch);
      router.push(`?${qs}`, { scroll: false });
    },
    [buildParams, router]
  );

  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [createTrigger, createState] = useCreateOpportunityMutation();
  const [updateTrigger, updateState] = useUpdateOpportunityMutation();
  const [deleteTrigger, deleteState] = useDeleteOpportunityMutation();

  const form = useForm<OpportunityFormValues>({
    resolver: zodResolver(opportunityFormSchema),
    defaultValues: {
      name: "",
      customerId: "",
      leadId: "",
      stage: "PROSPECTING",
      amount: 0,
      probabilityPercent: 0,
      expectedCloseDate: "",
      assignedToId: "",
      notes: "",
    },
    mode: "onTouched",
  });

  useEffect(() => {
    if (modal.kind === "edit") {
      form.reset({
        name: modal.opportunity.name,
        customerId: modal.opportunity.customerId ?? "",
        leadId: modal.opportunity.leadId ?? "",
        stage: modal.opportunity.stage,
        amount:
          typeof modal.opportunity.amount === "string"
            ? parseFloat(modal.opportunity.amount)
            : modal.opportunity.amount,
        probabilityPercent: modal.opportunity.probabilityPercent ?? 0,
        expectedCloseDate: modal.opportunity.expectedCloseDate ?? "",
        assignedToId: modal.opportunity.assignedToId ?? "",
        notes: "",
      });
    } else if (modal.kind === "create") {
      form.reset({
        name: "",
        customerId: "",
        leadId: "",
        stage: "PROSPECTING",
        amount: 0,
        probabilityPercent: 0,
        expectedCloseDate: "",
        assignedToId: "",
        notes: "",
      });
    }
  }, [modal, form]);

  const closeModal = () => {
    setModal({ kind: "none" });
    form.reset();
  };

  const onSubmitCreate = async (v: OpportunityFormValues) => {
    const body: CreateOpportunityRequest = {
      ...v,
      customerId: v.customerId || undefined,
      leadId: v.leadId || undefined,
      assignedToId: v.assignedToId || undefined,
      expectedCloseDate: v.expectedCloseDate || undefined,
      notes: v.notes || undefined,
    };
    const out = await createTrigger(body);
    if ("data" in out && out.data?.success) {
      closeModal();
    }
  };

  const onSubmitEdit = async (v: OpportunityFormValues) => {
    if (modal.kind !== "edit") return;
    const out = await updateTrigger({
      id: modal.opportunity.id,
      body: {
        ...v,
        customerId: v.customerId || undefined,
        leadId: v.leadId || undefined,
        assignedToId: v.assignedToId || undefined,
        expectedCloseDate: v.expectedCloseDate || undefined,
        notes: v.notes || undefined,
      },
    });
    if ("data" in out && out.data?.success) {
      closeModal();
    }
  };

  const handleDelete = async () => {
    if (modal.kind !== "delete") return;
    await deleteTrigger(modal.opportunity.id);
    setModal({ kind: "none" });
  };

  const onOpenCreate = () => setModal({ kind: "create" });

  const assignedInitials = (o: OpportunityItem) =>
    `${o.assignedTo?.firstName?.[0] ?? ""}${o.assignedTo?.lastName?.[0] ?? ""}`.toUpperCase() || "U";

  const columns: ColumnDef<TableFeatures, OpportunityItem, any>[] = useMemo(() => {
    const col = createColumns<OpportunityItem>();
    return [
      col.display({
        id: "opportunityCode",
        header: "Code",
        enableSorting: true,
        cell: ({ row: { original: o } }) => (
          <span className="font-mono text-xs text-slate-600 dark:text-slate-400 truncate max-w-[12ch]">
            {o.opportunityCode}
          </span>
        ),
      }),
      col.display({
        id: "name",
        header: "Opportunity / Customer",
        cell: ({ row: { original: o } }) => (
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{o.name}</p>
            {o.customer?.name && (
              <p className="text-xs text-muted-foreground truncate">
                {o.customer.name}
              </p>
            )}
          </div>
        ),
      }),
      col.display({
        id: "stage",
        header: "Stage",
        cell: ({ row: { original: o } }) => (
          <StatusBadge
            tone={OPPORTUNITY_STAGE_TONE[o.stage]}
            size="md"
            dot={o.stage === "CLOSED_WON"}
            label={stageLabel(o.stage)}
          />
        ),
      }),
      col.display({
        id: "amount",
        header: "Amount",
        cell: ({ row: { original: o } }) => (
          <MoneyDisplay value={o.amount} currency={o.currency ?? "USD"} />
        ),
      }),
      col.display({
        id: "probability",
        header: "Probability",
        cell: ({ row: { original: o } }) => {
          const pct = o.probabilityPercent ?? 0;
          return (
            <div className="space-y-1 w-full max-w-[120px]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{pct}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    pct >= 80
                      ? "bg-emerald-500"
                      : pct >= 50
                        ? "bg-sky-500"
                        : pct >= 20
                          ? "bg-violet-500"
                          : "bg-slate-400"
                  )}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </div>
          );
        },
      }),
      col.accessor("expectedCloseDate" as any, {
        id: "expectedCloseDate",
        header: "Expected close",
        enableSorting: true,
        cell: ({ row: { original: o } }) => (
          <DateDisplay date={o.expectedCloseDate} format="short" />
        ),
      }),
      col.display({
        id: "assignedTo",
        header: "Owner",
        cell: ({ row: { original: o } }) => {
          if (!o.assignedTo) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center text-[10px] font-semibold border border-slate-200 dark:border-slate-700">
                {assignedInitials(o)}
              </div>
              <span className="text-xs text-foreground truncate max-w-[14ch]">
                {o.assignedTo.firstName} {o.assignedTo.lastName?.[0] ?? ""}.
              </span>
            </div>
          );
        },
      }),
      col.display({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row: { original: o } }) => (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-slate-600 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 h-8 px-2"
            >
              <Link href={`/crm/opportunities/${o.id}`}>
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline ml-1">View</span>
              </Link>
            </Button>
            <PermissionGate one="crm.opportunities.update">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal({ kind: "edit", opportunity: o })}
                disabled={!canUpdate}
                className="h-8 px-2"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </PermissionGate>
            <PermissionGate one="crm.opportunities.delete">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal({ kind: "delete", opportunity: o })}
                disabled={!canDelete}
                className="h-8 px-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </PermissionGate>
          </div>
        ),
      }),
    ];
  }, [canUpdate, canDelete]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "CRM" }, { label: "Deals" }]}
        title="Deals"
        description="Track sales opportunities through the pipeline from prospecting to close."
        action={
          <div className="flex items-center gap-2">
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
            <PermissionGate one="crm.opportunities.create">
              <Button size="sm" onClick={onOpenCreate} disabled={!canCreate}>
                <Plus className="w-4 h-4" /> Create Opportunity
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Open Opportunities
            </span>
            <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Target className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {summaryStats.openCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Excluding closed won / lost
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Total Pipeline
            </span>
            <div className="h-8 w-8 rounded-lg bg-sky-50 dark:bg-sky-950/40 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">
            <MoneyDisplay
              value={summaryStats.totalPipeline}
              currency="USD"
              align="left"
              className="!w-auto !text-2xl"
            />
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Sum of open opportunities
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Won This Month
            </span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">
            <MoneyDisplay
              value={summaryStats.wonThisMonth}
              currency="USD"
              align="left"
              className="!w-auto !text-2xl"
            />
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Closed won deals this month
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Avg Sales Cycle
            </span>
            <div className="h-8 w-8 rounded-lg bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center">
              <Clock className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {summaryStats.avgCycle}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Placeholder metric
          </p>
        </div>
      </div>

      <TableToolbar
        searchTerm={filters.search ?? ""}
        onSearchChange={(v) => pushParams({ search: v })}
        searchPlaceholder="Search by opportunity name, code, or customer…"
        onCreateNew={canCreate ? onOpenCreate : undefined}
        disableCreateNew={!canCreate}
        startContent={
          <>
            <GlobalSelect
              value={filters.stage ?? ""}
              onChange={(v) => pushParams({ stage: v })}
              options={stageFilterOptions}
              placeholder="Stage"
              className="w-44"
            />
          </>
        }
      />

      <GlobalTable<OpportunityItem>
        columns={columns}
        data={opportunities}
        meta={meta as any}
        serverSide
        pageSizeDefault={25}
        defaultSortBy="createdAt"
        defaultSortOrder="desc"
        queryResult={{
          data: oppsRes?.data as any,
          isFetching,
        }}
        getRowId={(o) => o.id}
        onRowClick={(o) => router.push(`/crm/opportunities/${o.id}`)}
        emptyIcon={<Target className="w-10 h-10" />}
        emptyTitle="No opportunities found"
        emptyDescription="No opportunities match the current filters."
        emptyAction={
          <PermissionGate one="crm.opportunities.create">
            <Button size="sm" onClick={onOpenCreate}>
              <Plus className="w-4 h-4" /> Create Opportunity
            </Button>
          </PermissionGate>
        }
        errorOnRetry={() => refetch()}
      />

      <GlobalModal
        open={modal.kind === "create"}
        onOpenChange={(o) => !o && closeModal()}
        title="Create new opportunity"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="createOpportunityForm"
              disabled={createState.isLoading || !canCreate}
            >
              {createState.isLoading ? "Creating…" : "Create opportunity"}
            </Button>
          </div>
        }
      >
        <form
          id="createOpportunityForm"
          onSubmit={form.handleSubmit(onSubmitCreate)}
          className="space-y-4"
          noValidate
        >
          <GlobalInput
            label="Opportunity name"
            required
            error={form.formState.errors.name?.message}
            {...form.register("name")}
          />
          <div className="grid grid-cols-2 gap-4">
            <GlobalSelect
              label="Customer"
              value={form.watch("customerId")}
              onChange={(v) =>
                form.setValue("customerId", v, { shouldValidate: true })
              }
              options={customerOptions}
              placeholder="Select customer…"
              error={form.formState.errors.customerId?.message as any}
            />
            <GlobalSelect
              label="Lead"
              value={form.watch("leadId")}
              onChange={(v) =>
                form.setValue("leadId", v, { shouldValidate: true })
              }
              options={leadOptions}
              placeholder="Select lead…"
              error={form.formState.errors.leadId?.message as any}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalSelect
              label="Stage"
              required
              value={form.watch("stage")}
              onChange={(v) =>
                form.setValue("stage", v as any, { shouldValidate: true })
              }
              options={stageFormOptions}
              placeholder="Select stage…"
              error={form.formState.errors.stage?.message}
            />
            <GlobalInput
              label="Amount ($)"
              inputType="number"
              error={form.formState.errors.amount?.message}
              {...form.register("amount")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Probability (%)"
              inputType="number"
              hint="0 - 100"
              error={form.formState.errors.probabilityPercent?.message}
              {...form.register("probabilityPercent")}
            />
            <GlobalDatePicker
              label="Expected close date"
              value={form.watch("expectedCloseDate") ?? null}
              onChange={(v) =>
                form.setValue("expectedCloseDate", v ?? undefined, {
                  shouldValidate: true,
                })
              }
              placeholder="Pick a date"
              error={form.formState.errors.expectedCloseDate?.message as any}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">
              Notes
            </label>
            <textarea
              className="mt-1.5 w-full min-h-[80px] rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Any additional notes about this opportunity…"
              maxLength={2000}
              {...form.register("notes")}
            />
            {form.formState.errors.notes?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {form.formState.errors.notes.message}
              </p>
            )}
          </div>
          {createState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (createState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to create opportunity."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <GlobalModal
        open={modal.kind === "edit"}
        onOpenChange={(o) => !o && closeModal()}
        title="Edit opportunity"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="editOpportunityForm"
              disabled={updateState.isLoading || !canUpdate}
            >
              {updateState.isLoading ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      >
        <form
          id="editOpportunityForm"
          onSubmit={form.handleSubmit(onSubmitEdit)}
          className="space-y-4"
          noValidate
        >
          <GlobalInput
            label="Opportunity name"
            required
            error={form.formState.errors.name?.message}
            {...form.register("name")}
          />
          <div className="grid grid-cols-2 gap-4">
            <GlobalSelect
              label="Customer"
              value={form.watch("customerId")}
              onChange={(v) =>
                form.setValue("customerId", v, { shouldValidate: true })
              }
              options={customerOptions}
              placeholder="Select customer…"
              error={form.formState.errors.customerId?.message as any}
            />
            <GlobalSelect
              label="Lead"
              value={form.watch("leadId")}
              onChange={(v) =>
                form.setValue("leadId", v, { shouldValidate: true })
              }
              options={leadOptions}
              placeholder="Select lead…"
              error={form.formState.errors.leadId?.message as any}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalSelect
              label="Stage"
              required
              value={form.watch("stage")}
              onChange={(v) =>
                form.setValue("stage", v as any, { shouldValidate: true })
              }
              options={stageFormOptions}
              placeholder="Select stage…"
              error={form.formState.errors.stage?.message}
            />
            <GlobalInput
              label="Amount ($)"
              inputType="number"
              error={form.formState.errors.amount?.message}
              {...form.register("amount")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Probability (%)"
              inputType="number"
              hint="0 - 100"
              error={form.formState.errors.probabilityPercent?.message}
              {...form.register("probabilityPercent")}
            />
            <GlobalDatePicker
              label="Expected close date"
              value={form.watch("expectedCloseDate") ?? null}
              onChange={(v) =>
                form.setValue("expectedCloseDate", v ?? undefined, {
                  shouldValidate: true,
                })
              }
              placeholder="Pick a date"
              error={form.formState.errors.expectedCloseDate?.message as any}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">
              Notes
            </label>
            <textarea
              className="mt-1.5 w-full min-h-[80px] rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Any additional notes about this opportunity…"
              maxLength={2000}
              {...form.register("notes")}
            />
            {form.formState.errors.notes?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {form.formState.errors.notes.message}
              </p>
            )}
          </div>
          {updateState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (updateState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to update opportunity."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <ConfirmDialog
        open={modal.kind === "delete"}
        onOpenChange={(o) => !o && closeModal()}
        title="Delete opportunity"
        variant="destructive"
        description={
          modal.kind === "delete"
            ? `Deleting "${modal.opportunity.name}" is permanent. All associated data including activities will be removed. This action cannot be undone.`
            : ""
        }
        confirmText={deleteState.isLoading ? "Deleting…" : "Delete opportunity"}
        loading={deleteState.isLoading}
        icon={<Trash2 className="w-5 h-5" />}
        onConfirm={handleDelete}
      />
    </div>
  );
}
