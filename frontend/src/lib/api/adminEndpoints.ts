/**
 * Administration endpoints (Phase 3):
 *  Users, Roles, Permissions, AuditLogs, Profile.
 *
 * All endpoints inherit auth + RBAC from backend — backend 403 is authoritative;
 * frontend gates are UX only.
 */
import { apiSlice } from "./apiSlice";
import type { AuthUser, RoleType } from "@/store/slices/authSlice";

type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

type Envelope<T> = { success: true; data: T; message?: string };

export type UserListItem = AuthUser & {
  roleId: string | null;
  roleDisplayName: string | null;
  role: RoleType;
};

export type ListUsersArgs = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "ACTIVE" | "INACTIVE";
  roleId?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export type ListUsersResponse = {
  items: UserListItem[];
  meta: PaginationMeta;
};

export type CreateUserRequest = {
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
  phone?: string;
  avatarUrl?: string;
};

export type CreateUserResponse = {
  user: UserListItem;
  temporaryPassword: string; // ONE TIME only shown in this 201 response
};

export type UpdateUserRequest = {
  firstName?: string;
  lastName?: string;
  email?: string;
  roleId?: string;
  phone?: string;
  avatarUrl?: string;
  status?: "ACTIVE" | "INACTIVE";
  mustChangePassword?: boolean;
};

export type RoleItem = {
  id: string;
  name: RoleType | string; // can be custom role name (string enum member)
  displayName: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionCount: number;
  permissionCodes: string[];
  createdAt: string;
  updatedAt: string;
};

export type RoleDetail = RoleItem & {
  permissions: {
    code: string;
    module: string;
    action: string;
    description: string | null;
  }[];
};

export type CreateRoleRequest = {
  name: string;
  displayName: string;
  description?: string;
  permissionCodes?: string[];
};

export type UpdateRoleRequest = {
  name?: string;
  displayName?: string;
  description?: string;
  permissionCodes?: string[];
};

export type PermissionsGroupedResponse = {
  total: number;
  grouped: {
    module: string;
    items: {
      id: string;
      code: string;
      module: string;
      action: string;
      description: string | null;
    }[];
  }[];
};

export type AuditLogAction = "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGIN_FAILED" | "LOGOUT";

export type AuditLogItem = {
  id: string;
  userId: string | null;
  action: AuditLogAction;
  entityType: string;
  entityId: string | null;
  beforeData: unknown;
  afterData: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    roleId: string | null;
  } | null;
};

export type ListAuditLogsArgs = {
  page?: number;
  pageSize?: number;
  search?: string;
  entityType?: string;
  action?: AuditLogAction;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export type ListAuditLogsResponse = {
  items: AuditLogItem[];
  meta: PaginationMeta;
};

export type UpdateProfileRequest = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
};

export const adminApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listUsers: builder.query<Envelope<ListUsersResponse>, ListUsersArgs | void>({
      query: (args) => ({
        url: "/users",
        params: args ?? {},
      }),
      providesTags: ["Users"],
    }),
    createUser: builder.mutation<Envelope<CreateUserResponse>, CreateUserRequest>({
      query: (body) => ({ url: "/users", method: "POST", body }),
      invalidatesTags: ["Users"],
    }),
    updateUser: builder.mutation<Envelope<UserListItem>, { id: string; body: UpdateUserRequest }>({
      query: ({ id, body }) => ({ url: `/users/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Users", "me"],
    }),
    activateUser: builder.mutation<Envelope<UserListItem>, string>({
      query: (id) => ({ url: `/users/${id}/activate`, method: "POST" }),
      invalidatesTags: ["Users"],
    }),
    deactivateUser: builder.mutation<Envelope<UserListItem>, string>({
      query: (id) => ({ url: `/users/${id}/deactivate`, method: "POST" }),
      invalidatesTags: ["Users", "me"],
    }),
    getUser: builder.query<Envelope<{ user: AuthUser; permissions: string[] }>, string>({
      query: (id) => ({ url: `/users/${id}` }),
    }),

    listRoles: builder.query<Envelope<{ items: RoleItem[]; meta: PaginationMeta }>, void>({
      query: () => ({ url: "/roles" }),
      providesTags: ["Roles"],
    }),
    getRole: builder.query<Envelope<RoleDetail>, string>({
      query: (id) => ({ url: `/roles/${id}` }),
    }),
    createRole: builder.mutation<Envelope<RoleDetail>, CreateRoleRequest>({
      query: (body) => ({ url: "/roles", method: "POST", body }),
      invalidatesTags: ["Roles"],
    }),
    updateRole: builder.mutation<Envelope<RoleDetail>, { id: string; body: UpdateRoleRequest }>({
      query: ({ id, body }) => ({ url: `/roles/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Roles"],
    }),
    deleteRole: builder.mutation<Envelope<{ ok: true }>, string>({
      query: (id) => ({ url: `/roles/${id}`, method: "DELETE" }),
      invalidatesTags: ["Roles"],
    }),

    listPermissions: builder.query<Envelope<PermissionsGroupedResponse>, void>({
      query: () => ({ url: "/permissions" }),
      providesTags: ["Permissions"],
    }),
    listPermissionsFlat: builder.query<Envelope<PermissionsGroupedResponse["grouped"][number]["items"]>, void>({
      query: () => ({ url: "/permissions/flat" }),
    }),

    listAuditLogs: builder.query<Envelope<ListAuditLogsResponse>, ListAuditLogsArgs | void>({
      query: (args) => ({ url: "/audit-logs", params: args ?? {} }),
      providesTags: ["AuditLogs"],
    }),

    getProfile: builder.query<Envelope<UserListItem>, void>({
      query: () => ({ url: "/profile" }),
      providesTags: ["Profile", "me"],
    }),
    updateProfile: builder.mutation<Envelope<UserListItem>, UpdateProfileRequest>({
      query: (body) => ({ url: "/profile", method: "PATCH", body }),
      invalidatesTags: ["Profile", "me"],
    }),
    changeOwnPassword: builder.mutation<Envelope<{ ok: true }>, {
      currentPassword: string;
      newPassword: string;
    }>({
      query: (body) => ({ url: "/profile/change-password", method: "POST", body }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useListUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useActivateUserMutation,
  useDeactivateUserMutation,
  useGetUserQuery,

  useListRolesQuery,
  useGetRoleQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,

  useListPermissionsQuery,
  useListPermissionsFlatQuery,

  useListAuditLogsQuery,

  useGetProfileQuery,
  useUpdateProfileMutation,
  useChangeOwnPasswordMutation,
} = adminApi;
