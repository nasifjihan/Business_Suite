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
  Star,
  UserPlus,
  Phone,
  Mail,
  MapPin,
  Building2,
  Globe,
  Briefcase,
  Calendar,
  MessageSquare,
  Send,
  Plus,
  Users,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { GlobalTable } from "@/components/tables/GlobalTable";
import { GlobalModal } from "@/components/feedback/GlobalModal";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { GlobalInput } from "@/components/form/GlobalInput";
import { GlobalSelect } from "@/components/form/GlobalSelect";
import { GlobalDatePicker } from "@/components/form/GlobalDatePicker";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DateDisplay } from "@/components/common/DateDisplay";
import { MoneyDisplay } from "@/components/common/MoneyDisplay";
import { PermissionGate, useHasPermission } from "@/components/auth/PermissionGate";
import { createColumns, type TableFeatures } from "@/lib/table-utils";
import type { ColumnDef } from "@tanstack/react-table";
import { useAppSelector } from "@/store/hooks";
import {
  useGetCustomerQuery,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
  useCreateContactMutation,
  useUpdateContactMutation,
  useDeleteContactMutation,
  useCreateActivityMutation,
} from "@/lib/api/crmEndpoints";
import type {
  CustomerDetail,
  ContactItem,
  OpportunityItem,
  ActivityItem,
  CustomerStatus,
  LeadSource,
  OpportunityStage,
  ActivityType,
} from "@/lib/api/crmEndpoints";

const extract = <T,>(resp?: { success: true; data: { items: T[]; meta: unknown } }) =>
  resp?.data ?? { items: [] as T[], meta: undefined };

const CUSTOMER_STATUS_TONE: Record<CustomerStatus, "emerald" | "rose" | "slate"> = {
  ACTIVE: "emerald",
  INACTIVE: "slate",
  CHURNED: "rose",
};

const LEAD_SOURCE_TONE: Record<LeadSource, "sky" | "violet" | "teal" | "slate"> = {
  WEBSITE: "sky",
  REFERRAL: "violet",
  SOCIAL: "teal",
  PHONE: "slate",
  EMAIL: "sky",
  OTHER: "slate",
};

const OPPORTUNITY_STAGE_TONE: Record<
  OpportunityStage,
  "emerald" | "rose" | "slate" | "sky" | "violet" | "teal"
> = {
  PROSPECTING: "slate",
  QUALIFICATION: "sky",
  NEEDS_ANALYSIS: "violet",
  PROPOSAL: "teal",
  NEGOTIATION: "violet",
  CLOSED_WON: "emerald",
  CLOSED_LOST: "rose",
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
  CALL: <Phone className="w-4 h-4" />,
  EMAIL: <Mail className="w-4 h-4" />,
  MEETING: <Calendar className="w-4 h-4" />,
  NOTE: <MessageSquare className="w-4 h-4" />,
  TASK: <Briefcase className="w-4 h-4" />,
  PROPOSAL_SENT: <Send className="w-4 h-4" />,
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

const contactFormSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(100),
  lastName: z.string().trim().min(1, "Required").max(100),
  email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(100).optional().or(z.literal("")),
  isPrimary: z.boolean().optional(),
});
type ContactFormValues = z.infer<typeof contactFormSchema>;

const activityFormSchema = z.object({
  type: z.enum(["CALL", "EMAIL", "MEETING", "NOTE", "TASK", "PROPOSAL_SENT"] as const),
  subject: z.string().trim().min(1, "Required").max(255),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  activityAt: z.string().optional(),
});
type ActivityFormValues = z.infer<typeof activityFormSchema>;

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

