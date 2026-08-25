/**
 * Top-level route aggregator.
 * Mount order here defines the URL surface of the API:
 *   /api/v1/health
 *   /api/v1/auth/*
 *   /api/v1/users, /api/v1/roles, /api/v1/permissions, /api/v1/audit-logs, /api/v1/profile
 *   (Phase 4+) /api/v1/customers, /api/v1/leads, /api/v1/contacts, /api/v1/activities
 *   ...
 *
 * auth middleware is NOT mounted globally — only on route groups that
 * need it. /health intentionally has NO auth (upstreams ping it without creds).
 */
import { Router } from "express";
import { healthRouter } from "../modules/health";
import { authRouter } from "../modules/auth/routes";
import { usersRouter } from "../modules/users/routes";
import { rolesRouter } from "../modules/roles/routes";
import { permissionsRouter } from "../modules/permissions/routes";
import { auditLogsRouter } from "../modules/audit-logs/routes";
import { profileRouter } from "../modules/profile/routes";

const apiV1Router = Router();

apiV1Router.use("/health", healthRouter);
apiV1Router.use("/auth", authRouter);

// Phase 3: Administration / RBAC routes
apiV1Router.use("/users", usersRouter);
apiV1Router.use("/roles", rolesRouter);
apiV1Router.use("/permissions", permissionsRouter);
apiV1Router.use("/audit-logs", auditLogsRouter);
apiV1Router.use("/profile", profileRouter);

// Phase 4: CRM
// apiV1Router.use("/customers", customersRouter)
// apiV1Router.use("/leads", leadsRouter)
// Phase 5+: /products, /warehouses, /stock, ...
// Phase 6+: /orders, /invoices, /payments
// Phase 7+: /employees, /attendance, /leaves
// Phase 8+: /dashboard/*

export { apiV1Router };
