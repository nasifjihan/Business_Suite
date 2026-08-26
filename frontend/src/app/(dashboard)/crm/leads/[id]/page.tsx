"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as Tabs from "@radix-ui/react-tabs";
import * as Switch from "@radix-ui/react-switch";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Building2,
  Calendar,
  MessageSquare,
  Send,
  Plus,
  Briefcase,
  ArrowRightLeft,
  CheckCircle2,
  ArrowRight,
  Target,
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
import {
  useGetLeadQuery,
  useUpdateLeadMutation,
  useDeleteLeadMutation,
  useConvertLeadMutation,
  useCreateActivityMutation,
} from "@/lib/api/crmEndpoints";
import type {
  LeadDetail,
  LeadStatus,
  LeadSource,
  ActivityItem,
  ActivityType,
  CreateLeadRequest,
  ConvertLeadRequest,
  ConvertLeadResponse,
  CreateActivityRequest,
} from "@/lib/api/crmEndpoints";

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

const statusLabel = (s: LeadStatus) =>
  s === "CONTACTED" ? "Contacted" :
  s === "QUALIFIED" ? "Qualified" :
  s === "PROPOSAL" ? "Proposal" :
  s.charAt(0) + s.slice(1).toLowerCase();

const sourceLabel = (s: LeadSource) =>
  s === "SOCIAL" ? "Social Media" :
  s.charAt(0) + s.slice(1).toLowerCase();

const activityLabel = (t: ActivityType) =>
  t === "PROPOSAL_SENT" ? "Proposal Sent" :
  t.charAt(0) + t.slice(1).toLowerCase();

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

const activityFormSchema = z.object({
  type: z.enum(["CALL", "EMAIL", "MEETING", "NOTE", "TASK", "PROPOSAL_SENT"] as const),
  subject: z.string().trim().min(1, "Required").max(255),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  activityAt: z.string().optional(),
});
type ActivityFormValues = z.infer<typeof activityFormSchema>;

const leadSourceOptions = [
  { value: "WEBSITE", label: "Website" },
  { value: "REFERRAL", label: "Referral" },
  { value: "SOCIAL", label: "Social Media" },
  { value: "PHONE", label: "Phone" },
  { value: "EMAIL", label: "Email" },
  { value: "OTHER", label: "Other" },
];

const leadStatusOptions = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "PROPOSAL", label: "Proposal" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
];

