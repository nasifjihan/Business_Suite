/**
 * baseQueryWithReauth: transparent token refresh middleware for RTK Query.
 *
 * SHARED SINGLETON mutex prevents double-refresh races. Two public entry points:
 *   1) The middleware baseQueryWithReauth — called automatically by RTK on every endpoint.
 *      If any request 401s, mutex-acquire refresh → write tokens → retry once.
 *   2) `refreshAccessToken({ dispatch, getState })` — public helper exported for any
 *      caller OUTSIDE the RTK middleware (e.g., AuthHydrationProvider on page mount).
 *      Accepts dispatch/getState explicitly from the caller — NO global singleton import
 *      required, so it works with any store instance (SSR-safe, works with StoreProvider).
 *
 *      Inside React components, do:
 *        const store = useStore<RootState, AppDispatch>();
 *        const payload = await refreshAccessToken(store);
 *
 * Auth failure path: Both the middleware and public helper run the SAME redirect path:
 *   dispatch(clearCredentials()) + window.location.replace('/login?expired=1').
 */
import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import { Mutex } from "async-mutex";
import {
  clearCredentials,
  setCredentials,
  type AuthUser,
} from "@/store/slices/authSlice";
import type { RootState } from "@/store/store";

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

export type RefreshSuccessPayload = {
  accessToken: string;
  tokenType: "Bearer";
  expiresInSec: number;
  user: AuthUser;
  permissions: string[];
};

export type StoreLike = {
  dispatch: (action: any) => any;
  getState: () => unknown;
};

const rawBaseQuery = fetchBaseQuery({
  baseUrl,
  credentials: "include",
  prepareHeaders: (headers, api) => {
    const accessToken = (api.getState() as RootState).auth.accessToken;
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
    headers.set("Accept", "application/json");
    return headers;
  },
});

// SHARED singleton mutex across BOTH middleware and helper.
const mutex = new Mutex();

function enrichUser(raw: Record<string, unknown> | AuthUser): AuthUser {
  const u = raw as AuthUser & { firstName?: string; lastName?: string; fullName?: string };
  if (!u.fullName) {
    const parts = [u.firstName, u.lastName].filter(Boolean);
    (u as AuthUser & { fullName: string }).fullName = parts.join(" ").trim();
  }
  return u;
}

async function handleRefreshSuccess(
  dispatch: (a: any) => any,
  raw: unknown
): Promise<RefreshSuccessPayload | null> {
  const envelope = raw as { success?: boolean; data?: Record<string, unknown> };
  if (
    envelope &&
    envelope.success === true &&
    envelope.data &&
    typeof envelope.data === "object" &&
    typeof (envelope.data.accessToken as unknown) === "string" &&
    envelope.data.user &&
    typeof envelope.data.user === "object"
  ) {
    const d = envelope.data;
    const user = enrichUser(d.user as Record<string, unknown>);
    const permissions = Array.isArray(d.permissions)
      ? (d.permissions as string[])
      : [];
    dispatch(
      setCredentials({
        accessToken: d.accessToken as string,
        user,
        permissions,
      })
    );
    return {
      accessToken: d.accessToken as string,
      tokenType: "Bearer",
      expiresInSec: typeof d.expiresInSec === "number" ? d.expiresInSec : 0,
      user,
      permissions,
    };
  }
  return null;
}

function hardLogout(dispatch: (a: any) => any): null {
  dispatch(clearCredentials());
  if (typeof window !== "undefined") {
    window.location.replace("/login?expired=1");
  }
  return null;
}

async function refreshInternal(
  api: StoreLike,
  extraOptions: unknown
): Promise<RefreshSuccessPayload | null> {
  await mutex.waitForUnlock();
  if (!mutex.isLocked()) {
    const release = await mutex.acquire();
    try {
      const refreshResult = await rawBaseQuery(
        { url: "/auth/refresh", method: "POST" },
        api as never,
        extraOptions as never
      );
      if (refreshResult.error) {
        return hardLogout(api.dispatch);
      }
      const payload = await handleRefreshSuccess(
        api.dispatch,
        refreshResult.data
      );
      if (!payload) {
        return hardLogout(api.dispatch);
      }
      return payload;
    } finally {
      release();
    }
  }
  // Another caller already held the mutex. Wait for it, then return what Redux already has.
  await mutex.waitForUnlock();
  const state = api.getState() as RootState;
  if (state.auth.isAuthenticated && state.auth.accessToken && state.auth.user) {
    return {
      accessToken: state.auth.accessToken,
      tokenType: "Bearer",
      expiresInSec: 0,
      user: state.auth.user,
      permissions: state.auth.permissions ?? [],
    };
  }
  return null;
}

/**
 * Public helper — run POST /auth/refresh using the shared mutex.
 * Caller passes store reference (dispatch + getState).
 *
 * Inside React hooks use:
 *   const store = useStore<RootState, AppDispatch>();
 *   const payload = await refreshAccessToken(store);
 */
export async function refreshAccessToken(
  store: StoreLike
): Promise<RefreshSuccessPayload | null> {
  return refreshInternal(store, {});
}

export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  await mutex.waitForUnlock();
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status !== 401) {
    return result;
  }
  const refreshed = await refreshInternal(api, extraOptions);
  if (!refreshed) return result;
  const retry = await rawBaseQuery(args, api, extraOptions);
  if (retry.error?.status === 401) {
    hardLogout(api.dispatch);
  }
  return retry;
};

export { baseUrl, rawBaseQuery, mutex };
