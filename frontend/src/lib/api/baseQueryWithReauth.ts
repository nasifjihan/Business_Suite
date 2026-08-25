/**
 * baseQueryWithReauth: transparent token refresh middleware for RTK Query.
 *
 * Flow (single request):
 *   1. Normal request → 200 → return data. Done.
 *   2. Normal request → 401 Unauthorized?
 *        - We already tried a refresh retry for this request? → give up (clear credentials → redirect /login)
 *        - No retry yet? → ENTER refresh mutex.
 *
 * Mutex singleton: 10 simultaneous failing requests on page load shouldn't trigger 10 refresh calls.
 *                  Only the first request does POST /auth/refresh; all 9 others await that single promise.
 *   3. Refresh SUCCESS → dispatch(authSlice.updateAccessToken(newToken)) → retry original request ONCE
 *      with new token.
 *   4. Refresh FAILS (cookie missing, cookie revoked, reuse detected, family banned)
 *      → dispatch(authSlice.clearCredentials())
 *      → window.location.replace('/login') (hard redirect, clears RTK cache cleanly)
 */
import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import { Mutex } from "async-mutex";
import { clearCredentials, updateAccessToken } from "@/store/slices/authSlice";
import { RootState } from "@/store/store";

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

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

// Singleton mutex — prevents refresh-token storms when 10 tabs/components 401 simultaneously.
const mutex = new Mutex();

export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  // await mutex lock only UNTIL we get it (non-blocking check later)
  await mutex.waitForUnlock();

  let result = await rawBaseQuery(args, api, extraOptions);

  const isUnauthorized = result.error?.status === 401;

  if (!isUnauthorized) {
    return result;
  }

  // ─── 401 detected. Decide: first attempt → refresh; second attempt → logout ───
  if (!mutex.isLocked()) {
    const release = await mutex.acquire();

    try {
      const refreshResult = await rawBaseQuery(
        {
          url: "/auth/refresh",
          method: "POST",
        },
        api,
        extraOptions
      );

      if (
        refreshResult.data &&
        typeof refreshResult.data === "object" &&
        "success" in refreshResult.data &&
        (refreshResult.data as { success?: unknown }).success === true &&
        "data" in refreshResult.data &&
        typeof (refreshResult.data as { data?: unknown }).data === "object" &&
        (refreshResult.data as { data: { accessToken?: unknown } }).data?.accessToken &&
        typeof (refreshResult.data as { data: { accessToken: string } }).data.accessToken === "string"
      ) {
        // Refresh worked: update Redux access token memory → retry original query
        const newToken = (refreshResult.data as { data: { accessToken: string } }).data.accessToken;
        api.dispatch(updateAccessToken(newToken));

        // Retry original once. Second 401 will fall to the else branch (mutex unlocked by other flow already failed).
        const retry = await rawBaseQuery(args, api, extraOptions);
        if (retry.error?.status === 401) {
          // Still 401 even after refresh → clear + redirect
          api.dispatch(clearCredentials());
          if (typeof window !== "undefined") {
            window.location.replace("/login?expired=1");
          }
        }
        return retry;
      } else {
        // Refresh itself failed (cookie missing / revoked / banned family)
        api.dispatch(clearCredentials());
        if (typeof window !== "undefined") {
          window.location.replace("/login?expired=1");
        }
        return refreshResult as typeof result;
      }
    } finally {
      release();
    }
  } else {
    // Mutex LOCKED — another query is already running refresh.
    // Wait for it to finish, then retry once without calling refresh ourselves.
    await mutex.waitForUnlock();
    const retry = await rawBaseQuery(args, api, extraOptions);
    if (retry.error?.status === 401) {
      api.dispatch(clearCredentials());
      if (typeof window !== "undefined") {
        window.location.replace("/login?expired=1");
      }
    }
    return retry;
  }
};

export { baseUrl, rawBaseQuery };
