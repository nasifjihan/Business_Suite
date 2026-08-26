"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Target,
  HandCoins,
  FileText,
  UserPlus,
  Sparkles,
  ArrowRight,
  Phone,
  Mail,
  Calendar,
  MessageSquare,
  Briefcase,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { GlobalTable } from "@/components/tables/GlobalTable";
import { MoneyDisplay } from "@/components/common/MoneyDisplay";
import { DateDisplay } from "@/components/common/DateDisplay";
import { createColumns, type TableFeatures } from "@/lib/table-utils";
import {
  useListCustomersQuery,
  useListLeadsQuery,
  useListOpportunitiesQuery,
  useListContractsQuery,
  useListActivitiesQuery,
  useCreateLeadMutation,
  useCreateCustomerMutation,
} from "@/lib/api/crmEndpoints";
import type {
  LeadItem,
  ActivityItem,
  LeadSource,
  LeadStatus,
  ActivityType,
} from "@/lib/api/crmEndpoints";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GlobalModal } from "@/components/feedback/GlobalModal";
import { GlobalInput } from "@/components/form/GlobalInput";
import { GlobalSelect } from "@/components/form/GlobalSelect";
import { GlobalDatePicker } from "@/components/form/GlobalDatePicker";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { useState, useEffect } from "react";
import { useAppSelector } from "@/store/hooks";

const extract = <T,>(resp?: { success: true; data: { items: T[]; meta: unknown } }) =>
  resp?.data ?? { items: [] as T[], meta: undefined };

const LEAD_STATUS_TONE: Record<LeadStatus, "emerald" | "rose" | "slate" | "sky" | "violet" | "teal"> = {
  NEW: "sky",
  CONTACTED: "violet",
  QUALIFIED: "teal",
  PROPOSAL: "violet",
  WON: "emerald",
  LOST: "rose",
};

const LEAD_SOURCE_TONE: Record<LeadSource, "sky" | "violet" | "teal" | "slate"> = {
  WEBSITE: "sky",
  REFERRAL: "violet",
  SOCIAL: "teal",
  PHONE: "slate",
  EMAIL: "sky",
  OTHER: "slate",
};

const ACTIVITY_TYPE_TONE: Record<ActivityType, "emerald" | "rose" | "slate" | "sky" | "violet" | "teal"> = {
  CALL: "sky",
  EMAIL: "violet",
  MEETING: "teal",
  NOTE: "slate",
  TASK: "violet",
  PROPOSAL_SENT: "emerald",
};

const ACTIVITY_TYPE_ICON: Record<ActivityType, React.ReactNode> = {
  CALL: <Phone className="w-3 h-3" />,
  EMAIL: <Mail className="w-3 h-3" />,
  MEETING: <Calendar className="w-3 h-3" />,
  NOTE: <MessageSquare className="w-3 h-3" />,
  TASK: <Briefcase className="w-3 h-3" />,
  PROPOSAL_SENT: <Send className="w-3 h-3" />,
};

const customerFormSchema = z.object({
  name: z.string().trim().min(1, "Required").max(255),
  companyName: z.string().trim().max(255).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  country: z.string().trim().max(100).optional().or(z.literal("")),
  postalCode: z.string().trim().max(20).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  source: z.enum(["WEBSITE", "REFERRAL", "SOCIAL", "PHONE", "EMAIL", "OTHER"] as const).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "CHURNED"] as const).optional(),
});
type CustomerFormValues = z.infer<typeof customerFormSchema>;