const activityTypeOptions = [
  { value: "CALL", label: "Call" },
  { value: "EMAIL", label: "Email" },
  { value: "MEETING", label: "Meeting" },
  { value: "NOTE", label: "Note" },
  { value: "TASK", label: "Task" },
  { value: "PROPOSAL_SENT", label: "Proposal Sent" },
];

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const authUser = useAppSelector((s) => s.auth.user);
  const canUpdate = useHasPermission({ one: "crm.customers.update" });

  const { data: customerRes, isFetching, refetch } = useGetCustomerQuery(id, { skip: !id });
  const customerDetail: CustomerDetail | undefined = customerRes?.data as CustomerDetail | undefined;

  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [contactModal, setContactModal] = useState<
    { kind: "none" } | { kind: "create" } | { kind: "edit"; contact: ContactItem }
  >({ kind: "none" });
  const [activityModalOpen, setActivityModalOpen] = useState(false);

  const [updateCustomerTrigger, updateCustomerState] = useUpdateCustomerMutation();
  const [deleteCustomerTrigger, deleteCustomerState] = useDeleteCustomerMutation();
  const [createContactTrigger, createContactState] = useCreateContactMutation();
  const [updateContactTrigger, updateContactState] = useUpdateContactMutation();
  const [deleteContactTrigger, deleteContactState] = useDeleteContactMutation();
  const [createActivityTrigger, createActivityState] = useCreateActivityMutation();

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

  const contactForm = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      jobTitle: "",
      isPrimary: false,
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
    if (editCustomerOpen && customerDetail) {
      customerForm.reset({
        name: customerDetail.name,
        companyName: customerDetail.companyName ?? "",
        email: customerDetail.email ?? "",
        phone: customerDetail.phone ?? "",
        address: customerDetail.address ?? "",
        city: customerDetail.city ?? "",
        state: "",
        country: customerDetail.country ?? "",
        postalCode: "",
        notes: "",
        source: customerDetail.source,
        status: customerDetail.status,
      });
    }
  }, [editCustomerOpen, customerDetail, customerForm]);

  useEffect(() => {
    if (contactModal.kind === "edit") {
      contactForm.reset({
        firstName: contactModal.contact.firstName,
        lastName: contactModal.contact.lastName,
        email: contactModal.contact.email ?? "",
        phone: contactModal.contact.phone ?? "",
        jobTitle: contactModal.contact.jobTitle ?? "",
        isPrimary: contactModal.contact.isPrimary,
      });
    } else if (contactModal.kind === "create") {
      contactForm.reset({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        jobTitle: "",
        isPrimary: false,
      });
    }
  }, [contactModal, contactForm]);

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

  const onSubmitEditCustomer = async (v: CustomerFormValues) => {
    if (!id) return;
    const out = await updateCustomerTrigger({
      id,
      body: {
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
      },
    });
    if ("data" in out && out.data?.success) {
      setEditCustomerOpen(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!id) return;
    await deleteCustomerTrigger(id);
    router.push("/crm/customers");
  };

  const closeContactModal = () => setContactModal({ kind: "none" });

  const onSubmitCreateContact = async (v: ContactFormValues) => {
    if (!id) return;
    const out = await createContactTrigger({
      customerId: id,
      body: {
        firstName: v.firstName,
        lastName: v.lastName,
        email: v.email || undefined,
        phone: v.phone || undefined,
        designation: v.jobTitle || undefined,
        isPrimary: v.isPrimary,
      } as any,
    });
    if ("data" in out && out.data?.success) {
      closeContactModal();
    }
  };

  const onSubmitEditContact = async (v: ContactFormValues) => {
    if (contactModal.kind !== "edit") return;
    const out = await updateContactTrigger({
      id: contactModal.contact.id,
      body: {
        firstName: v.firstName,
        lastName: v.lastName,
        email: v.email || undefined,
        phone: v.phone || undefined,
        jobTitle: v.jobTitle || undefined,
        isPrimary: v.isPrimary,
      },
    });
    if ("data" in out && out.data?.success) {
      closeContactModal();
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
      customerId: id,
    });
    if ("data" in out && out.data?.success) {
      setActivityModalOpen(false);
      refetch();
    }
  };

  const customerInitials = (c: CustomerDetail) =>
    `${c.name?.[0] ?? ""}`.toUpperCase() || "C";

  const contactInitials = (c: ContactItem) =>
    `${c.firstName?.[0] ?? ""}${c.lastName?.[0] ?? ""}`.toUpperCase() || "C";

  const oppInitials = (o: OpportunityItem) =>
    `${o.assignedTo?.firstName?.[0] ?? ""}${o.assignedTo?.lastName?.[0] ?? ""}`.toUpperCase() || "U";

  const activityInitials = (a: ActivityItem) =>
    `${a.user?.firstName?.[0] ?? ""}${a.user?.lastName?.[0] ?? ""}`.toUpperCase() || "U";

  const sortedActivities = useMemo(() => {
    return [...(customerDetail?.activities ?? [])].sort(
      (a, b) => new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime()
    );
  }, [customerDetail?.activities]);

  const contactColumns: ColumnDef<TableFeatures, ContactItem, any>[] = useMemo(() => {
    const col = createColumns<ContactItem>();
    return [
      col.display({
        id: "isPrimary",
        header: "",
        cell: ({ row: { original: c } }) =>
          c.isPrimary ? (
            <Star className="w-4 h-4 text-violet-500 dark:text-violet-400 fill-current" />
          ) : (
            <div className="w-4 h-4" />
          ),
      }),
      col.display({
        id: "name",
        header: "Contact",
        cell: ({ row: { original: c } }) => (
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 h-8 w-8 shrink-0 flex items-center justify-center font-semibold text-xs border border-sky-200 dark:border-sky-900/60">
              {contactInitials(c)}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-foreground text-sm truncate">
                {c.firstName} {c.lastName}
              </p>
              {c.jobTitle && (
                <p className="text-xs text-muted-foreground truncate">{c.jobTitle}</p>
              )}
            </div>
          </div>
        ),
      }),
      col.display({
        id: "email",
        header: "Email",
        cell: ({ row: { original: c } }) =>
          c.email ? (
            <a
              href={`mailto:${c.email}`}
              className="text-sm text-sky-600 dark:text-sky-400 hover:underline truncate inline-block max-w-[24ch]"
            >
              {c.email}
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      }),
      col.display({
        id: "phone",
        header: "Phone",
        cell: ({ row: { original: c } }) =>
          c.phone ? (
            <a
              href={`tel:${c.phone}`}
              className="text-sm text-foreground truncate inline-block max-w-[16ch]"
            >
              {c.phone}
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      }),
      col.display({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row: { original: c } }) => (
          <div className="flex items-center justify-end gap-1">
            <PermissionGate one="crm.contacts.update">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setContactModal({ kind: "edit", contact: c })}
                className="h-8 w-8 p-0"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </PermissionGate>
            <PermissionGate one="crm.contacts.delete">
              <ConfirmDialog
                open={false}
                onOpenChange={() => {}}
                title="Delete contact"
                variant="destructive"
                description={`Delete contact "${c.firstName} ${c.lastName}"? This cannot be undone.`}
                onConfirm={async () => {
                  await deleteContactTrigger(c.id);
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (confirm(`Delete contact "${c.firstName} ${c.lastName}"?`)) {
                    await deleteContactTrigger(c.id);
                  }
                }}
                className="h-8 w-8 p-0 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </PermissionGate>
          </div>
        ),
      }),
    ];
  }, [deleteContactTrigger]);

  const opportunityColumns: ColumnDef<TableFeatures, OpportunityItem, any>[] = useMemo(() => {
    const col = createColumns<OpportunityItem>();
    return [
      col.display({
        id: "name",
        header: "Opportunity",
        cell: ({ row: { original: o } }) => (
          <div className="min-w-0">
            <p className="font-medium text-foreground text-sm truncate">{o.name}</p>
            <p className="text-xs text-muted-foreground truncate font-mono">
              {o.opportunityCode}
            </p>
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
            label={
              o.stage === "CLOSED_WON"
                ? "Closed Won"
                : o.stage === "CLOSED_LOST"
                  ? "Closed Lost"
                  : o.stage === "NEEDS_ANALYSIS"
                    ? "Needs Analysis"
                    : o.stage.charAt(0) + o.stage.slice(1).toLowerCase().replace("_", " ")
            }
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
              <div className="h-7 w-7 rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 flex items-center justify-center text-[10px] font-semibold">
                {oppInitials(o)}
              </div>
              <span className="text-xs text-foreground truncate max-w-[12ch]">
                {o.assignedTo.firstName} {o.assignedTo.lastName?.[0] ?? ""}.
              </span>
            </div>
          );
        },
      }),
    ];
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "CRM" },
          { label: "Customers", href: "/crm/customers" },
          { label: customerDetail?.name ?? "..." },
        ]}
        title={customerDetail?.name ?? "Loading…"}
        description={
          customerDetail
            ? `${customerDetail.customerCode} · Manage relationships, opportunities, and activity history`
            : "Loading customer details…"
        }
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/crm/customers">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>
            </Button>
            <PermissionGate one="crm.customers.update">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditCustomerOpen(true)}
                disabled={!canUpdate || !customerDetail}
              >
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
            </PermissionGate>
            <PermissionGate one="crm.customers.delete">
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

      <Tabs.Root defaultValue="profile" className="space-y-4">
        <Tabs.List className="flex items-center gap-1 p-1 rounded-xl border border-border bg-slate-50 dark:bg-slate-900/50 w-fit">
          <Tabs.Trigger
            value="profile"
            className="px-4 py-2 text-sm font-medium rounded-lg transition-all text-slate-600 dark:text-slate-400 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <span className="inline-flex items-center gap-2">
              <Users className="w-4 h-4" /> Profile
            </span>
          </Tabs.Trigger>
          <Tabs.Trigger
            value="opportunities"
            className="px-4 py-2 text-sm font-medium rounded-lg transition-all text-slate-600 dark:text-slate-400 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <span className="inline-flex items-center gap-2">
              <Target className="w-4 h-4" /> Opportunities
              <span className="rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 text-[10px] font-semibold">
                {customerDetail?.opportunities?.length ?? 0}
              </span>
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

        <Tabs.Content value="profile" className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="h-20 w-20 shrink-0 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg">
                {customerDetail ? customerInitials(customerDetail) : "…"}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold text-foreground truncate">
                    {customerDetail?.name ?? "…"}
                  </h2>
                  {customerDetail && (
                    <StatusBadge
                      tone={CUSTOMER_STATUS_TONE[customerDetail.status]}
                      size="md"
                      dot={customerDetail.status === "ACTIVE"}
                      label={
                        customerDetail.status.charAt(0) +
                        customerDetail.status.slice(1).toLowerCase()
                      }
                    />
                  )}
                  <span className="font-mono text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                    {customerDetail?.customerCode ?? "—"}
                  </span>
                </div>
                {customerDetail?.companyName && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" />
                    {customerDetail.companyName}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {customerDetail?.email && (
                    <a
                      href={`mailto:${customerDetail.email}`}
                      className="inline-flex items-center gap-1.5 text-sky-600 dark:text-sky-400 hover:underline"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      {customerDetail.email}
                    </a>
                  )}
                  {customerDetail?.phone && (
                    <a
                      href={`tel:${customerDetail.phone}`}
                      className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:underline"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {customerDetail.phone}
                    </a>
                  )}
                  {customerDetail?.source && (
                    <StatusBadge
                      tone={LEAD_SOURCE_TONE[customerDetail.source]}
                      size="sm"
                      label={
                        customerDetail.source === "SOCIAL"
                          ? "Social Media"
                          : customerDetail.source.charAt(0) +
                            customerDetail.source.slice(1).toLowerCase()
                      }
                    />
                  )}
                </div>
              </div>
              <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1">
                <div className="text-right">
                  <p className="text-xs text-slate-500">Total spent</p>
                  <p className="text-lg font-semibold text-foreground">
                    <MoneyDisplay
                      value={customerDetail?.totalSpent}
                      currency="USD"
                      align="left"
                      className="!w-auto !text-lg"
                    />
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Orders</p>
                  <p className="text-lg font-semibold text-foreground">
                    {customerDetail?.orderCount ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Contact Information</h3>
                <PermissionGate one="crm.customers.update">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditCustomerOpen(true)}
                    disabled={!canUpdate}
                    className="h-8 px-2.5 text-xs"
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1" />
                    Edit info
                  </Button>
                </PermissionGate>
              </div>
              <div className="space-y-3.5">
                {(customerDetail?.address ||
                  customerDetail?.city ||
                  customerDetail?.country) && (
                  <div className="flex gap-3">
                    <MapPin className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <div className="text-sm text-foreground space-y-0.5">
                      {customerDetail?.address && (
                        <p className="truncate">{customerDetail.address}</p>
                      )}
                      <p>
                        {[
                          customerDetail?.city,
                          customerDetail?.country,
                        ]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </p>
                    </div>
                  </div>
                )}
                {!customerDetail?.address &&
                  !customerDetail?.city &&
                  !customerDetail?.country &&
                  !customerDetail?.email &&
                  !customerDetail?.phone && (
                    <p className="text-sm text-muted-foreground italic">
                      No contact information added yet.
                    </p>
                  )}
              </div>
              <div className="pt-3 border-t border-border space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Created</span>
                  <DateDisplay date={customerDetail?.createdAt} format="short" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Last updated</span>
                  <DateDisplay date={customerDetail?.updatedAt} format="short" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Contacts
                  <span className="ml-2 text-xs text-slate-500 font-normal">
                    ({customerDetail?.contacts?.length ?? 0})
                  </span>
                </h3>
                <PermissionGate one="crm.contacts.create">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setContactModal({ kind: "create" })}
                    className="h-8 px-2.5 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add contact
                  </Button>
                </PermissionGate>
              </div>
              <GlobalTable<ContactItem>
                columns={contactColumns}
                data={customerDetail?.contacts ?? []}
                hidePagination
                syncUrl={false}
                getRowId={(c) => c.id}
                emptyIcon={<UserPlus className="w-8 h-8" />}
                emptyTitle="No contacts"
                emptyDescription="Add your first contact for this customer."
                emptyAction={
                  <PermissionGate one="crm.contacts.create">
                    <Button
                      size="sm"
                      onClick={() => setContactModal({ kind: "create" })}
                    >
                      <Plus className="w-4 h-4" /> Add contact
                    </Button>
                  </PermissionGate>
                }
                wrapperHeightClassName=""
              />
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="opportunities" className="space-y-4">
          <GlobalTable<OpportunityItem>
            columns={opportunityColumns}
            data={customerDetail?.opportunities ?? []}
            hidePagination
            syncUrl={false}
            getRowId={(o) => o.id}
            emptyIcon={<Target className="w-10 h-10" />}
            emptyTitle="No opportunities"
            emptyDescription="This customer has no open opportunities yet."
            wrapperHeightClassName=""
          />
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
                  Track calls, emails, meetings, and notes about this customer.
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
                              label={
                                a.type === "PROPOSAL_SENT"
                                  ? "Proposal Sent"
                                  : a.type.charAt(0) +
                                    a.type.slice(1).toLowerCase()
                              }
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
        open={editCustomerOpen}
        onOpenChange={(o) => !o && setEditCustomerOpen(false)}
        title="Edit customer"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditCustomerOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="editCustomerDetailForm"
              disabled={updateCustomerState.isLoading || !canUpdate}
            >
              {updateCustomerState.isLoading ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      >
        <form
          id="editCustomerDetailForm"
          onSubmit={customerForm.handleSubmit(onSubmitEditCustomer)}
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
              onChange={(v) =>
                customerForm.setValue("source", v as any, { shouldValidate: true })
              }
              options={customerSourceOptions}
              placeholder="Select source…"
              error={customerForm.formState.errors.source?.message}
            />
            <GlobalSelect
              label="Status"
              value={customerForm.watch("status")}
              onChange={(v) =>
                customerForm.setValue("status", v as any, { shouldValidate: true })
              }
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
          {updateCustomerState.isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {(
                (updateCustomerState.error as {
                  data?: { error?: { message?: string } };
                }).data?.error?.message ?? "Failed to update customer."
              )}
            </div>
          )}
        </form>
      </GlobalModal>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={(o) => !o && setDeleteConfirmOpen(false)}
        title="Delete customer"
        variant="destructive"
        description={
          customerDetail
            ? `Deleting "${customerDetail.name}" is permanent and will remove all associated data including contacts, opportunities, and activities. This action cannot be undone.`
            : ""
        }
        confirmText={deleteCustomerState.isLoading ? "Deleting…" : "Delete customer"}
        loading={deleteCustomerState.isLoading}
        icon={<Trash2 className="w-5 h-5" />}
        onConfirm={handleDeleteCustomer}
      />

      <GlobalModal
        open={contactModal.kind !== "none"}
        onOpenChange={(o) => !o && closeContactModal()}
        title={contactModal.kind === "create" ? "Add contact" : "Edit contact"}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeContactModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="contactForm"
              disabled={
                (contactModal.kind === "create" ? createContactState.isLoading : updateContactState.isLoading)
              }
            >
              {contactModal.kind === "create"
                ? createContactState.isLoading
                  ? "Adding…"
                  : "Add contact"
                : updateContactState.isLoading
                  ? "Saving…"
                  : "Save changes"}
            </Button>
          </div>
        }
      >
        <form
          id="contactForm"
          onSubmit={
            contactModal.kind === "create"
              ? contactForm.handleSubmit(onSubmitCreateContact)
              : contactForm.handleSubmit(onSubmitEditContact)
          }
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="First name"
              required
              error={contactForm.formState.errors.firstName?.message}
              {...contactForm.register("firstName")}
            />
            <GlobalInput
              label="Last name"
              required
              error={contactForm.formState.errors.lastName?.message}
              {...contactForm.register("lastName")}
            />
          </div>
          <GlobalInput
            label="Job title"
            error={contactForm.formState.errors.jobTitle?.message}
            {...contactForm.register("jobTitle")}
          />
          <div className="grid grid-cols-2 gap-4">
            <GlobalInput
              label="Email"
              inputType="email"
              error={contactForm.formState.errors.email?.message}
              {...contactForm.register("email")}
            />
            <GlobalInput
              label="Phone"
              error={contactForm.formState.errors.phone?.message}
              {...contactForm.register("phone")}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Primary contact</p>
              <p className="text-xs text-muted-foreground">
                Mark this as the main point of contact
              </p>
            </div>
            <Switch.Root
              checked={contactForm.watch("isPrimary")}
              onCheckedChange={(v) => contactForm.setValue("isPrimary", v)}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/70 focus:ring-offset-2 bg-slate-200 dark:bg-slate-700 data-[state=checked]:bg-primary"
            >
              <Switch.Thumb className="inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-md transition-transform data-[state=checked]:translate-x-5" />
            </Switch.Root>
          </div>
          {(createContactState.isError || updateContactState.isError) && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {((createContactState.isError
                ? (createContactState.error as any)
                : (updateContactState.error as any)
              )?.data?.error?.message) ?? "Failed to save contact."}
            </div>
          )}
        </form>
      </GlobalModal>

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
                }).data?.error?.message ?? "Failed to log activity."
              )}
            </div>
          )}
        </form>
      </GlobalModal>
    </div>
  );
}
