"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as Switch from "@radix-ui/react-switch";
import {
  UserPlus,
  Users,
  Pencil,
  Trash2,
  Building2,
  Eye,
  ArrowRightLeft,
  CheckCircle2,
  LayoutGrid,
  Table2,
  ArrowRight,
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
import {
  useListLeadsQuery,
  useCreateLeadMutation,
  useUpdateLeadMutation,
  useDeleteLeadMutation,
  useConvertLeadMutation,
  usePatchLeadStageMutation,
} from "@/lib/api/crmEndpoints";
import type {
  LeadItem,
  LeadStatus,
  LeadSource,
  ListLeadsArgs,
  CreateLeadRequest,
  ConvertLeadRequest,
  ConvertLeadResponse,
} from "@/lib/api/crmEndpoints";

const extract = <T,>(resp?: { success: true; data: { items: T[]; meta: unknown } }) =>
  resp?.data ?? { items: [] as T[], meta: undefined };

const LEAD_STATUS_TONE: Record<LeadStatus, StatusBadgeTone> = {
  NEW: "slate",
  CONTACTED: "sky",
  QUALIFIED: "violet",
  PROPOSAL: "teal",
  WON: "emerald",
  LOST: "rose",
};

const LEAD_SOURCE_TONE: Record<LeadSource, StatusBadgeTone> = {
  WEBSITE: "sky",
  REFERRAL: "violet",
  SOCIAL: "teal",
  PHONE: "slate",
  EMAIL: "sky",
  OTHER: "slate",
};

const STATUS_ORDER: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"];

const statusFilterOptions = [
  { value: "", label: "All statuses" },
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "PROPOSAL", label: "Proposal" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
];

const sourceFilterOptions = [
  { value: "", label: "All sources" },
  { value: "WEBSITE", label: "Website" },
  { value: "REFERRAL", label: "Referral" },
  { value: "SOCIAL", label: "Social Media" },
  { value: "PHONE", label: "Phone" },
  { value: "EMAIL", label: "Email" },
  { value: "OTHER", label: "Other" },
];

const leadSourceOptions = sourceFilterOptions.filter((o) => o.value !== "");
const leadStatusOptions = statusFilterOptions.filter((o) => o.value !== "");

const statusLabel = (s: LeadStatus) =>
  s === "CONTACTED" ? "Contacted" :
  s === "QUALIFIED" ? "Qualified" :
  s === "PROPOSAL" ? "Proposal" :
  s.charAt(0) + s.slice(1).toLowerCase();

const sourceLabel = (s: LeadSource) =>
  s === "SOCIAL" ? "Social Media" :
  s.charAt(0) + s.slice(1).toLowerCase();

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const leadFormSchema = z.object({
  name: z.string().trim().min(1, "Required").max(200),
  companyName: z.string().trim().max(255).optional().or(z.literal("")),
  email: z.string().trim().regex(emailRegex, "Invalid email").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  source: z.enum(["WEBSITE", "REFERRAL", "SOCIAL", "PHONE", "EMAIL", "OTHER"] as const),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"] as const),
  value: z.coerce.number().optional(),
  probability: z.coerce.number().int().min(0).max(100).optional(),
  assignedToId: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
type LeadFormValues = z.infer<typeof leadFormSchema>;

const convertLeadSchema = z.object({
  customerName: z.string().trim().min(1, "Required").max(255),
  createOpportunity: z.boolean(),
  opportunityName: z.string().trim().max(255).optional().or(z.literal("")),
  opportunityAmount: z.coerce.number().optional(),
  expectedCloseDate: z.string().optional(),
  assignedToId: z.string().trim().optional().or(z.literal("")),
});
type ConvertLeadValues = z.infer<typeof convertLeadSchema>;

type ViewMode = "table" | "kanban";

type ModalState =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; lead: LeadItem }
  | { kind: "delete"; lead: LeadItem }
  | { kind: "convert"; lead: LeadItem };

export default function LeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canCreate = useHasPermission({ one: "crm.leads.create" });
  const canUpdate = useHasPermission({ one: "crm.leads.update" });
  const canDelete = useHasPermission({ one: "crm.leads.delete" });

  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const filters: ListLeadsArgs = useMemo(() => {
    const page = parseInt(searchParams?.get("page") ?? "1", 10) || 1;
    const pageSize = parseInt(searchParams?.get("pageSize") ?? "25", 10) || 25;
    return {
      page,
      pageSize,
      search: searchParams?.get("search") ?? "",
      status: (searchParams?.get("status") as LeadStatus | undefined) || undefined,
      source: (searchParams?.get("source") as LeadSource | undefined) || undefined,
      assignedToId: searchParams?.get("assignedToId") || undefined,
      sortBy: searchParams?.get("sortBy") ?? "createdAt",
      sortOrder: (searchParams?.get("sortOrder") as "asc" | "desc") ?? "desc",
    };
  }, [searchParams]);

  const listArgs = useMemo(() => {
    if (viewMode === "kanban") {
      return { ...filters, page: 1, pageSize: 500 };
    }
    return filters;
  }, [viewMode, filters]);

  const { data: leadsRes, isFetching, refetch } = useListLeadsQuery(listArgs, {
    refetchOnMountOrArgChange: true,
  });

  const leads = extract(leadsRes as any).items as LeadItem[];
  const meta = extract(leadsRes as any).meta;

  const leadsByStatus = useMemo(() => {
    const grouped: Record<LeadStatus, LeadItem[]> = {
      NEW: [], CONTACTED: [], QUALIFIED: [], PROPOSAL: [], WON: [], LOST: [],
    };
    for (const l of leads) grouped[l.status].push(l);
    return grouped;
  }, [leads]);

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
  const [createTrigger, createState] = useCreateLeadMutation();
  const [updateTrigger, updateState] = useUpdateLeadMutation();
  const [deleteTrigger, deleteState] = useDeleteLeadMutation();
  const [convertTrigger, convertState] = useConvertLeadMutation();
  const [patchStageTrigger, patchStageState] = usePatchLeadStageMutation();

  const leadForm = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      name: "",
      companyName: "",
      email: "",
      phone: "",
      source: "OTHER",
      status: "NEW",
      value: 0,
      probability: 0,
      assignedToId: "",
      notes: "",
    },
    mode: "onTouched",
  });

  const convertForm = useForm<ConvertLeadValues>({
    resolver: zodResolver(convertLeadSchema),
    defaultValues: {
      customerName: "",
      createOpportunity: true,
      opportunityName: "",
      opportunityAmount: 0,
      expectedCloseDate: "",
      assignedToId: "",
    },
    mode: "onTouched",
  });

  useEffect(() => {
    if (modal.kind === "edit") {
      leadForm.reset({
        name: modal.lead.name,
        companyName: modal.lead.companyName ?? "",
        email: modal.lead.email ?? "",
        phone: modal.lead.phone ?? "",
        source: modal.lead.source,
        status: modal.lead.status,
        value: typeof modal.lead.value === "string" ? parseFloat(modal.lead.value) : modal.lead.value,
        probability: modal.lead.probability,
        assignedToId: modal.lead.assignedToId ?? "",
        notes: "",
      });
    } else if (modal.kind === "create") {
      leadForm.reset({
        name: "",
        companyName: "",
        email: "",
        phone: "",
        source: "OTHER",
        status: "NEW",
        value: 0,
        probability: 0,
        assignedToId: "",
        notes: "",
      });
    }
  }, [modal, leadForm]);

  useEffect(() => {
    if (modal.kind === "convert") {
      const lead = modal.lead;
      const defaultOppName = `Opportunity: ${lead.name}`;
      convertForm.reset({
        customerName: lead.name,
        createOpportunity: true,
        opportunityName: defaultOppName,
        opportunityAmount: typeof lead.value === "string" ? parseFloat(lead.value) : (lead.value ?? 0),
        expectedCloseDate: "",
        assignedToId: lead.assignedToId ?? "",
      });
    }
  }, [modal, convertForm]);

  const closeModal = () => {
    setModal({ kind: "none" });
    leadForm.reset();
    convertForm.reset();
  };

  const onSubmitCreateLead = async (v: LeadFormValues) => {
    const body: CreateLeadRequest = {
      ...v,
      email: v.email || undefined,
      phone: v.phone || undefined,
      companyName: v.companyName || undefined,
      notes: v.notes || undefined,
      assignedToId: v.assignedToId || undefined,
      value: v.value,
      probability: v.probability,
    };
    const out = await createTrigger(body);
    if ("data" in out && out.data?.success) {
      closeModal();
    }
  };

  const onSubmitEditLead = async (v: LeadFormValues) => {
    if (modal.kind !== "edit") return;
    const out = await updateTrigger({
      id: modal.lead.id,
      body: {
        ...v,
        email: v.email || undefined,
        phone: v.phone || undefined,
        companyName: v.companyName || undefined,
        notes: v.notes || undefined,
        assignedToId: v.assignedToId || undefined,
        value: v.value,
        probability: v.probability,
      },
    });
    if ("data" in out && out.data?.success) {
      closeModal();
    }
  };

  const handleDelete = async () => {
    if (modal.kind !== "delete") return;
    await deleteTrigger(modal.lead.id);
    setModal({ kind: "none" });
  };

  const onSubmitConvertLead = async (v: ConvertLeadValues) => {
    if (modal.kind !== "convert") return;
    const body: ConvertLeadRequest = {
      customerName: v.customerName,
      createOpportunity: v.createOpportunity,
      opportunityName: v.createOpportunity ? (v.opportunityName || undefined) : undefined,
      opportunityAmount: v.createOpportunity ? v.opportunityAmount : undefined,
      expectedCloseDate: v.createOpportunity ? (v.expectedCloseDate || undefined) : undefined,
      assignedToId: v.assignedToId || undefined,
    };
    const out = await convertTrigger({ id: modal.lead.id, body });
    if ("data" in out && out.data?.success) {
      const resp = out.data.data as unknown as ConvertLeadResponse;
      const newCustomerId = resp.customer?.id;
      if (newCustomerId) {
        router.push(`/crm/customers/${newCustomerId}`);
      } else {
        closeModal();
        refetch();
      }
    }
  };

  const handlePatchStage = async (leadId: string, newStage: LeadStatus) => {
    await patchStageTrigger({ id: leadId, body: { stage: newStage } });
    refetch();
  };

  const onOpenCreate = () => setModal({ kind: "create" });

  const leadInitials = (l: LeadItem) =>
    `${l.name?.[0] ?? ""}`.toUpperCase() || "L";

  const assignedInitials = (l: LeadItem) =>
    `${l.assignedTo?.firstName?.[0] ?? ""}${l.assignedTo?.lastName?.[0] ?? ""}`.toUpperCase() || "U";

  const canConvert = (status: LeadStatus) => status !== "WON" && status !== "LOST";
  const canConvertKanban = (status: LeadStatus) =>
    status === "QUALIFIED" || status === "PROPOSAL" || status === "WON";

  const columns: ColumnDef<TableFeatures, LeadItem, any>[] = useMemo(() => {
    const col = createColumns<LeadItem>();
    return [
      col.accessor("leadCode" as any, {
        id: "leadCode",
        header: "Code",
        enableSorting: true,
        cell: ({ row: { original: l } }) => (
          <span className="font-mono text-xs text-slate-600 dark:text-slate-400 truncate max-w-[12ch]">
            {l.leadCode}
          </span>
        ),
      }),
      col.display({
        id: "name",
        header: "Lead / Company",
        cell: ({ row: { original: l } }) => (
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 h-9 w-9 shrink-0 flex items-center justify-center font-semibold text-sm border border-violet-200 dark:border-violet-900/60">
              {leadInitials(l)}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">{l.name}</p>
              {l.companyName && (
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  <Building2 className="w-3 h-3 inline shrink-0" />
                  {l.companyName}
                </p>
              )}
              {!l.companyName && l.email && (
                <p className="text-xs text-muted-foreground truncate">{l.email}</p>
              )}
            </div>
          </div>
        ),
      }),
      col.display({
        id: "status",
        header: "Status",
        cell: ({ row: { original: l } }) => (
          <StatusBadge
            tone={LEAD_STATUS_TONE[l.status]}
            size="md"
            dot={l.status === "QUALIFIED" || l.status === "WON"}
            label={statusLabel(l.status)}
          />
        ),
      }),
      col.display({
        id: "source",
        header: "Source",
        cell: ({ row: { original: l } }) => (
          <StatusBadge
            tone={LEAD_SOURCE_TONE[l.source]}
            size="sm"
            label={sourceLabel(l.source)}
          />
        ),
      }),
      col.display({
        id: "assignedTo",
        header: "Owner",
        cell: ({ row: { original: l } }) => {
          if (!l.assignedTo) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center text-[10px] font-semibold border border-slate-200 dark:border-slate-700">
                {assignedInitials(l)}
              </div>
              <span className="text-xs text-foreground truncate max-w-[14ch]">
                {l.assignedTo.firstName} {l.assignedTo.lastName?.[0] ?? ""}.
              </span>
            </div>
          );
        },
      }),
      col.display({
        id: "value",
        header: "Value",
        cell: ({ row: { original: l } }) => (
          <MoneyDisplay value={l.value} currency={l.currency ?? "USD"} />
        ),
      }),
      col.accessor("createdAt" as any, {
        id: "createdAt",
        header: "Created",
        enableSorting: true,
        cell: ({ row: { original: l } }) => (
          <DateDisplay date={l.createdAt} format="short" />
        ),
      }),
      col.display({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row: { original: l } }) => (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-slate-600 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 h-8 px-2"
            >
              <Link href={`/crm/leads/${l.id}`}>
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline ml-1">View</span>
              </Link>
            </Button>
            <PermissionGate one="crm.leads.update">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal({ kind: "edit", lead: l })}
                disabled={!canUpdate}
                className="h-8 px-2"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              {canConvert(l.status) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModal({ kind: "convert", lead: l })}
                  className="h-8 px-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline ml-1">Convert</span>
                </Button>
              )}
            </PermissionGate>
            <PermissionGate one="crm.leads.delete">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModal({ kind: "delete", lead: l })}
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
        breadcrumbs={[{ label: "CRM" }, { label: "Leads" }]}
        title="Leads"
        description="Track and manage prospective customers through the sales pipeline."
        action={
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-lg border border-border bg-slate-50 dark:bg-slate-900/50 p-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("table")}
                className={viewMode === "table" ? "bg-background shadow-sm text-foreground" : "text-slate-600 dark:text-slate-400"}
              >
                <Table2 className="w-3.5 h-3.5 mr-1.5" />
                Table
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("kanban")}
                className={viewMode === "kanban" ? "bg-background shadow-sm text-foreground" : "text-slate-600 dark:text-slate-400"}
              >
                <LayoutGrid className="w-3.5 h-3.5 mr-1.5" />
                Kanban
              </Button>
            </div>
            <PermissionGate one="crm.leads.create">
              <Button size="sm" onClick={onOpenCreate} disabled={!canCreate}>
                <UserPlus className="w-4 h-4" /> Create Lead
              </Button>
            </PermissionGate>
          </div>
        }
      />

      {viewMode === "table" ? (
        <>
          <TableToolbar
            searchTerm={filters.search ?? ""}
            onSearchChange={(v) => pushParams({ search: v })}
            searchPlaceholder="Search by name, email, or company…"
            onCreateNew={canCreate ? onOpenCreate : undefined}
            disableCreateNew={!canCreate}
            startContent={
              <>
                <GlobalSelect
                  value={filters.status ?? ""}
                  onChange={(v) => pushParams({ status: v })}
                  options={statusFilterOptions}
                  placeholder="Status"
                  className="w-40"
                />
                <GlobalSelect
                  value={filters.source ?? ""}
                  onChange={(v) => pushParams({ source: v })}
                  options={sourceFilterOptions}
                  placeholder="Source"
                  className="w-44"
                />
              </>
            }
          />

          <GlobalTable<LeadItem>
            columns={columns}
            data={leads}
            meta={meta as any}
            serverSide
            pageSizeDefault={25}
            defaultSortBy="createdAt"
            defaultSortOrder="desc"
            queryResult={{
              data: leadsRes?.data as any,
              isFetching,
            }}
            getRowId={(l) => l.id}
            onRowClick={(l) => router.push(`/crm/leads/${l.id}`)}
            emptyIcon={<Users className="w-10 h-10" />}
            emptyTitle="No leads found"
            emptyDescription="No leads match the current filters."
            emptyAction={
              <PermissionGate one="crm.leads.create">
                <Button size="sm" onClick={onOpenCreate}>
                  <UserPlus className="w-4 h-4" /> Create Lead
                </Button>
              </PermissionGate>
            }
            errorOnRetry={() => refetch()}
          />
        </>
      ) : (
        <KanbanBoard
          leadsByStatus={leadsByStatus}
          isFetching={isFetching}
          onView={(id) => router.push(`/crm/leads/${id}`)}
          onEdit={(lead) => setModal({ kind: "edit", lead })}
          onConvert={(lead) => setModal({ kind: "convert", lead })}
          onPatchStage={handlePatchStage}
          canUpdate={canUpdate}
          canConvertKanban={canConvertKanban}
          patchStageLoading={patchStageState.isLoading}
        />
      )}

      <GlobalModal
        open={modal.kind === "create"}
        onOpenChange={(o) => !o && closeModal()}
        title="Create new lead"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="createLeadForm"
              disabled={createState.isLoading || !canCreate}
            >
              {createState.isLoading ? "Creating…" : "Create lead"}
            </Button>
          </div>
        }
      >
        <form
          id="createLeadForm"
          onSubmit={leadForm.handleSubmit(onSubmitCreateLead)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Name"
              required
              error={leadForm.formState.errors.name?.message}
              {...leadForm.register("name")}
            />
            <GlobalInput
              label="Company name"
              error={leadForm.formState.errors.companyName?.message}
              {...leadForm.register("companyName")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Email"
              inputType="email"
              error={leadForm.formState.errors.email?.message}
              {...leadForm.register("email")}
            />
            <GlobalInput
              label="Phone"
              error={leadForm.formState.errors.phone?.message}
              {...leadForm.register("phone")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalSelect
              label="Source"
              value={leadForm.watch("source")}
              onChange={(v) => leadForm.setValue("source", v as any, { shouldValidate: true })}
              options={leadSourceOptions}
              placeholder="Select source…"
              error={leadForm.formState.errors.source?.message}
            />
            <GlobalSelect
              label="Status"
              value={leadForm.watch("status")}
              onChange={(v) => leadForm.setValue("status", v as any, { shouldValidate: true })}
              options={leadStatusOptions}
              placeholder="Select status…"
              error={leadForm.formState.errors.status?.message}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Estimated value ($)"
              inputType="number"
              error={leadForm.formState.errors.value?.message}
              {...leadForm.register("value")}
            />
            <GlobalInput
              label="Probability (%)"
              inputType="number"
              hint="0 - 100"
              error={leadForm.formState.errors.probability?.message}
              {...leadForm.register("probability")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Notes</label>
            <textarea
              className="mt-1.5 w-full min-h-[80px] rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Any additional notes about this lead…"
              maxLength={2000}
              {...leadForm.register("notes")}
            />
            {leadForm.formState.errors.notes?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {leadForm.formState.errors.notes.message}
              </p>
            )}
          </div>
          {createState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (createState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to create lead."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <GlobalModal
        open={modal.kind === "edit"}
        onOpenChange={(o) => !o && closeModal()}
        title="Edit lead"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="editLeadForm"
              disabled={updateState.isLoading || !canUpdate}
            >
              {updateState.isLoading ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      >
        <form
          id="editLeadForm"
          onSubmit={leadForm.handleSubmit(onSubmitEditLead)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Name"
              required
              error={leadForm.formState.errors.name?.message}
              {...leadForm.register("name")}
            />
            <GlobalInput
              label="Company name"
              error={leadForm.formState.errors.companyName?.message}
              {...leadForm.register("companyName")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Email"
              inputType="email"
              error={leadForm.formState.errors.email?.message}
              {...leadForm.register("email")}
            />
            <GlobalInput
              label="Phone"
              error={leadForm.formState.errors.phone?.message}
              {...leadForm.register("phone")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalSelect
              label="Source"
              value={leadForm.watch("source")}
              onChange={(v) => leadForm.setValue("source", v as any, { shouldValidate: true })}
              options={leadSourceOptions}
              placeholder="Select source…"
              error={leadForm.formState.errors.source?.message}
            />
            <GlobalSelect
              label="Status"
              value={leadForm.watch("status")}
              onChange={(v) => leadForm.setValue("status", v as any, { shouldValidate: true })}
              options={leadStatusOptions}
              placeholder="Select status…"
              error={leadForm.formState.errors.status?.message}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Estimated value ($)"
              inputType="number"
              error={leadForm.formState.errors.value?.message}
              {...leadForm.register("value")}
            />
            <GlobalInput
              label="Probability (%)"
              inputType="number"
              hint="0 - 100"
              error={leadForm.formState.errors.probability?.message}
              {...leadForm.register("probability")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Notes</label>
            <textarea
              className="mt-1.5 w-full min-h-[80px] rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Any additional notes about this lead…"
              maxLength={2000}
              {...leadForm.register("notes")}
            />
            {leadForm.formState.errors.notes?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {leadForm.formState.errors.notes.message}
              </p>
            )}
          </div>
          {updateState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (updateState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to update lead."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <GlobalModal
        open={modal.kind === "convert"}
        onOpenChange={(o) => !o && closeModal()}
        title="Convert Lead to Customer + Opportunity"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="convertLeadForm"
              disabled={convertState.isLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {convertState.isLoading ? "Converting…" : "Convert lead"}
            </Button>
          </div>
        }
      >
        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 dark:border-sky-900/60 dark:bg-sky-950/30 p-4">
          <div className="flex items-start gap-3">
            <ArrowRight className="w-5 h-5 text-sky-600 dark:text-sky-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sky-800 dark:text-sky-200">
                Creates a new Customer &amp; optionally a linked Opportunity.
              </p>
              <p className="text-sm text-sky-700 dark:text-sky-300 mt-0.5">
                Cannot be undone. The lead will be set to <strong>WON</strong>.
              </p>
            </div>
          </div>
        </div>
        <form
          id="convertLeadForm"
          onSubmit={convertForm.handleSubmit(onSubmitConvertLead)}
          className="space-y-4"
          noValidate
        >
          <GlobalInput
            label="Customer name"
            required
            error={convertForm.formState.errors.customerName?.message}
            {...convertForm.register("customerName")}
          />
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Create opportunity</p>
              <p className="text-xs text-muted-foreground">
                Link a new open opportunity to this customer
              </p>
            </div>
            <Switch.Root
              checked={convertForm.watch("createOpportunity")}
              onCheckedChange={(v) => convertForm.setValue("createOpportunity", v)}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/70 focus:ring-offset-2 bg-slate-200 dark:bg-slate-700 data-[state=checked]:bg-primary"
            >
              <Switch.Thumb className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-md transition-transform data-[state=checked]:translate-x-5" />
            </Switch.Root>
          </div>
          {convertForm.watch("createOpportunity") && (
            <div className="grid grid-cols-2 gap-4">
              <GlobalInput
                label="Opportunity name"
                error={convertForm.formState.errors.opportunityName?.message}
                {...convertForm.register("opportunityName")}
              />
              <GlobalInput
                label="Opportunity amount ($)"
                inputType="number"
                error={convertForm.formState.errors.opportunityAmount?.message}
                {...convertForm.register("opportunityAmount")}
              />
              <GlobalDatePicker
                label="Expected close date"
                value={convertForm.watch("expectedCloseDate") ?? null}
                onChange={(v) =>
                  convertForm.setValue("expectedCloseDate", v ?? undefined, { shouldValidate: true })
                }
                placeholder="Pick a date"
                error={convertForm.formState.errors.expectedCloseDate?.message as any}
              />
            </div>
          )}
          {convertState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (convertState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to convert lead."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <ConfirmDialog
        open={modal.kind === "delete"}
        onOpenChange={(o) => !o && closeModal()}
        title="Delete lead"
        variant="destructive"
        description={
          modal.kind === "delete"
            ? `Deleting "${modal.lead.name}" is permanent. All associated data including activities will be removed. This action cannot be undone.`
            : ""
        }
        confirmText={deleteState.isLoading ? "Deleting…" : "Delete lead"}
        loading={deleteState.isLoading}
        icon={<Trash2 className="w-5 h-5" />}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function KanbanBoard({
  leadsByStatus,
  isFetching,
  onView,
  onEdit,
  onConvert,
  onPatchStage,
  canUpdate,
  canConvertKanban,
  patchStageLoading,
}: {
  leadsByStatus: Record<LeadStatus, LeadItem[]>;
  isFetching: boolean;
  onView: (id: string) => void;
  onEdit: (lead: LeadItem) => void;
  onConvert: (lead: LeadItem) => void;
  onPatchStage: (leadId: string, newStage: LeadStatus) => void;
  canUpdate: boolean;
  canConvertKanban: (status: LeadStatus) => boolean;
  patchStageLoading: boolean;
}) {
  const headerToneBg: Record<LeadStatus, string> = {
    NEW: "bg-slate-100 dark:bg-slate-800/70",
    CONTACTED: "bg-sky-100 dark:bg-sky-950/40",
    QUALIFIED: "bg-violet-100 dark:bg-violet-950/40",
    PROPOSAL: "bg-teal-100 dark:bg-teal-950/40",
    WON: "bg-emerald-100 dark:bg-emerald-950/40",
    LOST: "bg-rose-100 dark:bg-rose-950/40",
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      {isFetching && (
        <div className="pointer-events-none absolute inset-0 z-10 bg-background/60 backdrop-blur-[1px] animate-in fade-in-0 rounded-2xl" style={{ position: "fixed", inset: 0 }} />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {STATUS_ORDER.map((status) => (
          <div
            key={status}
            className="rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden flex flex-col min-h-[400px]"
          >
            <div className={`px-3 py-2.5 ${headerToneBg[status]} border-b border-border flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <StatusBadge
                  tone={LEAD_STATUS_TONE[status]}
                  size="sm"
                  label={statusLabel(status)}
                />
              </div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full">
                {leadsByStatus[status].length}
              </span>
            </div>
            <div className="flex-1 p-2.5 space-y-2 overflow-y-auto max-h-[600px]">
              {leadsByStatus[status].length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 py-8 text-center text-xs text-slate-400">
                  No leads
                </div>
              ) : (
                leadsByStatus[status].map((lead) => (
                  <KanbanCard
                    key={lead.id}
                    lead={lead}
                    currentStatus={status}
                    onView={onView}
                    onEdit={onEdit}
                    onConvert={onConvert}
                    onPatchStage={onPatchStage}
                    canUpdate={canUpdate}
                    canConvertKanban={canConvertKanban}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KanbanCard({
  lead,
  currentStatus,
  onView,
  onEdit,
  onConvert,
  onPatchStage,
  canUpdate,
  canConvertKanban,
}: {
  lead: LeadItem;
  currentStatus: LeadStatus;
  onView: (id: string) => void;
  onEdit: (lead: LeadItem) => void;
  onConvert: (lead: LeadItem) => void;
  onPatchStage: (leadId: string, newStage: LeadStatus) => void;
  canUpdate: boolean;
  canConvertKanban: (status: LeadStatus) => boolean;
}) {
  const leadInitials = `${lead.name?.[0] ?? ""}`.toUpperCase() || "L";
  const availableStages = STATUS_ORDER.filter((s) => s !== currentStatus);
  const stageMoveOptions = availableStages.map((s) => ({ value: s, label: `Move to ${statusLabel(s)}` }));

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm hover:shadow-md transition-shadow space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 h-7 w-7 shrink-0 flex items-center justify-center font-semibold text-xs border border-violet-200 dark:border-violet-900/60">
            {leadInitials}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm text-foreground truncate">{lead.name}</p>
            <p className="text-[10px] font-mono text-slate-400">{lead.leadCode}</p>
          </div>
        </div>
        <PermissionGate one="crm.leads.update">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(lead)}
            disabled={!canUpdate}
            className="h-7 w-7 p-0 text-slate-500 hover:text-foreground"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        </PermissionGate>
      </div>

      {lead.companyName && (
        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
          <Building2 className="w-3 h-3 shrink-0" />
          {lead.companyName}
        </p>
      )}

      <div className="flex items-center justify-between text-xs">
        <MoneyDisplay value={lead.value} currency={lead.currency ?? "USD"} align="left" className="!w-auto font-semibold" />
        {lead.probability > 0 && (
          <span className="text-slate-500">{lead.probability}%</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-1.5 pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onView(lead.id)}
          className="h-7 px-2 text-xs text-slate-600 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Eye className="w-3 h-3 mr-1" />
          View
        </Button>
        <PermissionGate one="crm.leads.update">
          {canConvertKanban(currentStatus) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onConvert(lead)}
              disabled={!canUpdate}
              className="h-7 px-2 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900"
            >
              <ArrowRight className="w-3 h-3 mr-1" />
              Convert
            </Button>
          )}
        </PermissionGate>
      </div>

      <PermissionGate one="crm.leads.update">
        <div className="pt-1 border-t border-border/60">
          <GlobalSelect
            placeholder="Move to…"
            options={stageMoveOptions}
            value=""
            onChange={(v) => {
              if (v) onPatchStage(lead.id, v as LeadStatus);
            }}
            disabled={!canUpdate}
          />
        </div>
      </PermissionGate>
    </div>
  );
}
