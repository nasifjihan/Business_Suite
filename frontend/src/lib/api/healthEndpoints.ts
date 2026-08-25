/**
 * Health + system status endpoints module.
 * - GET /health → backend + database connectivity status
 */
import { apiSlice } from "../api/apiSlice";

export type HealthDto = {
  status: "ok" | "degraded";
  dbOk: boolean;
  timestamp: string;
  version: string;
};

export const healthApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getHealth: builder.query<HealthDto, void>({
      query: () => "/health",
      providesTags: [],
      transformResponse: (raw: { success: true; data: HealthDto }) => raw.data,
    }),
  }),
});

export const { useGetHealthQuery } = healthApiSlice;
