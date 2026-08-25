/**
 * Top-level route aggregator.
 * Mount order here defines the URL surface of the API:
 *   /api/v1/health
 *   /api/v1/auth/*
 *   (Phase 3+) /api/v1/users, /api/v1/roles, ...
 *
 * auth middleware is NOT mounted globally — only on route groups that
 * need it. /health intentionally has NO auth (upstreams ping it without creds).
 */
import { Router } from "express";
import { healthRouter } from "../modules/health";
import { authRouter } from "../modules/auth/routes";

const apiV1Router = Router();

apiV1Router.use("/health", healthRouter);
apiV1Router.use("/auth", authRouter);

// Phase 3+ mounts (commented out so TypeScript allows placeholder — we add them):
// apiV1Router.use("/roles", authenticate(), authorize("roles:view"), rolesRouter)
// apiV1Router.use("/users", authenticate(), authorize("users:view"), usersRouter)
// Phase 5+: /customers, /leads, /contacts, /activities
// Phase 6+: /categories, /products, /warehouses, /stock, /stock-movements
// Phase 7+: /orders, /invoices, /payments, /pos/checkout
// Phase 8+: /departments, /designations, /employees, /attendance, /leaves
// Phase 9+: /dashboard/*

export { apiV1Router };
