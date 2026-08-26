"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as Tabs from "@radix-ui/react-tabs";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Target,
  Calendar,
  DollarSign,
  UserCircle2,
  Building2,
  UserPlus,
  Phone,
  Mail,
  Briefcase,
  MessageSquare,
  Send,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { GlobalModal } from "@/components/feedback/GlobalModal";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { GlobalInput } from "@/components/form/GlobalInput";
import { GlobalSelect } from "@/components/form/GlobalSelect";
import { GlobalDatePicker } from "@/components/form/GlobalDatePicker";
import { StatusBadge, type StatusBadgeTone } from "@/components/common/StatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { MoneyDisplay } from "@/components/common/MoneyDisplay";
import { PermissionGate, useHasPermission } from "@/components/auth/PermissionGate";
import { useAppSelector } from "@/store/hooks";
import { cn } from "@/lib/utils";
import {
  useGetOpportunityQuery,
  useUpdateOpportunityMutation,
  useDeleteOpportunityMutation,
  usePatchOppStageMutation,
  useCreateActivityMutation,
  useListCustomersQuery,
  useListLeadsQuery,
} from "@/lib/api/crmEndpoints";
import type {
  OpportunityDetail,
  OpportunityStage,
  ActivityItem,
  ActivityType,
  UpdateOpportunityRequest,
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

const STAGE_DOT_CLASS: Record<OpportunityStage, string> = {
  PROSPECTING: "bg-slate-500",
  QUALIFICATION: "bg-sky-500",
  NEEDS_ANALYSIS: "bg-violet-500",
  PROPOSAL: "bg-teal-500",
  NEGOTIATION: "bg-violet-500",
  CLOSED_WON: "bg-emerald-500",
  CLOSED_LOST: "bg-rose-500",
};

const STAGE_ORDER: OpportunityStage[] = [
  "PROSPECTING",
  "QUALIFICATION",
  "NEEDS_ANALYSIS",
  "PROPOSAL",
  "NEGOTIATION",
  "CLOSED_WON",
  "CLOSED_LOST",
];

const ACTIVITY_TYPE_TONE: Record<ActivityType, StatusBadgeTone> = {
  CALL: "sky",
  EMAIL: "violet",
  MEETING: "teal",
  NOTE: "slate",
  TASK: "violet",
  PROPOSAL_SENT: "emerald",
};

const ACTIVITY_TYPE_ICON: Record<ActivityType, React.ReactNode> = {
  CALL: <Phone className="w-4 h-4" />,
  EMAIL: <Mail className="w-4 h-4" />,
  MEETING: <Calendar className="w-4 h-4" />,
  NOTE: <MessageSquare className="w-4 h-4" />,
  TASK: <Briefcase className="w-4 h-4" />,
  PROPOSAL_SENT: <Send className="w-4 h-4" />,
};

const stageLabel = (s: OpportunityStage) =>
  s === "CLOSED_WON"
    ? "Closed Won"
    : s === "CLOSED_LOST"
      ? "Closed Lost"
      : s === "NEEDS_ANALYSIS"
        ? "Needs Analysis"
        : s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ");

const activityLabel = (t: ActivityType) =>
  t === "PROPOSAL_SENT"
    ? "Proposal Sent"
    : t.charAt(0) + t.slice(1).toLowerCase();

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

const activityFormSchema = z.object({
  type: z.enum([
    "CALL",
    "EMAIL",
    "MEETING",
    "NOTE",
    "TASK",
    "PROPOSAL_SENT",
  ] as const),
  subject: z.string().trim().min(1, "Required").max(255),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  activityAt: z.string().optional(),
});
type ActivityFormValues = z.infer<typeof activityFormSchema>;

const stageOptions = STAGE_ORDER.map((s) => ({
  value: s,
  label: stageLabel(s),
}));

const activityTypeOptions = [
  { value: "CALL", label: "Call" },
  { value: "EMAIL", label: "Email" },
  { value: "MEETING", label: "Meeting" },
  { value: "NOTE", label: "Note" },
  { value: "TASK", label: "Task" },
  { value: "PROPOSAL_SENT", label: "Proposal Sent" },
];

export default function OpportunityDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const authUser = useAppSelector((s) => s.auth.user);
  const canUpdate = useHasPermission({ one: "crm.opportunities.update" });
  const canDelete = useHasPermission({ one: "crm.opportunities.delete" });

  const { data: oppRes, isFetching, refetch } = useGetOpportunityQuery(id, {
    skip: !id,
  });
  const opportunity: OpportunityDetail | undefined = oppRes?.data as
    | OpportunityDetail
    | undefined;

  const { data: customersRes } = useListCustomersQuery({ pageSize: 100 });
  const { data: leadsRes } = useListLeadsQuery({ pageSize: 100 });
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

  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [quickStageValue, setQuickStageValue] = useState<string>("");

  const [updateTrigger, updateState] = useUpdateOpportunityMutation();
  const [deleteTrigger, deleteState] = useDeleteOpportunityMutation();
  const [patchStageTrigger, patchStageState] = usePatchOppStageMutation();
  const [createActivityTrigger, createActivityState] = useCreateActivityMutation();

  const oppForm = useForm<OpportunityFormValues>({
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

  const activityForm = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      type: "NOTE",
      subject: "",
      description: "",
      activityAt: new Date().toISOString().slice(0, 10),
    },
    mode: "onTouched",
  });

  useEffect(() => {
    if (opportunity) {
      setQuickStageValue(opportunity.stage);
    }
  }, [opportunity]);

  useEffect(() => {
    if (editOpen && opportunity) {
      oppForm.reset({
        name: opportunity.name,
        customerId: opportunity.customerId ?? "",
        leadId: opportunity.leadId ?? "",
        stage: opportunity.stage,
        amount:
          typeof opportunity.amount === "string"
            ? parseFloat(opportunity.amount)
            : opportunity.amount,
        probabilityPercent: opportunity.probabilityPercent ?? 0,
        expectedCloseDate: opportunity.expectedCloseDate ?? "",
        assignedToId: opportunity.assignedToId ?? "",
        notes: "",
      });
    }
  }, [editOpen, opportunity, oppForm]);

  useEffect(() => {
    if (activityModalOpen) {
      activityForm.reset({
        type: "NOTE",
        subject: "",
        description: "",
        activityAt: new Date().toISOString().slice(0, 10),
      });
    }
  }, [activityModalOpen, activityForm]);

  const onSubmitEdit = async (v: OpportunityFormValues) => {
    if (!id) return;
    const body: UpdateOpportunityRequest = {
      ...v,
      customerId: v.customerId || undefined,
      leadId: v.leadId || undefined,
      assignedToId: v.assignedToId || undefined,
      expectedCloseDate: v.expectedCloseDate || undefined,
      notes: v.notes || undefined,
    };
    const out = await updateTrigger({ id, body });
    if ("data" in out && out.data?.success) {
      setEditOpen(false);
      refetch();
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    await deleteTrigger(id);
    router.push("/crm/opportunities");
  };

  const handleQuickStageChange = async (newStage: string) => {
    if (!id || !newStage || newStage === opportunity?.stage) return;
    const out = await patchStageTrigger({
      id,
      body: { stage: newStage as OpportunityStage },
    });
    if ("data" in out && out.data?.success) {
      setQuickStageValue(newStage);
      refetch();
    }
  };

  const onSubmitCreateActivity = async (v: ActivityFormValues) => {
    if (!id || !authUser) return;
    const out = await createActivityTrigger({
      type: v.type,
      subject: v.subject,
      description: v.description || undefined,
      activityAt: v.activityAt,
      userId: authUser.id,
      opportunityId: id,
    });
    if ("data" in out && out.data?.success) {
      setActivityModalOpen(false);
      refetch();
    }
  };

  const assignedInitials = (o: OpportunityDetail) =>
    `${o.assignedTo?.firstName?.[0] ?? ""}${o.assignedTo?.lastName?.[0] ?? ""}`.toUpperCase() || "U";

  const activityInitials = (a: ActivityItem) =>
    `${a.user?.firstName?.[0] ?? ""}${a.user?.lastName?.[0] ?? ""}`.toUpperCase() || "U";

  const currentStageIdx = opportunity
    ? STAGE_ORDER.indexOf(opportunity.stage)
    : -1;

  const sortedActivities = useMemo(() => {
    return [...(opportunity?.activities ?? [])].sort(
      (a, b) =>
        new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime()
    );
  }, [opportunity?.activities]);

  const probabilityPct = opportunity?.probabilityPercent ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "CRM" },
          { label: "Deals", href: "/crm/opportunities" },
          { label: opportunity?.name ?? "..." },
        ]}
        title={opportunity?.name ?? "Loading…"}
        description={
          opportunity
            ? `${opportunity.opportunityCode} · Track deal progress, stage changes, and customer interactions`
            : "Loading opportunity details…"
        }
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/crm/opportunities">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>
            </Button>
            <PermissionGate one="crm.opportunities.update">
              <GlobalSelect
                value={quickStageValue}
                onChange={handleQuickStageChange}
                options={stageOptions}
                placeholder="Change Stage"
                disabled={!canUpdate || !opportunity || patchStageState.isLoading}
                className="w-44"
              />
            </PermissionGate>
            <PermissionGate one="crm.opportunities.update">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
                disabled={!canUpdate || !opportunity}
              >
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
            </PermissionGate>
            <PermissionGate one="crm.opportunities.delete">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirmOpen(true)}
                className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Sales Pipeline
          </p>
          {opportunity && (
            <StatusBadge
              tone={OPPORTUNITY_STAGE_TONE[opportunity.stage]}
              size="sm"
              dot
              label={stageLabel(opportunity.stage)}
            />
          )}
        </div>
        <div className="relative">
          <div className="absolute left-0 right-0 top-4 h-0.5 bg-slate-200 dark:bg-slate-700 z-0" />
          <div className="relative z-10 grid grid-cols-7 gap-2">
            {STAGE_ORDER.map((stage, idx) => {
              const isCompleted =
                currentStageIdx >= 0 &&
                idx < currentStageIdx &&
                stage !== "CLOSED_LOST";
              const isCurrent =
                currentStageIdx >= 0 && idx === currentStageIdx;
              const isFinal = stage === "CLOSED_WON" || stage === "CLOSED_LOST";
              return (
                <div
                  key={stage}
                  className={cn(
                    "flex flex-col items-center gap-2",
                    isFinal && "col-span-1"
                  )}
                >
                  <div
                    className={cn(
                      "relative h-9 w-9 rounded-full flex items-center justify-center border-2 transition-all z-10",
                      isCurrent
                        ? cn(
                            "bg-card border-2 shadow-md",
                            STAGE_DOT_CLASS[stage].replace(
                              "bg-",
                              "border-"
                            )
                          )
                        : isCompleted
                          ? "border-emerald-500 bg-emerald-500"
                          : "bg-card border-slate-300 dark:border-slate-600"
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full",
                        isCurrent
                          ? STAGE_DOT_CLASS[stage]
                          : isCompleted
                            ? "bg-white"
                            : "bg-slate-300 dark:bg-slate-600"
                      )}
                    />
                  </div>
                  <p
                    className={cn(
                      "text-[10px] font-semibold text-center leading-tight",
                      isCurrent
                        ? "text-foreground"
                        : isCompleted
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    {stageLabel(stage)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-sky-50 dark:bg-sky-950/40 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                Deal Amount
              </p>
              <p className="text-2xl font-bold text-foreground">
                <MoneyDisplay
                  value={opportunity?.amount}
                  currency={opportunity?.currency ?? "USD"}
                  align="left"
                  className="!w-auto !text-2xl"
                />
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                  Expected Close
                </p>
                <p className="text-lg font-semibold text-foreground">
                  <DateDisplay
                    date={opportunity?.expectedCloseDate}
                    format="medium"
                  />
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Win probability</span>
              <span className="font-semibold text-foreground">
                {probabilityPct}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  probabilityPct >= 80
                    ? "bg-emerald-500"
                    : probabilityPct >= 50
                      ? "bg-sky-500"
                      : probabilityPct >= 20
                        ? "bg-violet-500"
                        : "bg-slate-400"
                )}
                style={{ width: `${Math.min(100, probabilityPct)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <Tabs.Root defaultValue="details" className="space-y-4">
        <Tabs.List className="flex items-center gap-1 p-1 rounded-xl border border-border bg-slate-50 dark:bg-slate-900/50 w-fit">
          <Tabs.Trigger
            value="details"
            className="px-4 py-2 text-sm font-medium rounded-lg transition-all text-slate-600 dark:text-slate-400 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <span className="inline-flex items-center gap-2">
              <Target className="w-4 h-4" /> Details
            </span>
          </Tabs.Trigger>
          <Tabs.Trigger
            value="activity"
            className="px-4 py-2 text-sm font-medium rounded-lg transition-all text-slate-600 dark:text-slate-400 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <span className="inline-flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Activity
              <span className="rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 text-[10px] font-semibold">
                {sortedActivities.length}
              </span>
            </span>
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="details" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-foreground">
                Opportunity Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                    Customer
                  </p>
                  {opportunity?.customer?.name ? (
                    <Link
                      href={`/crm/customers/${opportunity.customer.id}`}
                      className="inline-flex items-center gap-1.5 text-sky-600 dark:text-sky-400 hover:underline font-medium"
                    >
                      <Building2 className="w-4 h-4" />
                      {opportunity.customer.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                    Linked Lead
                  </p>
                  {opportunity?.lead?.name ? (
                    <Link
                      href={`/crm/leads/${opportunity.lead.id}`}
                      className="inline-flex items-center gap-1.5 text-sky-600 dark:text-sky-400 hover:underline font-medium"
                    >
                      <UserPlus className="w-4 h-4" />
                      {opportunity.lead.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                    Assigned To
                  </p>
                  {opportunity?.assignedTo ? (
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center text-[10px] font-semibold">
                        {assignedInitials(opportunity)}
                      </div>
                      <span className="font-medium text-foreground">
                        {opportunity.assignedTo.firstName}{" "}
                        {opportunity.assignedTo.lastName}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                    Stage
                  </p>
                  {opportunity && (
                    <StatusBadge
                      tone={OPPORTUNITY_STAGE_TONE[opportunity.stage]}
                      size="md"
                      label={stageLabel(opportunity.stage)}
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                    Amount
                  </p>
                  <p className="font-semibold text-foreground">
                    <MoneyDisplay
                      value={opportunity?.amount}
                      currency={opportunity?.currency ?? "USD"}
                      align="left"
                      className="!w-auto !font-semibold"
                    />
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                    Expected Close
                  </p>
                  <p className="font-medium text-foreground">
                    <DateDisplay
                      date={opportunity?.expectedCloseDate}
                      format="short"
                    />
                  </p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                    Created
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <UserCircle2 className="w-4 h-4 text-slate-500" />
                    <DateDisplay
                      date={opportunity?.createdAt}
                      format="short"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Notes</h3>
              </div>
              <div className="rounded-lg border border-border bg-slate-50/50 dark:bg-slate-900/30 p-4 min-h-[120px]">
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {opportunity &&
                  (opportunity as OpportunityDetail & { notes?: string | null })
                    .notes ? (
                    (opportunity as OpportunityDetail & { notes?: string | null })
                      .notes
                  ) : (
                    <span className="text-muted-foreground italic">
                      No notes added yet.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="activity" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="px-1">
              <h3 className="text-sm font-semibold text-foreground">
                Activity Timeline
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {sortedActivities.length}{" "}
                {sortedActivities.length === 1 ? "entry" : "entries"} · newest
                first
              </p>
            </div>
            <PermissionGate one="crm.activities.create">
              <Button size="sm" onClick={() => setActivityModalOpen(true)}>
                <Plus className="w-4 h-4" />
                Log activity
              </Button>
            </PermissionGate>
          </div>

          <div className="space-y-3">
            {sortedActivities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
                <MessageSquare className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  No activity logged
                </h4>
                <p className="text-xs text-muted-foreground mb-4">
                  Track calls, emails, meetings, and notes about this
                  opportunity.
                </p>
                <PermissionGate one="crm.activities.create">
                  <Button size="sm" onClick={() => setActivityModalOpen(true)}>
                    <Plus className="w-4 h-4" />
                    Log first activity
                  </Button>
                </PermissionGate>
              </div>
            ) : (
              sortedActivities.map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 flex flex-col items-center">
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center border ${
                          a.type === "CALL"
                            ? "bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900/60 text-sky-600 dark:text-sky-400"
                            : a.type === "EMAIL"
                              ? "bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-900/60 text-violet-600 dark:text-violet-400"
                              : a.type === "MEETING"
                                ? "bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-900/60 text-teal-600 dark:text-teal-400"
                                : a.type === "NOTE"
                                  ? "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                                  : a.type === "TASK"
                                    ? "bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-900/60 text-violet-600 dark:text-violet-400"
                                    : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {ACTIVITY_TYPE_ICON[a.type]}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge
                              tone={ACTIVITY_TYPE_TONE[a.type]}
                              size="sm"
                              icon={ACTIVITY_TYPE_ICON[a.type]}
                              label={activityLabel(a.type)}
                            />
                            <h4 className="font-medium text-foreground truncate">
                              {a.subject}
                            </h4>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <DateDisplay
                            date={a.activityAt}
                            format="short"
                            className="text-xs text-slate-500"
                          />
                          {a.user && (
                            <div className="flex items-center gap-1.5">
                              <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center text-[10px] font-semibold">
                                {activityInitials(a)}
                              </div>
                              <span className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[12ch]">
                                {a.user.firstName}{" "}
                                {a.user.lastName?.[0] ?? ""}.
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {a.description && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {a.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Tabs.Content>
      </Tabs.Root>

      <GlobalModal
        open={editOpen}
        onOpenChange={(o) => !o && setEditOpen(false)}
        title="Edit opportunity"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="editOpportunityDetailForm"
              disabled={updateState.isLoading || !canUpdate}
            >
              {updateState.isLoading ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      >
        <form
          id="editOpportunityDetailForm"
          onSubmit={oppForm.handleSubmit(onSubmitEdit)}
          className="space-y-4"
          noValidate
        >
          <GlobalInput
            label="Opportunity name"
            required
            error={oppForm.formState.errors.name?.message}
            {...oppForm.register("name")}
          />
          <div className="grid grid-cols-2 gap-4">
            <GlobalSelect
              label="Customer"
              value={oppForm.watch("customerId")}
              onChange={(v) =>
                oppForm.setValue("customerId", v, { shouldValidate: true })
              }
              options={customerOptions}
              placeholder="Select customer…"
              error={oppForm.formState.errors.customerId?.message as any}
            />
            <GlobalSelect
              label="Lead"
              value={oppForm.watch("leadId")}
              onChange={(v) =>
                oppForm.setValue("leadId", v, { shouldValidate: true })
              }
              options={leadOptions}
              placeholder="Select lead…"
              error={oppForm.formState.errors.leadId?.message as any}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalSelect
              label="Stage"
              required
              value={oppForm.watch("stage")}
              onChange={(v) =>
                oppForm.setValue("stage", v as any, { shouldValidate: true })
              }
              options={stageOptions}
              placeholder="Select stage…"
              error={oppForm.formState.errors.stage?.message}
            />
            <GlobalInput
              label="Amount ($)"
              inputType="number"
              error={oppForm.formState.errors.amount?.message}
              {...oppForm.register("amount")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Probability (%)"
              inputType="number"
              hint="0 - 100"
              error={oppForm.formState.errors.probabilityPercent?.message}
              {...oppForm.register("probabilityPercent")}
            />
            <GlobalDatePicker
              label="Expected close date"
              value={oppForm.watch("expectedCloseDate") ?? null}
              onChange={(v) =>
                oppForm.setValue("expectedCloseDate", v ?? undefined, {
                  shouldValidate: true,
                })
              }
              placeholder="Pick a date"
              error={oppForm.formState.errors.expectedCloseDate?.message as any}
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
              {...oppForm.register("notes")}
            />
            {oppForm.formState.errors.notes?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {oppForm.formState.errors.notes.message}
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
        open={deleteConfirmOpen}
        onOpenChange={(o) => !o && setDeleteConfirmOpen(false)}
        title="Delete opportunity"
        variant="destructive"
        description={
          opportunity
            ? `Deleting "${opportunity.name}" is permanent. All associated data including activities will be removed. This action cannot be undone.`
            : ""
        }
        confirmText={deleteState.isLoading ? "Deleting…" : "Delete opportunity"}
        loading={deleteState.isLoading}
        icon={<Trash2 className="w-5 h-5" />}
        onConfirm={handleDelete}
      />

      <GlobalModal
        open={activityModalOpen}
        onOpenChange={(o) => !o && setActivityModalOpen(false)}
        title="Log activity"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActivityModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="activityForm"
              disabled={createActivityState.isLoading}
            >
              {createActivityState.isLoading ? "Saving…" : "Save activity"}
            </Button>
          </div>
        }
      >
        <form
          id="activityForm"
          onSubmit={activityForm.handleSubmit(onSubmitCreateActivity)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <GlobalSelect
              label="Activity type"
              required
              value={activityForm.watch("type")}
              onChange={(v) =>
                activityForm.setValue("type", v as any, {
                  shouldValidate: true,
                })
              }
              options={activityTypeOptions}
              placeholder="Select type…"
              error={activityForm.formState.errors.type?.message}
            />
            <div>
              <GlobalDatePicker
                label="Date"
                value={activityForm.watch("activityAt") ?? null}
                onChange={(v) =>
                  activityForm.setValue("activityAt", v ?? undefined, {
                    shouldValidate: true,
                  })
                }
                placeholder="Pick a date"
                error={activityForm.formState.errors.activityAt?.message as any}
              />
            </div>
          </div>
          <GlobalInput
            label="Subject"
            required
            error={activityForm.formState.errors.subject?.message}
            {...activityForm.register("subject")}
          />
          <div>
            <label className="block text-sm font-medium text-foreground">
              Description / Notes
            </label>
            <textarea
              className="mt-1.5 w-full min-h-[100px] rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Add details about this activity…"
              maxLength={5000}
              {...activityForm.register("description")}
            />
            {activityForm.formState.errors.description?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {activityForm.formState.errors.description.message}
              </p>
            )}
          </div>
          {authUser && (
            <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[10px] font-semibold">
                {`${authUser.firstName?.[0] ?? ""}${
                  authUser.lastName?.[0] ?? ""
                }`.toUpperCase() || "U"}
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  {authUser.firstName} {authUser.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  This will be logged as by you
                </p>
              </div>
            </div>
          )}
          {createActivityState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (createActivityState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to log activity."
              )}
            </div>
          )}
        </form>
      </GlobalModal>
    </div>
  );
}
