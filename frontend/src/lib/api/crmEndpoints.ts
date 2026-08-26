import { apiSlice } from "./apiSlice";

type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

type Envelope<T> = { success: true; data: T; message?: string };

export type CustomerStatus = "ACTIVE" | "INACTIVE" | "CHURNED";
export type LeadSource = "WEBSITE" | "REFERRAL" | "SOCIAL" | "PHONE" | "EMAIL" | "OTHER";
export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL" | "WON" | "LOST";
export type OpportunityStage =
  | "PROSPECTING"
  | "QUALIFICATION"
  | "NEEDS_ANALYSIS"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "CLOSED_WON"
  | "CLOSED_LOST";
export type ContractStatus = "DRAFT" | "SIGNED" | "ACTIVE" | "EXPIRED" | "TERMINATED";
export type ActivityType = "CALL" | "EMAIL" | "MEETING" | "NOTE" | "TASK" | "PROPOSAL_SENT";

// ──────────────────────────────────────────────────────────────────────────────
// Customers
// ──────────────────────────────────────────────────────────────────────────────
export type CustomerItem = {
  id: string;
  customerCode: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  status: CustomerStatus;
  source: LeadSource;
  totalSpent: number | string;
  orderCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerDetail = CustomerItem & {
  contacts: ContactItem[];
  opportunities: OpportunityItem[];
  activities?: ActivityItem[];
};

export type ContactItem = {
  id: string;
  customerId: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  notes: string | null;
  createdAt: string;
};

export type ListCustomersArgs = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: CustomerStatus;
  source?: LeadSource;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export type ListCustomersResponse = { items: CustomerItem[]; meta: PaginationMeta };

export type CreateCustomerRequest = {
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  notes?: string;
  source?: LeadSource;
  status?: CustomerStatus;
};

export type UpdateCustomerRequest = Partial<CreateCustomerRequest> & {
  status?: CustomerStatus;
};

// ──────────────────────────────────────────────────────────────────────────────
// Leads
// ──────────────────────────────────────────────────────────────────────────────
export type LeadItem = {
  id: string;
  leadCode: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  status: LeadStatus;
  value: number | string;
  currency: string;
  probability: number;
  assignedToId: string | null;
  assignedTo?: { id: string; firstName: string; lastName: string; email: string } | null;
  wonLostAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadDetail = LeadItem & {
  unifiedActivities?: ActivityItem[];
};

export type ListLeadsArgs = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: LeadStatus;
  source?: LeadSource;
  assignedToId?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export type ListLeadsResponse = { items: LeadItem[]; meta: PaginationMeta };

export type CreateLeadRequest = {
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  source?: LeadSource;
  status?: LeadStatus;
  value?: number;
  currency?: string;
  probability?: number;
  assignedToId?: string;
  notes?: string;
};
export type UpdateLeadRequest = Partial<CreateLeadRequest> & {
  status?: LeadStatus;
  assignedToId?: string | null;
};

export type ConvertLeadRequest = {
  customerName: string;
  createOpportunity?: boolean;
  opportunityName?: string;
  opportunityAmount?: number;
  expectedCloseDate?: string;
  assignedToId?: string;
};
export type ConvertLeadResponse = {
  customer: CustomerItem;
  opportunity?: OpportunityItem | null;
  lead: LeadItem;
};

// ──────────────────────────────────────────────────────────────────────────────
// Opportunities
// ──────────────────────────────────────────────────────────────────────────────
export type OpportunityItem = {
  id: string;
  opportunityCode: string;
  name: string;
  customerId: string | null;
  customer?: { id: string; name: string; customerCode: string } | null;
  leadId: string | null;
  lead?: { id: string; leadCode: string; name: string } | null;
  stage: OpportunityStage;
  amount: number | string;
  currency: string;
  probabilityPercent: number | null;
  expectedCloseDate: string | null;
  assignedToId: string | null;
  assignedTo?: { id: string; firstName: string; lastName: string; email: string } | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OpportunityDetail = OpportunityItem & {
  activities?: ActivityItem[];
};

export type ListOppsArgs = {
  page?: number;
  pageSize?: number;
  search?: string;
  stage?: OpportunityStage;
  customerId?: string;
  leadId?: string;
  assignedToId?: string;
  expectedCloseDateFrom?: string;
  expectedCloseDateTo?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};
export type ListOppsResponse = { items: OpportunityItem[]; meta: PaginationMeta };

export type CreateOpportunityRequest = {
  name: string;
  customerId?: string;
  leadId?: string;
  stage?: OpportunityStage;
  amount?: number;
  currency?: string;
  probabilityPercent?: number;
  expectedCloseDate?: string;
  assignedToId?: string;
  notes?: string;
};
export type UpdateOpportunityRequest = Partial<CreateOpportunityRequest> & {
  stage?: OpportunityStage;
};
export type PatchOppStageRequest = { stage: OpportunityStage; note?: string };

// ──────────────────────────────────────────────────────────────────────────────
// Activities (append-only — read + create)
// ──────────────────────────────────────────────────────────────────────────────
export type ActivityItem = {
  id: string;
  type: ActivityType;
  subject: string;
  description: string | null;
  activityAt: string;
  outcome: string | null;
  userId: string;
  user?: { id: string; firstName: string; lastName: string; email: string } | null;
  leadId: string | null;
  customerId: string | null;
  opportunityId: string | null;
  createdAt: string;
};

export type ListActivitiesArgs = {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: ActivityType;
  userId?: string;
  leadId?: string;
  customerId?: string;
  opportunityId?: string;
  since?: string;
  until?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};
export type ListActivitiesResponse = { items: ActivityItem[]; meta: PaginationMeta };

export type CreateActivityRequest = {
  type: ActivityType;
  subject: string;
  description?: string;
  activityAt?: string;
  outcome?: string;
  userId: string;
  leadId?: string;
  customerId?: string;
  opportunityId?: string;
};

// ──────────────────────────────────────────────────────────────────────────────
// Contracts
// ──────────────────────────────────────────────────────────────────────────────
export type ContractItem = {
  id: string;
  contractCode: string;
  customerId: string;
  customer?: { id: string; name: string; customerCode: string };
  title: string;
  status: ContractStatus;
  startDate: string;
  endDate: string;
  value: number | string;
  signedAt: string | null;
  signedById: string | null;
  notes: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListContractsArgs = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ContractStatus;
  customerId?: string;
  signedById?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};
export type ListContractsResponse = { items: ContractItem[]; meta: PaginationMeta };
export type CreateContractRequest = {
  title: string;
  customerId: string;
  status?: ContractStatus;
  startDate: string;
  endDate: string;
  value?: number;
  signedAt?: string;
  signedById?: string;
  notes?: string;
};
export type UpdateContractRequest = Partial<CreateContractRequest> & {
  status?: ContractStatus;
};

// ──────────────────────────────────────────────────────────────────────────────
// Module RTK endpoints — cache tags added per module in apiSlice.tagTypes
// ──────────────────────────────────────────────────────────────────────────────
export const crmApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Customers
    listCustomers: builder.query<Envelope<ListCustomersResponse>, ListCustomersArgs | void>({
      query: (args) => ({ url: "/crm/customers", params: args ?? {} }),
      providesTags: ["Customers"],
    }),
    getCustomer: builder.query<Envelope<CustomerDetail>, string>({
      query: (id) => ({ url: `/crm/customers/${id}` }),
      providesTags: (_, __, id) => [{ type: "Customers", id }],
    }),
    createCustomer: builder.mutation<Envelope<{ customer: CustomerItem }>, CreateCustomerRequest>({
      query: (body) => ({ url: "/crm/customers", method: "POST", body }),
      invalidatesTags: ["Customers"],
    }),
    updateCustomer: builder.mutation<Envelope<CustomerItem>, { id: string; body: UpdateCustomerRequest }>({
      query: ({ id, body }) => ({ url: `/crm/customers/${id}`, method: "PATCH", body }),
      invalidatesTags: (_, __, { id }) => ["Customers", { type: "Customers", id }],
    }),
    deleteCustomer: builder.mutation<Envelope<{ ok: true }>, string>({
      query: (id) => ({ url: `/crm/customers/${id}`, method: "DELETE" }),
      invalidatesTags: ["Customers"],
    }),

    // Contacts
    listContacts: builder.query<Envelope<{ items: ContactItem[]; meta: PaginationMeta }>, {
      customerId: string;
      page?: number;
      pageSize?: number;
      search?: string;
    }>({
      query: ({ customerId, ...args }) => ({
        url: `/crm/customers/${customerId}/contacts`,
        params: args,
      }),
      providesTags: ["Contacts"],
    }),
    createContact: builder.mutation<Envelope<ContactItem>, { customerId: string; body: Omit<CreateCustomerRequest, never> & {
      firstName: string; lastName: string; email?: string; phone?: string;
      designation?: string; department?: string; isPrimary?: boolean; notes?: string;
    } }>({
      query: ({ customerId, body }) => ({
        url: `/crm/customers/${customerId}/contacts`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Contacts"],
    }),
    updateContact: builder.mutation<Envelope<ContactItem>, {
      id: string;
      body: Partial<ContactItem> & { firstName?: string; lastName?: string; isPrimary?: boolean };
    }>({
      query: ({ id, body }) => ({ url: `/crm/contacts/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Contacts"],
    }),
    deleteContact: builder.mutation<Envelope<{ ok: true }>, string>({
      query: (id) => ({ url: `/crm/contacts/${id}`, method: "DELETE" }),
      invalidatesTags: ["Contacts"],
    }),

    // Leads
    listLeads: builder.query<Envelope<ListLeadsResponse>, ListLeadsArgs | void>({
      query: (args) => ({ url: "/crm/leads", params: args ?? {} }),
      providesTags: ["Leads"],
    }),
    getLead: builder.query<Envelope<LeadDetail>, string>({
      query: (id) => ({ url: `/crm/leads/${id}` }),
      providesTags: (_, __, id) => [{ type: "Leads", id }],
    }),
    createLead: builder.mutation<Envelope<{ lead: LeadItem }>, CreateLeadRequest>({
      query: (body) => ({ url: "/crm/leads", method: "POST", body }),
      invalidatesTags: ["Leads"],
    }),
    updateLead: builder.mutation<Envelope<LeadItem>, { id: string; body: UpdateLeadRequest }>({
      query: ({ id, body }) => ({ url: `/crm/leads/${id}`, method: "PATCH", body }),
      invalidatesTags: (_, __, { id }) => ["Leads", { type: "Leads", id }],
    }),
    deleteLead: builder.mutation<Envelope<{ ok: true }>, string>({
      query: (id) => ({ url: `/crm/leads/${id}`, method: "DELETE" }),
      invalidatesTags: ["Leads"],
    }),
    convertLead: builder.mutation<Envelope<ConvertLeadResponse>, {
      id: string;
      body: ConvertLeadRequest;
    }>({
      query: ({ id, body }) => ({ url: `/crm/leads/${id}/convert`, method: "POST", body }),
      invalidatesTags: ["Leads", "Customers", "Opportunities"],
    }),
    patchLeadStage: builder.mutation<Envelope<LeadItem>, {
      id: string;
      body: { stage: LeadStatus; note?: string };
    }>({
      query: ({ id, body }) => ({ url: `/crm/leads/${id}/stage`, method: "PATCH", body }),
      invalidatesTags: ["Leads"],
    }),

    // Opportunities
    listOpportunities: builder.query<Envelope<ListOppsResponse>, ListOppsArgs | void>({
      query: (args) => ({ url: "/crm/opportunities", params: args ?? {} }),
      providesTags: ["Opportunities"],
    }),
    getOpportunity: builder.query<Envelope<OpportunityDetail>, string>({
      query: (id) => ({ url: `/crm/opportunities/${id}` }),
    }),
    createOpportunity: builder.mutation<Envelope<{ opportunity: OpportunityItem }>, CreateOpportunityRequest>({
      query: (body) => ({ url: "/crm/opportunities", method: "POST", body }),
      invalidatesTags: ["Opportunities"],
    }),
    updateOpportunity: builder.mutation<Envelope<OpportunityItem>, { id: string; body: UpdateOpportunityRequest }>({
      query: ({ id, body }) => ({ url: `/crm/opportunities/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Opportunities"],
    }),
    deleteOpportunity: builder.mutation<Envelope<{ ok: true }>, string>({
      query: (id) => ({ url: `/crm/opportunities/${id}`, method: "DELETE" }),
      invalidatesTags: ["Opportunities"],
    }),
    patchOppStage: builder.mutation<Envelope<OpportunityItem>, {
      id: string;
      body: PatchOppStageRequest;
    }>({
      query: ({ id, body }) => ({ url: `/crm/opportunities/${id}/stage`, method: "PATCH", body }),
      invalidatesTags: ["Opportunities"],
    }),

    // Activities (append-only)
    listActivities: builder.query<Envelope<ListActivitiesResponse>, ListActivitiesArgs | void>({
      query: (args) => ({ url: "/crm/activities", params: args ?? {} }),
      providesTags: ["Activities"],
    }),
    createActivity: builder.mutation<Envelope<ActivityItem>, CreateActivityRequest>({
      query: (body) => ({ url: "/crm/activities", method: "POST", body }),
      invalidatesTags: ["Activities", "Leads", "Customers", "Opportunities"],
    }),

    // Contracts
    listContracts: builder.query<Envelope<ListContractsResponse>, ListContractsArgs | void>({
      query: (args) => ({ url: "/crm/contracts", params: args ?? {} }),
      providesTags: ["Contracts"],
    }),
    getContract: builder.query<Envelope<ContractItem>, string>({
      query: (id) => ({ url: `/crm/contracts/${id}` }),
    }),
    createContract: builder.mutation<Envelope<{ contract: ContractItem }>, CreateContractRequest>({
      query: (body) => ({ url: "/crm/contracts", method: "POST", body }),
      invalidatesTags: ["Contracts"],
    }),
    updateContract: builder.mutation<Envelope<ContractItem>, { id: string; body: UpdateContractRequest }>({
      query: ({ id, body }) => ({ url: `/crm/contracts/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Contracts"],
    }),
    deleteContract: builder.mutation<Envelope<{ ok: true }>, string>({
      query: (id) => ({ url: `/crm/contracts/${id}`, method: "DELETE" }),
      invalidatesTags: ["Contracts"],
    }),
  }),
  overrideExisting: false,
});

// IMPORTANT: Need to extend tagTypes in apiSlice? We do it below via mutation.
// The apiSlice.createApi was already created with a fixed tagTypes array.
// Extending at runtime is safe for RTK Query — we add types here.
(apiSlice as unknown as { tagTypes: string[] }).tagTypes.push(
  "Customers",
  "Contacts",
  "Leads",
  "Opportunities",
  "Activities",
  "Contracts",
);

export const {
  useListCustomersQuery,
  useGetCustomerQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,

  useListContactsQuery,
  useCreateContactMutation,
  useUpdateContactMutation,
  useDeleteContactMutation,

  useListLeadsQuery,
  useGetLeadQuery,
  useCreateLeadMutation,
  useUpdateLeadMutation,
  useDeleteLeadMutation,
  useConvertLeadMutation,
  usePatchLeadStageMutation,

  useListOpportunitiesQuery,
  useGetOpportunityQuery,
  useCreateOpportunityMutation,
  useUpdateOpportunityMutation,
  useDeleteOpportunityMutation,
  usePatchOppStageMutation,

  useListActivitiesQuery,
  useCreateActivityMutation,

  useListContractsQuery,
  useGetContractQuery,
  useCreateContractMutation,
  useUpdateContractMutation,
  useDeleteContractMutation,
} = crmApi;
