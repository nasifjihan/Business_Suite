/**
 * Auth endpoints (RTK Query injectEndpoints into apiSlice).
 *   useLoginMutation           → POST /auth/login
 *   useVerifyTwoFactorMutation → POST /auth/2fa/verify (login step 2)
 *   useTwoFactorStatusQuery    → GET  /auth/2fa/status
 *   useSetupTwoFactorMutation  → POST /auth/2fa/setup
 *   useEnableTwoFactorMutation → POST /auth/2fa/enable
 *   useDisableTwoFactorMutation→ POST /auth/2fa/disable
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
  permissions: string[];
}

/**
 * What POST /auth/login returns when the account has 2FA on: no session, only
 * a short-lived token to spend at /auth/2fa/verify. `twoFactorRequired` is the
 * discriminator, so the form branches on a field rather than on the absence of
 * `accessToken` (which would silently change meaning if the session payload
 * ever gained optional fields).
 */
export interface TwoFactorChallengeData {
  twoFactorRequired: true;
  challengeToken: string;
}

export type LoginResult = LoginResponseData | TwoFactorChallengeData;

export interface TwoFactorVerifyRequest {
  challengeToken: string;
  code: string;
}

export interface TwoFactorStatusData {
  enabled: boolean;
  recoveryCodesRemaining: number;
}

export interface TwoFactorSetupData {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

export interface TwoFactorEnableData {
  ok: true;
  /** Plaintext, returned exactly once — there is no endpoint to read them back. */
  recoveryCodes: string[];
}

export interface RefreshResponseData {
  accessToken: string;
  tokenType: "Bearer";
  expiresInSec: number;
  user: AuthUser;
  permissions: string[];
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
    login: builder.mutation<ApiSuccess<LoginResult>, LoginRequest>({
      query: (body) => ({
        url: "/auth/login",
        method: "POST",
        body,
      }),
      invalidatesTags: [],
    }),

    verifyTwoFactor: builder.mutation<
      ApiSuccess<LoginResponseData>,
      TwoFactorVerifyRequest
    >({
      query: (body) => ({
        url: "/auth/2fa/verify",
        method: "POST",
        body,
      }),
    }),

    twoFactorStatus: builder.query<ApiSuccess<TwoFactorStatusData>, void>({
      query: () => ({
        url: "/auth/2fa/status",
        method: "GET",
      }),
      providesTags: ["twoFactor"],
    }),

    setupTwoFactor: builder.mutation<ApiSuccess<TwoFactorSetupData>, void>({
      query: () => ({
        url: "/auth/2fa/setup",
        method: "POST",
      }),
    }),

    enableTwoFactor: builder.mutation<
      ApiSuccess<TwoFactorEnableData>,
      { code: string }
    >({
      query: (body) => ({
        url: "/auth/2fa/enable",
        method: "POST",
        body,
      }),
      invalidatesTags: ["twoFactor"],
    }),

    disableTwoFactor: builder.mutation<ApiSuccess<{ ok: true }>, { password: string }>({
      query: (body) => ({
        url: "/auth/2fa/disable",
        method: "POST",
        body,
      }),
      invalidatesTags: ["twoFactor"],
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
  useVerifyTwoFactorMutation,
  useTwoFactorStatusQuery,
  useSetupTwoFactorMutation,
  useEnableTwoFactorMutation,
  useDisableTwoFactorMutation,
  useRefreshMutation,
  useLogoutMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
  useMeQuery,
} = authApi;
