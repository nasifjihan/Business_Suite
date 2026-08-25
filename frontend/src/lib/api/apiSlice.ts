/**
 * RTK Query root API slice — single source of truth for ALL backend calls.
 * ----------------------------------------------------------------
 * DESIGN RULE:
 *   - EVERY module (CRM, Inventory, POS, HRM, etc.) will inject their endpoints
 *     into `apiSlice` using apiSlice.injectEndpoints() from their own files.
 *     This way this file stays small and modules stay modular.
 *
 *   - Global behaviour:
 *       * baseUrl = NEXT_PUBLIC_API_URL (http://localhost:5000/api/v1)
 *       * fetchBaseQuery = fetch wrapper + credentials: 'include' (HTTP-only
 *         refresh cookie is sent with every request)
 *       * tagTypes: entity tags for cache invalidation (add new ones as modules build)
 */
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl,
    credentials: "include", // Required for Next SSR cookie flow
    prepareHeaders: (headers) => {
      // Phase 2 implements access-token header injection from Redux auth slice here
      return headers;
    },
  }),
  // tagTypes: empty for phase 1. Phase 5+ add "Customer", "Lead", etc
  tagTypes: [],
  endpoints: () => ({}),
});

export const { usePrefetch } = apiSlice;

// Export reauth-aware baseQuery for Phase 2
export { baseUrl };