const activityTypeOptions = [
  { value: "CALL", label: "Call" },
  { value: "EMAIL", label: "Email" },
  { value: "MEETING", label: "Meeting" },
  { value: "NOTE", label: "Note" },
  { value: "TASK", label: "Task" },
  { value: "PROPOSAL_SENT", label: "Proposal Sent" },
];

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const authUser = useAppSelector((s) => s.auth.user);
  const canUpdate = useHasPermission({ one: "crm.leads.update" });
  const canDelete = useHasPermission({ one: "crm.leads.delete" });

  const { data: leadRes, isFetching, refetch } = useGetLeadQuery(id, { skip: !id });
  const leadDetail: LeadDetail | undefined = leadRes?.data as LeadDetail | undefined;

  const [editLeadOpen, setEditLeadOpen] = useState(false);
  const [convertLeadOpen, setConvertLeadOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);

  const [updateLeadTrigger, updateLeadState] = useUpdateLeadMutation();
  const [deleteLeadTrigger, deleteLeadState] = useDeleteLeadMutation();
  const [convertLeadTrigger, convertLeadState] = useConvertLeadMutation();
  const [createActivityTrigger, createActivityState] = useCreateActivityMutation();

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
    if (editLeadOpen && leadDetail) {
      leadForm.reset({
        name: leadDetail.name,
        companyName: leadDetail.companyName ?? "",
        email: leadDetail.email ?? "",
        phone: leadDetail.phone ?? "",
        source: leadDetail.source,
        status: leadDetail.status,
        value: typeof leadDetail.value === "string" ? parseFloat(leadDetail.value) : leadDetail.value,
        probability: leadDetail.probability,
        assignedToId: leadDetail.assignedToId ?? "",
        notes: "",
      });
    }
  }, [editLeadOpen, leadDetail, leadForm]);

  useEffect(() => {
    if (convertLeadOpen && leadDetail) {
      const defaultOppName = `Opportunity: ${leadDetail.name}`;
      convertForm.reset({
        customerName: leadDetail.name,
        createOpportunity: true,
        opportunityName: defaultOppName,
        opportunityAmount: typeof leadDetail.value === "string" ? parseFloat(leadDetail.value) : (leadDetail.value ?? 0),
        expectedCloseDate: "",
        assignedToId: leadDetail.assignedToId ?? "",
      });
    }
  }, [convertLeadOpen, leadDetail, convertForm]);

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

  const onSubmitEditLead = async (v: LeadFormValues) => {
    if (!id) return;
    const body: CreateLeadRequest & { status?: LeadStatus; assignedToId?: string | null } = {
      ...v,
      email: v.email || undefined,
      phone: v.phone || undefined,
      companyName: v.companyName || undefined,
      notes: v.notes || undefined,
      assignedToId: v.assignedToId || undefined,
      value: v.value,
      probability: v.probability,
    };
    const out = await updateLeadTrigger({ id, body });
    if ("data" in out && out.data?.success) {
      setEditLeadOpen(false);
      refetch();
    }
  };

  const handleDeleteLead = async () => {
    if (!id) return;
    await deleteLeadTrigger(id);
    router.push("/crm/leads");
  };

  const onSubmitConvertLead = async (v: ConvertLeadValues) => {
    if (!id) return;
    const body: ConvertLeadRequest = {
      customerName: v.customerName,
      createOpportunity: v.createOpportunity,
      opportunityName: v.createOpportunity ? (v.opportunityName || undefined) : undefined,
      opportunityAmount: v.createOpportunity ? v.opportunityAmount : undefined,
      expectedCloseDate: v.createOpportunity ? (v.expectedCloseDate || undefined) : undefined,
      assignedToId: v.assignedToId || undefined,
    };
    const out = await convertLeadTrigger({ id, body });
    if ("data" in out && out.data?.success) {
      const resp = out.data.data as unknown as ConvertLeadResponse;
      const newCustomerId = resp.customer?.id;
      if (newCustomerId) {
        router.push(`/crm/customers/${newCustomerId}`);
      } else {
        setConvertLeadOpen(false);
        refetch();
      }
    }
  };

  const onSubmitCreateActivity = async (v: ActivityFormValues) => {
    if (!id || !authUser) return;
    const body: CreateActivityRequest = {
      type: v.type,
      subject: v.subject,
      description: v.description || undefined,
      activityAt: v.activityAt,
      userId: authUser.id,
      leadId: id,
    };
    const out = await createActivityTrigger(body);
    if ("data" in out && out.data?.success) {
      setActivityModalOpen(false);
      refetch();
    }
  };

  const canConvert = leadDetail ? (leadDetail.status !== "WON" && leadDetail.status !== "LOST") : false;

  const sortedActivities = useMemo(() => {
    return [...(leadDetail?.unifiedActivities ?? [])].sort(
      (a, b) => new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime()
    );
  }, [leadDetail?.unifiedActivities]);

  const leadInitials = `${leadDetail?.name?.[0] ?? ""}`.toUpperCase() || "L";
  const ownerInitials = `${leadDetail?.assignedTo?.firstName?.[0] ?? ""}${leadDetail?.assignedTo?.lastName?.[0] ?? ""}`.toUpperCase() || "U";
  const activityUserInitials = (a: ActivityItem) =>
    `${a.user?.firstName?.[0] ?? ""}${a.user?.lastName?.[0] ?? ""}`.toUpperCase() || "U";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "CRM" },
          { label: "Leads", href: "/crm/leads" },
          { label: leadDetail?.name ?? "..." },
        ]}
        title={leadDetail?.name ?? "Loading…"}
        description={
          leadDetail
            ? `${leadDetail.leadCode} · Track pipeline progress, log activities, and convert to customer`
            : "Loading lead details…"
        }
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/crm/leads">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>
            </Button>
            <PermissionGate one="crm.leads.update">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditLeadOpen(true)}
                disabled={!canUpdate || !leadDetail}
              >
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
              {canConvert && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConvertLeadOpen(true)}
                  disabled={!canUpdate}
                  className="text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  Convert Lead
                </Button>
              )}
            </PermissionGate>
            <PermissionGate one="crm.leads.delete">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={!canDelete}
                className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Lead Status</p>
            <div className="pt-1">
              {leadDetail && (
                <StatusBadge
                  tone={LEAD_STATUS_TONE[leadDetail.status]}
                  size="lg"
                  dot={leadDetail.status === "QUALIFIED" || leadDetail.status === "WON"}
                  label={statusLabel(leadDetail.status)}
                />
              )}
            </div>
            <div className="pt-2 flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-mono">{leadDetail?.leadCode ?? "—"}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">Assigned To</p>
          {leadDetail?.assignedTo ? (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center text-sm font-semibold border border-slate-200 dark:border-slate-700">
                {ownerInitials}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm text-foreground truncate">
                  {leadDetail.assignedTo.firstName} {leadDetail.assignedTo.lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {leadDetail.assignedTo.email}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic py-2">Unassigned</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">Value &amp; Probability</p>
          <div className="space-y-2 pt-0.5">
            <div>
              <MoneyDisplay
                value={leadDetail?.value}
                currency={leadDetail?.currency ?? "USD"}
                align="left"
                className="!w-auto text-xl font-bold"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-violet-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, leadDetail?.probability ?? 0))}%` }}
                />
              </div>
              <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-300 min-w-[3ch] text-right">
                {leadDetail?.probability ?? 0}%
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Target className="w-3 h-3" />
              Weighted:{" "}
              <MoneyDisplay
                value={
                  leadDetail
                    ? (typeof leadDetail.value === "string" ? parseFloat(leadDetail.value) : leadDetail.value ?? 0) *
                      (leadDetail.probability / 100)
                    : 0
                }
                currency={leadDetail?.currency ?? "USD"}
                align="left"
                className="!w-auto !text-xs font-medium"
              />
            </div>
          </div>
        </div>
      </div>

      <Tabs.Root defaultValue="info" className="space-y-4">
        <Tabs.List className="flex items-center gap-1 p-1 rounded-xl border border-border bg-slate-50 dark:bg-slate-900/50 w-fit">
          <Tabs.Trigger
            value="info"
            className="px-4 py-2 text-sm font-medium rounded-lg transition-all text-slate-600 dark:text-slate-400 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <span className="inline-flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Info
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

        <Tabs.Content value="info" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Lead Information</h3>
                <PermissionGate one="crm.leads.update">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditLeadOpen(true)}
                    disabled={!canUpdate}
                    className="h-8 px-2.5 text-xs"
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1" />
                    Edit info
                  </Button>
                </PermissionGate>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
                <div className="space-y-0.5">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Name</p>
                  <p className="text-sm font-medium text-foreground">{leadDetail?.name ?? "—"}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Company</p>
                  <p className="text-sm text-foreground">{leadDetail?.companyName ?? "—"}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Email</p>
                  {leadDetail?.email ? (
                    <a
                      href={`mailto:${leadDetail.email}`}
                      className="text-sm text-sky-600 dark:text-sky-400 hover:underline"
                    >
                      {leadDetail.email}
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
                <div className="space-y-0.5">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Phone</p>
                  {leadDetail?.phone ? (
                    <a
                      href={`tel:${leadDetail.phone}`}
                      className="text-sm text-foreground hover:underline"
                    >
                      {leadDetail.phone}
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
                <div className="space-y-0.5">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Source</p>
                  <div className="pt-0.5">
                    {leadDetail && (
                      <StatusBadge
                        tone={LEAD_SOURCE_TONE[leadDetail.source]}
                        size="sm"
                        label={sourceLabel(leadDetail.source)}
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Status</p>
                  <div className="pt-0.5">
                    {leadDetail && (
                      <StatusBadge
                        tone={LEAD_STATUS_TONE[leadDetail.status]}
                        size="sm"
                        label={statusLabel(leadDetail.status)}
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-0.5 sm:col-span-2">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Created</p>
                  <p className="text-sm text-foreground flex items-center gap-2 pt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <DateDisplay date={leadDetail?.createdAt} format="medium" />
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Pipeline Summary</h3>
              <div className="min-h-[120px] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Estimated value</span>
                  <MoneyDisplay
                    value={leadDetail?.value}
                    currency={leadDetail?.currency ?? "USD"}
                    align="left"
                    className="!w-auto font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Win probability</span>
                    <span className="text-sm font-semibold tabular-nums">{leadDetail?.probability ?? 0}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-violet-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, leadDetail?.probability ?? 0))}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <span className="text-sm text-slate-500 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" /> Weighted value
                  </span>
                  <MoneyDisplay
                    value={
                      leadDetail
                        ? (typeof leadDetail.value === "string" ? parseFloat(leadDetail.value) : leadDetail.value ?? 0) *
                          (leadDetail.probability / 100)
                        : 0
                    }
                    currency={leadDetail?.currency ?? "USD"}
                    align="left"
                    className="!w-auto !text-sm font-medium"
                  />
                </div>
              </div>
              <div className="pt-3 border-t border-border space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Last updated</span>
                  <DateDisplay date={leadDetail?.updatedAt} format="short" />
                </div>
                {leadDetail?.wonLostAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">
                      {leadDetail.status === "WON" ? "Won at" : "Lost at"}
                    </span>
                    <DateDisplay date={leadDetail.wonLostAt} format="short" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="activity" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="px-1">
              <h3 className="text-sm font-semibold text-foreground">Activity Timeline</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {sortedActivities.length} {sortedActivities.length === 1 ? "entry" : "entries"} · newest first
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
                  Track calls, emails, meetings, and notes about this lead.
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
                                {activityUserInitials(a)}
                              </div>
                              <span className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[12ch]">
                                {a.user.firstName} {a.user.lastName?.[0] ?? ""}.
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
        open={editLeadOpen}
        onOpenChange={(o) => !o && setEditLeadOpen(false)}
        title="Edit lead"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditLeadOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="editLeadDetailForm"
              disabled={updateLeadState.isLoading || !canUpdate}
            >
              {updateLeadState.isLoading ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      >
        <form
          id="editLeadDetailForm"
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
          {updateLeadState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (updateLeadState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to update lead."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <GlobalModal
        open={convertLeadOpen}
        onOpenChange={(o) => !o && setConvertLeadOpen(false)}
        title="Convert Lead to Customer + Opportunity"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConvertLeadOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="convertLeadDetailForm"
              disabled={convertLeadState.isLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {convertLeadState.isLoading ? "Converting…" : "Convert lead"}
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
          id="convertLeadDetailForm"
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
          {convertLeadState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (convertLeadState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to convert lead."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={(o) => !o && setDeleteConfirmOpen(false)}
        title="Delete lead"
        variant="destructive"
        description={
          leadDetail
            ? `Deleting "${leadDetail.name}" is permanent. All associated data including activities will be removed. This action cannot be undone.`
            : ""
        }
        confirmText={deleteLeadState.isLoading ? "Deleting…" : "Delete lead"}
        loading={deleteLeadState.isLoading}
        icon={<Trash2 className="w-5 h-5" />}
        onConfirm={handleDeleteLead}
      />

      <GlobalModal
        open={activityModalOpen}
        onOpenChange={(o) => !o && setActivityModalOpen(false)}
        title="Log activity"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setActivityModalOpen(false)}>
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
                activityForm.setValue("type", v as any, { shouldValidate: true })
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
                  activityForm.setValue("activityAt", v ?? undefined, { shouldValidate: true })
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
            <label className="block text-sm font-medium text-foreground">Description / Notes</label>
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
                {`${authUser.firstName?.[0] ?? ""}${authUser.lastName?.[0] ?? ""}`.toUpperCase() || "U"}
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  {authUser.firstName} {authUser.lastName}
                </p>
                <p className="text-xs text-muted-foreground">This will be logged as by you</p>
              </div>
            </div>
          )}
          {createActivityState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (createActivityState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to save activity."
              )}
            </div>
          )}
        </form>
      </GlobalModal>
    </div>
  );
}
