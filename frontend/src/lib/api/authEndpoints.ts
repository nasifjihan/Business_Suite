/**
 * Auth endpoints (RTK Query injectEndpoints into apiSlice).
 * 5 mutations + 1 query (me):
 *   useLoginMutation           → POST /auth/login
 *   useRefreshMutation         → POST /auth/refresh (rarely used directly — baseQueryWithReauth handles it)
 *   useLogoutMutation          → POST /auth/logout (clears cookie + Redux)
 *   useForgotPasswordMutation  → POST /auth/forgot-password
 *   useResetPasswordMutation   → POST /auth/reset-password
 *   useChangePasswordMutation  → POST /auth/change-password
 *   useMeQuery                 → GET  /auth/me (hydrate Redux on page reload, returns user + permissions[])
 */
import type { AuthUser } from "@/store/slices/authSlice";
import { apiSlice } from "./apiSlice";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponseData {
  accessToken: string;
  tokenType: "Bearer";
  expiresInSec: number;
  user: AuthUser;
}

export interface RefreshResponseData {
  accessToken: string;
  tokenType: "Bearer";
  expiresInSec: number;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

type ApiSuccess<T> = { success: true; data: T };

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface MeResponseData {
  user: AuthUser;
  permissions: string[];
}

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<ApiSuccess<LoginResponseData>, LoginRequest>({
      query: (body) => ({
        url: "/auth/login",
        method: "POST",
        body,
      }),
      invalidatesTags: [],
    }),

    refresh: builder.mutation<ApiSuccess<RefreshResponseData>, void>({
      query: () => ({
        url: "/auth/refresh",
        method: "POST",
      }),
    }),

    logout: builder.mutation<ApiSuccess<{ ok: true }>, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
      }),
      invalidatesTags: [],
    }),

    forgotPassword: builder.mutation<ApiSuccess<{ ok: true }>, ForgotPasswordRequest>({
      query: (body) => ({
        url: "/auth/forgot-password",
        method: "POST",
        body,
      }),
    }),

    resetPassword: builder.mutation<ApiSuccess<{ ok: true }>, ResetPasswordRequest>({
      query: (body) => ({
        url: "/auth/reset-password",
        method: "POST",
        body,
      }),
    }),

    changePassword: builder.mutation<ApiSuccess<{ ok: true }>, ChangePasswordRequest>({
      query: (body) => ({
        url: "/auth/change-password",
        method: "POST",
        body,
      }),
    }),

    me: builder.query<ApiSuccess<MeResponseData>, void>({
      query: () => ({
        url: "/auth/me",
        method: "GET",
      }),
      providesTags: ["me"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useLoginMutation,
  useRefreshMutation,
  useLogoutMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
  useMeQuery,
} = authApi;