const leadFormSchema = z.object({
  name: z.string().trim().min(1, "Required").max(255),
  companyName: z.string().trim().max(255).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  source: z.enum(["WEBSITE", "REFERRAL", "SOCIAL", "PHONE", "EMAIL", "OTHER"] as const).optional(),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"] as const).optional(),
  value: z.coerce.number().optional(),
  currency: z.string().trim().max(3).optional().or(z.literal("")),
  probability: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
type LeadFormValues = z.infer<typeof leadFormSchema>;

export default function CrmOverviewPage() {
  const authUser = useAppSelector((s) => s.auth.user);

  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);

  const [createCustomerTrigger, createCustomerState] = useCreateCustomerMutation();
  const [createLeadTrigger, createLeadState] = useCreateLeadMutation();

  const customerForm = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      companyName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
      notes: "",
      source: "OTHER",
      status: "ACTIVE",
    },
    mode: "onTouched",
  });

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
      currency: "USD",
      probability: 50,
      notes: "",
    },
    mode: "onTouched",
  });

  useEffect(() => {
    if (customerModalOpen) {
      customerForm.reset({
        name: "",
        companyName: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        country: "",
        postalCode: "",
        notes: "",
        source: "OTHER",
        status: "ACTIVE",
      });
    }
  }, [customerModalOpen, customerForm]);

  useEffect(() => {
    if (leadModalOpen) {
      leadForm.reset({
        name: "",
        companyName: "",
        email: "",
        phone: "",
        source: "OTHER",
        status: "NEW",
        value: 0,
        currency: "USD",
        probability: 50,
        notes: "",
      });
    }
  }, [leadModalOpen, leadForm]);

  const { data: customersRes } = useListCustomersQuery({ page: 1, pageSize: 1 });
  const { data: leadsRes } = useListLeadsQuery({ page: 1, pageSize: 1 });
  const { data: oppsRes } = useListOpportunitiesQuery({ page: 1, pageSize: 100 });
  const { data: contractsRes } = useListContractsQuery({ page: 1, pageSize: 1 });

  const { data: recentLeadsRes, isFetching: leadsFetching } = useListLeadsQuery({
    page: 1,
    pageSize: 10,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const { data: activitiesRes, isFetching: activitiesFetching } = useListActivitiesQuery({
    page: 1,
    pageSize: 10,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const customersMeta = extract(customersRes as any).meta as { totalItems?: number } | undefined;
  const leadsMeta = extract(leadsRes as any).meta as { totalItems?: number } | undefined;
  const contractsMeta = extract(contractsRes as any).meta as { totalItems?: number } | undefined;

  const openLeadsCount = leadsMeta?.totalItems ?? 0;
  const pipelineItems = extract(oppsRes as any).items as Array<{ stage: string; amount: string | number }>;

  const pipelineValue = useMemo(() => {
    return pipelineItems.reduce((sum: number, opp) => {
      if (opp.stage === "CLOSED_WON" || opp.stage === "CLOSED_LOST") return sum;
      const amt = typeof opp.amount === "number" ? opp.amount : parseFloat(String(opp.amount ?? "0"));
      return sum + (isFinite(amt) ? amt : 0);
    }, 0);
  }, [pipelineItems]);

  const recentLeads = extract(recentLeadsRes as any).items as LeadItem[];
  const activities = extract(activitiesRes as any).items as ActivityItem[];

  const leadInitials = (l: LeadItem) =>
    `${l.name?.[0] ?? ""}`.toUpperCase() || "L";

  const activityInitials = (a: ActivityItem) =>
    `${a.user?.firstName?.[0] ?? ""}${a.user?.lastName?.[0] ?? ""}`.toUpperCase() || "U";

  const leadSourceOptions = [
    { value: "", label: "All sources" },
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

  const customerSourceOptions = [
    { value: "WEBSITE", label: "Website" },
    { value: "REFERRAL", label: "Referral" },
    { value: "SOCIAL", label: "Social Media" },
    { value: "PHONE", label: "Phone" },
    { value: "EMAIL", label: "Email" },
    { value: "OTHER", label: "Other" },
  ];

  const customerStatusOptions = [
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" },
    { value: "CHURNED", label: "Churned" },
  ];

  const onSubmitCustomer = async (v: CustomerFormValues) => {
    const result = await createCustomerTrigger({
      ...v,
      email: v.email || undefined,
      phone: v.phone || undefined,
      companyName: v.companyName || undefined,
      address: v.address || undefined,
      city: v.city || undefined,
      state: v.state || undefined,
      country: v.country || undefined,
      postalCode: v.postalCode || undefined,
      notes: v.notes || undefined,
    }).unwrap();
    if (result?.success) {
      setCustomerModalOpen(false);
    }
  };

  const onSubmitLead = async (v: LeadFormValues) => {
    const result = await createLeadTrigger({
      ...v,
      email: v.email || undefined,
      phone: v.phone || undefined,
      companyName: v.companyName || undefined,
      notes: v.notes || undefined,
    }).unwrap();
    if (result?.success) {
      setLeadModalOpen(false);
    }
  };

  const leadColumns: ColumnDef<TableFeatures, LeadItem, any>[] = useMemo(() => {
    const col = createColumns<LeadItem>();
    return [
      col.display({
        id: "leadCode",
        header: "Code",
        cell: ({ row: { original: l } }) => (
          <span className="font-mono text-xs text-slate-600 dark:text-slate-400 truncate max-w-[8ch]">
            {l.leadCode}
          </span>
        ),
      }),
      col.display({
        id: "name",
        header: "Lead",
        cell: ({ row: { original: l } }) => (
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 h-9 w-9 shrink-0 flex items-center justify-center font-semibold text-sm border border-violet-200 dark:border-violet-900/60">
              {leadInitials(l)}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">{l.name}</p>
              {l.companyName && (
                <p className="text-xs text-muted-foreground truncate">{l.companyName}</p>
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
            label={l.status.charAt(0) + l.status.slice(1).toLowerCase().replace("_", " ")}
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
            label={l.source.charAt(0) + l.source.slice(1).toLowerCase().replace("_", " ")}
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
              <div className="h-6 w-6 rounded-full bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 flex items-center justify-center text-[10px] font-semibold">
                {`${l.assignedTo.firstName?.[0] ?? ""}${l.assignedTo.lastName?.[0] ?? ""}`.toUpperCase() || "U"}
              </div>
              <span className="text-xs text-foreground truncate max-w-[10ch]">
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
    ];
  }, []);

  const activityColumns: ColumnDef<TableFeatures, ActivityItem, any>[] = useMemo(() => {
    const col = createColumns<ActivityItem>();
    return [
      col.accessor("activityAt" as any, {
        id: "activityAt",
        header: "Date",
        enableSorting: true,
        cell: ({ row: { original: a } }) => (
          <DateDisplay date={a.activityAt} format="short" />
        ),
      }),
      col.display({
        id: "type",
        header: "Type",
        cell: ({ row: { original: a } }) => (
          <StatusBadge
            tone={ACTIVITY_TYPE_TONE[a.type]}
            size="md"
            icon={ACTIVITY_TYPE_ICON[a.type]}
            label={a.type.charAt(0) + a.type.slice(1).toLowerCase().replace("_", " ")}
          />
        ),
      }),
      col.display({
        id: "subject",
        header: "Subject",
        cell: ({ row: { original: a } }) => (
          <p className="text-sm text-foreground truncate max-w-[24ch]">{a.subject}</p>
        ),
      }),
      col.display({
        id: "user",
        header: "By",
        cell: ({ row: { original: a } }) => (
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[10px] font-semibold">
              {activityInitials(a)}
            </div>
            <span className="text-xs text-foreground truncate max-w-[12ch]">
              {a.user ? `${a.user.firstName} ${a.user.lastName?.[0] ?? ""}.` : "—"}
            </span>
          </div>
        ),
      }),
      col.display({
        id: "entity",
        header: "Entity",
        cell: ({ row: { original: a } }) => {
          if (a.customerId) {
            return (
              <Link
                href={`/crm/customers/${a.customerId}`}
                className="text-xs text-sky-600 dark:text-sky-400 hover:underline truncate inline-block max-w-[12ch]"
              >
                Customer →
              </Link>
            );
          }
          if (a.opportunityId) {
            return (
              <span className="text-xs text-violet-600 dark:text-violet-400 truncate max-w-[12ch]">
                Opportunity
              </span>
            );
          }
          if (a.leadId) {
            return (
              <span className="text-xs text-teal-600 dark:text-teal-400 truncate max-w-[12ch]">
                Lead
              </span>
            );
          }
          return <span className="text-xs text-muted-foreground">—</span>;
        },
      }),
    ];
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "CRM" }]}
        title="CRM Overview"
        description="Track customers, leads, opportunities, and activities in one place."
        action={
          <div className="flex items-center gap-2">
            <PermissionGate one="crm.customers.create">
              <Button variant="outline" size="sm" onClick={() => setCustomerModalOpen(true)}>
                <UserPlus className="w-4 h-4" />
                Create Customer
              </Button>
            </PermissionGate>
            <PermissionGate one="crm.leads.create">
              <Button size="sm" onClick={() => setLeadModalOpen(true)}>
                <Sparkles className="w-4 h-4" />
                Create Lead
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Customers</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {customersMeta?.totalItems ?? "—"}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-900/60">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <Link
            href="/crm/customers"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700"
          >
            View customers <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Open Leads</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {openLeadsCount ?? "—"}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-200 dark:border-sky-900/60">
              <Target className="w-5 h-5" />
            </div>
          </div>
          <Link
            href="/crm/leads"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700"
          >
            View leads <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pipeline Value</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                <MoneyDisplay value={pipelineValue} currency="USD" align="left" className="!w-auto !text-3xl" />
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-200 dark:border-violet-900/60">
              <HandCoins className="w-5 h-5" />
            </div>
          </div>
          <Link
            href="/crm/opportunities"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700"
          >
            View opportunities <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Active Contracts</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {contractsMeta?.totalItems ?? "—"}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-200 dark:border-teal-900/60">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <Link
            href="/crm/contracts"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700"
          >
            View contracts <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-semibold text-foreground">Recent Leads</h2>
            <Link
              href="/crm/leads"
              className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
            >
              All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <GlobalTable<LeadItem>
            columns={leadColumns}
            data={recentLeads}
            hidePagination
            syncUrl={false}
            defaultSortBy="createdAt"
            defaultSortOrder="desc"
            emptyIcon={<Target className="w-10 h-10" />}
            emptyTitle="No leads yet"
            emptyDescription="Create your first lead to start tracking opportunities."
            queryResult={{
              data: recentLeadsRes?.data as any,
              isFetching: leadsFetching,
            }}
            getRowId={(l) => l.id}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-semibold text-foreground">Recent Activities</h2>
            <span className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1">
              Timeline
            </span>
          </div>
          <GlobalTable<ActivityItem>
            columns={activityColumns}
            data={activities}
            hidePagination
            syncUrl={false}
            defaultSortBy="createdAt"
            defaultSortOrder="desc"
            emptyIcon={<MessageSquare className="w-10 h-10" />}
            emptyTitle="No activities yet"
            emptyDescription="Team activities will appear here as they are logged."
            queryResult={{
              data: activitiesRes?.data as any,
              isFetching: activitiesFetching,
            }}
            getRowId={(a) => a.id}
          />
        </div>
      </div>

      <GlobalModal
        open={customerModalOpen}
        onOpenChange={(o) => !o && setCustomerModalOpen(false)}
        title="Create new customer"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCustomerModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-customer-form"
              disabled={createCustomerState.isLoading}
            >
              {createCustomerState.isLoading ? "Creating…" : "Create customer"}
            </Button>
          </div>
        }
      >
        <form
          id="create-customer-form"
          onSubmit={customerForm.handleSubmit(onSubmitCustomer)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Name"
              required
              error={customerForm.formState.errors.name?.message}
              {...customerForm.register("name")}
            />
            <GlobalInput
              label="Company name"
              error={customerForm.formState.errors.companyName?.message}
              {...customerForm.register("companyName")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Email"
              inputType="email"
              error={customerForm.formState.errors.email?.message}
              {...customerForm.register("email")}
            />
            <GlobalInput
              label="Phone"
              error={customerForm.formState.errors.phone?.message}
              {...customerForm.register("phone")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <GlobalSelect
              label="Source"
              value={customerForm.watch("source")}
              onChange={(v) => customerForm.setValue("source", v as any, { shouldValidate: true })}
              options={customerSourceOptions}
              placeholder="Select source…"
              error={customerForm.formState.errors.source?.message}
            />
            <GlobalSelect
              label="Status"
              value={customerForm.watch("status")}
              onChange={(v) => customerForm.setValue("status", v as any, { shouldValidate: true })}
              options={customerStatusOptions}
              placeholder="Select status…"
              error={customerForm.formState.errors.status?.message}
            />
          </div>
          <GlobalInput
            label="Address"
            error={customerForm.formState.errors.address?.message}
            {...customerForm.register("address")}
          />
          <div className="grid grid-cols-3 gap-4">
            <GlobalInput
              label="City"
              error={customerForm.formState.errors.city?.message}
              {...customerForm.register("city")}
            />
            <GlobalInput
              label="State / Region"
              error={customerForm.formState.errors.state?.message}
              {...customerForm.register("state")}
            />
            <GlobalInput
              label="Postal code"
              error={customerForm.formState.errors.postalCode?.message}
              {...customerForm.register("postalCode")}
            />
          </div>
          <GlobalInput
            label="Country"
            error={customerForm.formState.errors.country?.message}
            {...customerForm.register("country")}
          />
          <div>
            <label className="block text-sm font-medium text-foreground">Notes</label>
            <textarea
              className="mt-1.5 w-full min-h-[80px] rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              placeholder="Any additional notes about this customer…"
              maxLength={2000}
              {...customerForm.register("notes")}
            />
            {customerForm.formState.errors.notes?.message && (
              <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                {customerForm.formState.errors.notes.message}
              </p>
            )}
          </div>
          {createCustomerState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (createCustomerState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to create customer."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <GlobalModal
        open={leadModalOpen}
        onOpenChange={(o) => !o && setLeadModalOpen(false)}
        title="Create new lead"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setLeadModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-lead-form"
              disabled={createLeadState.isLoading}
            >
              {createLeadState.isLoading ? "Creating…" : "Create lead"}
            </Button>
          </div>
        }
      >
        <form
          id="create-lead-form"
          onSubmit={leadForm.handleSubmit(onSubmitLead)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Lead name"
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
              options={customerSourceOptions}
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
          <div className="grid grid-cols-3 gap-4">
            <GlobalInput
              label="Estimated value"
              inputType="number"
              error={leadForm.formState.errors.value?.message}
              {...leadForm.register("value")}
            />
            <GlobalInput
              label="Currency"
              error={leadForm.formState.errors.currency?.message}
              {...leadForm.register("currency")}
            />
            <GlobalInput
              label="Probability %"
              inputType="number"
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
          {createLeadState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (createLeadState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to create lead."
              )}
            </div>
          )}
        </form>
      </GlobalModal>
    </div>
  );
}
