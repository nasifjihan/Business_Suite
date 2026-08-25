/**
 * RTK Query root API slice — single source of truth for ALL backend calls.
 *
 * baseQuery = baseQueryWithReauth (transparent 401 → refresh → retry)
 * prepareHeaders: pulls access token from Redux memory, sets Authorization: Bearer
 *
 * MODULES (CRM/Inventory/POS/HRM etc) inject endpoints HERE using:
 *   apiSlice.injectEndpoints({ endpoints: (builder) => ({ ... }), overrideExisting: false });
 *
 * Keeping endpoints in their own modules keeps this file small.
 */
import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./baseQueryWithReauth";

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  // Cache lifetime: 60 seconds for non-critical UI. Set per-endpoint as needed.
  keepUnusedDataFor: 60,
  refetchOnMountOrArgChange: false,
  refetchOnReconnect: true,
  tagTypes: [
    // Global entity cache tags — modules add their own.
    "me",
    "Users",
    "Roles",
    "Permissions",
    "AuditLogs",
    "Profile",
    // Phase 4+: "Customers", "Leads", "Contacts"
    // Phase 5+: "Products", "Categories", "Warehouses", "Stock", "StockMovements"
    // Phase 6+: "Orders", "Invoices", "Payments"
    // Phase 7+: "Employees", "Attendance", "LeaveRequests"
    // Phase 8+: "DashboardKPIs"
  ],
  endpoints: () => ({}),
});

export const { usePrefetch } = apiSlice;
