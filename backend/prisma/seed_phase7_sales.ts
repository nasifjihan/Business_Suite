/* eslint-disable no-console */
/**
 * Phase 7 — Sales & POS Module RBAC Seed
 * Idempotent ADDITIVE-only seed (never DELETEs existing rows — safe re-runs).
 * Adds 13 granular permission codes × 7 role tiers.
 */
import { prisma } from "../src/lib/prisma";

const SALES_PERMISSIONS: { code: string; module: string; action: string; description: string }[] = [
  // Orders 5
  { code: "sales.orders.read", module: "sales.orders", action: "read", description: "View sales orders list & detail" },
  { code: "sales.orders.create", module: "sales.orders", action: "create", description: "Create / draft sales orders (back office)" },
  { code: "sales.orders.checkout", module: "sales.orders", action: "checkout", description: "Process POS checkout — finalize cart + payment atomically" },
  { code: "sales.orders.update", module: "sales.orders", action: "update", description: "Edit order status / mark CANCELLED (restocks if warehouse)" },
  { code: "sales.orders.delete", module: "sales.orders", action: "delete", description: "Delete sales order" },

  // Payments 2 (append-only: NO update/delete routes!)
  { code: "sales.payments.read", module: "sales.payments", action: "read", description: "View payments ledger" },
  { code: "sales.payments.create", module: "sales.payments", action: "create", description: "Record new payment transactions (append-only ledger)" },

  // Refunds 2 (append-only)
  { code: "sales.refunds.read", module: "sales.refunds", action: "read", description: "View refunds history" },
  { code: "sales.refunds.create", module: "sales.refunds", action: "create", description: "Process refunds (manager approval usually required)" },

  // Reports 1 (read-only)
  { code: "sales.reports.read", module: "sales.reports", action: "read", description: "View daily sales reports & method breakdown" },

  // Credits 3 (MVP customer account balance CRUD)
  { code: "sales.credits.read", module: "sales.credits", action: "read", description: "View customer account credit balances" },
  { code: "sales.credits.create", module: "sales.credits", action: "create", description: "Increase customer credit balance (top up account)" },
  { code: "sales.credits.update", module: "sales.credits", action: "update", description: "Decrease / adjust customer credit balance" },
];

const ROLE_GRANTS: Record<string, string[]> = {
  SUPER_ADMIN: SALES_PERMISSIONS.map((p) => p.code),
  ADMIN: SALES_PERMISSIONS.map((p) => p.code),
  MANAGER: SALES_PERMISSIONS.map((p) => p.code),
  // SALES: can checkout on POS, create/read orders, READ refunds/payments, NO refund create, NO orders delete
  SALES: [
    "sales.orders.read",
    "sales.orders.create",
    "sales.orders.checkout",
    "sales.orders.update",
    "sales.payments.read",
    "sales.payments.create",
    "sales.refunds.read",
    "sales.reports.read",
    "sales.credits.read",
  ],
  // CASHIER (narrow — POS only, no back-office order edit, no reports)
  CASHIER: [
    "sales.orders.read",
    "sales.orders.checkout",
    "sales.payments.read",
    "sales.payments.create",
  ],
  // HR: nothing about sales
  HR: [],
  // VIEWER: read-only everywhere
  VIEWER: [
    "sales.orders.read",
    "sales.payments.read",
    "sales.refunds.read",
    "sales.reports.read",
    "sales.credits.read",
  ],
};

async function main() {
  console.log(`\n[Phase7] Inserting ${SALES_PERMISSIONS.length} sales permissions...`);

  // ── 1. Upsert permissions (idempotent by unique code) ─────────────
  for (const p of SALES_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { module: p.module, action: p.action, description: p.description },
      create: p,
    });
  }
  console.log(`  ✔ Permissions upserted.`);

  // ── 2. Fetch ALL RoleType→Role.id map ──────────────────────────────
  const allRoles = await prisma.role.findMany({
    select: { id: true, name: true },
  });
  const roleById = Object.fromEntries(allRoles.map((r) => [r.name, r.id]));

  // ── 3. Fetch ALL code→Permission.id map ────────────────────────────
  const allPerms = await prisma.permission.findMany({
    where: { code: { in: SALES_PERMISSIONS.map((p) => p.code) } },
    select: { id: true, code: true },
  });
  const permById = Object.fromEntries(allPerms.map((pp) => [pp.code, pp.id]));

  // ── 4. ADDITIVE-only role grants (find existing, diff, createMany) ─
  for (const [roleType, codes] of Object.entries(ROLE_GRANTS)) {
    const roleId = roleById[roleType];
    if (!roleId) {
      console.log(`  ⚠ Role ${roleType} not in DB — skipping grants`);
      continue;
    }
    const existing = await prisma.rolePermission.findMany({
      where: { roleId, permissionId: { in: codes.map((c) => permById[c]).filter(Boolean) } },
      select: { permissionId: true },
    });
    const existingSet = new Set(existing.map((rp) => rp.permissionId));

    const toInsert = codes
      .filter((c) => permById[c] && !existingSet.has(permById[c]))
      .map((c) => ({ roleId, permissionId: permById[c] }));

    if (toInsert.length) {
      await prisma.rolePermission.createMany({ data: toInsert, skipDuplicates: true });
      console.log(`  + Role ${roleType}: added ${toInsert.length} grants`);
    } else {
      console.log(`  = Role ${roleType}: already up-to-date`);
    }
  }

  console.log(`\n[Phase7] RBAC seed complete. Safe to re-run idempotently.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
