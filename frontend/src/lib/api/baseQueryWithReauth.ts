/**
 * Skeleton for Phase 2.
 * baseQueryWithReauth wraps fetchBaseQuery so that ANY 401 on an access token
 * transparently triggers POST /auth/refresh → retries original request once
 * with new access token. Implemented in Phase 2.
 */
import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

const rawBaseQuery = fetchBaseQuery({
  baseUrl,
  credentials: "include",
});

export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  // TODO(phase2): intercept 401 → POST /auth/refresh → retry once
  return rawBaseQuery(args, api, extraOptions);
};
