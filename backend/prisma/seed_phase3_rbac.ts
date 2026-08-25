/**
 * Phase 3 seed:
 *   - Create 60+ Permission codes (module.action format)
 *   - Assign them to 7 roles (tiered per spec §8.2 table 704)
 *
 * Run:
 *   npx ts-node prisma/seed_phase3_rbac.ts
 *
 * (No tsconfig-paths/register required — uses relative imports.)
 */
import { prisma } from "../src/lib/prisma";
import { RoleType } from "@prisma/client";

type PermissionSeed = {
  code: string;
  module: string;
  action: string;
  description?: string;
};

// ──────────────────────────────────────────────────────────────────────────────
// 1. Define 60+ permissions grouped by module (matches spec §720 convention)
// ──────────────────────────────────────────────────────────────────────────────
const PERMISSIONS: PermissionSeed[] = [
  // Dashboard — 2
  { code: "dashboard.read",   module: "dashboard", action: "read",   description: "View dashboard widgets & KPIs" },
  { code: "dashboard.manage", module: "dashboard", action: "manage", description: "Configure dashboard layout" },

  // Administration / Users — 5
  { code: "users.read",     module: "users",     action: "read",     description: "List & search users" },
  { code: "users.create",   module: "users",     action: "create",   description: "Create new user accounts" },
  { code: "users.update",   module: "users",     action: "update",   description: "Update user profile / role / status" },
  { code: "users.delete",   module: "users",     action: "delete",   description: "Delete users (irreversible)" },
  { code: "profile.update", module: "profile",   action: "update",   description: "Edit own profile (name, phone)" },

  // Administration / Roles & Permissions — 4
  { code: "roles.read",     module: "roles",     action: "read",     description: "View roles & permission matrices" },
  { code: "roles.create",   module: "roles",     action: "create",   description: "Create new roles" },
  { code: "roles.update",   module: "roles",     action: "update",   description: "Edit role name, description, assign permissions" },
  { code: "roles.delete",   module: "roles",     action: "delete",   description: "Delete non-system roles" },

  // Audit log — 1
  { code: "audit.read",     module: "audit",     action: "read",     description: "View audit logs & filters" },

  // System settings — 1
  { code: "system.settings", module: "system",   action: "manage",   description: "Global system settings (SUPER_ADMIN only)" },

  // CRM / Customers — 5
  { code: "customers.read",   module: "crm",     action: "read",     description: "View customers & contacts" },
  { code: "customers.create", module: "crm",     action: "create",   description: "Create customers & contacts" },
  { code: "customers.update", module: "crm",     action: "update",   description: "Edit customers & contacts" },
  { code: "customers.delete", module: "crm",     action: "delete",   description: "Delete customers" },
  { code: "crm.export",       module: "crm",     action: "export",   description: "Export customer data" },

  // CRM / Leads — 6
  { code: "leads.read",       module: "crm",     action: "read",     description: "View leads & pipeline" },
  { code: "leads.create",     module: "crm",     action: "create",   description: "Create new leads" },
  { code: "leads.update",     module: "crm",     action: "update",   description: "Edit lead data, status changes" },
  { code: "leads.delete",     module: "crm",     action: "delete",   description: "Delete leads" },
  { code: "leads.assign",     module: "crm",     action: "assign",   description: "Assign leads to sales reps" },
  { code: "leads.activity",   module: "crm",     action: "activity", description: "Add lead activity notes / calls / meetings" },

  // Inventory / Categories — 4
  { code: "categories.read",   module: "inventory", action: "read",   description: "View categories" },
  { code: "categories.create", module: "inventory", action: "create", description: "Create categories" },
  { code: "categories.update", module: "inventory", action: "update", description: "Edit categories" },
  { code: "categories.delete", module: "inventory", action: "delete", description: "Delete categories" },

  // Inventory / Products — 5
  { code: "products.read",   module: "inventory", action: "read",   description: "View products & SKUs" },
  { code: "products.create", module: "inventory", action: "create", description: "Create new products" },
  { code: "products.update", module: "inventory", action: "update", description: "Edit products, prices, images" },
  { code: "products.delete", module: "inventory", action: "delete", description: "Delete products" },
  { code: "products.export", module: "inventory", action: "export", description: "Export product catalog" },

  // Inventory / Warehouses — 4
  { code: "warehouses.read",   module: "inventory", action: "read",   description: "View warehouses" },
  { code: "warehouses.create", module: "inventory", action: "create", description: "Create warehouses" },
  { code: "warehouses.update", module: "inventory", action: "update", description: "Edit warehouses" },
  { code: "warehouses.delete", module: "inventory", action: "delete", description: "Delete warehouses" },

  // Inventory / Stock — 4
  { code: "stock.read",     module: "inventory", action: "read",     description: "View stock on hand, movements" },
  { code: "stock.adjust",   module: "inventory", action: "adjust",   description: "Manual stock adjustments (+/-)" },
  { code: "stock.transfer", module: "inventory", action: "transfer", description: "Stock transfers between warehouses" },
  { code: "stock.export",   module: "inventory", action: "export",   description: "Export stock report" },

  // Sales / Orders — 5
  { code: "orders.read",    module: "sales",     action: "read",     description: "View orders, history & invoices" },
  { code: "orders.create",  module: "sales",     action: "create",   description: "Create orders manually" },
  { code: "orders.update",  module: "sales",     action: "update",   description: "Edit orders, status, discounts" },
  { code: "orders.delete",  module: "sales",     action: "delete",   description: "Cancel / delete orders" },
  { code: "orders.export",  module: "sales",     action: "export",   description: "Export orders & sales reports" },

  // POS — 4
  { code: "pos.use",        module: "sales",     action: "use",      description: "Access POS counter & cart" },
  { code: "pos.checkout",   module: "sales",     action: "checkout", description: "Complete POS checkout & take payment" },
  { code: "pos.discount",   module: "sales",     action: "discount", description: "Apply POS line / order discounts" },
  { code: "pos.refund",     module: "sales",     action: "refund",   description: "Process POS returns / refunds" },

  // Payments — 3
  { code: "payments.read",   module: "sales",    action: "read",     description: "View payments & receipts" },
  { code: "payments.create", module: "sales",    action: "create",   description: "Record new payments" },
  { code: "payments.refund", module: "sales",    action: "refund",   description: "Process payment refunds" },

  // HRM / Employees — 5
  { code: "employees.read",   module: "hrm",     action: "read",     description: "View employees, profile & docs" },
  { code: "employees.create", module: "hrm",     action: "create",   description: "Create new employee records" },
  { code: "employees.update", module: "hrm",     action: "update",   description: "Edit employee info" },
  { code: "employees.delete", module: "hrm",     action: "delete",   description: "Terminate / delete employees" },
  { code: "employees.export", module: "hrm",     action: "export",   description: "Export employee list" },

  // HRM / Attendance — 3
  { code: "attendance.read",   module: "hrm",   action: "read",     description: "View attendance records" },
  { code: "attendance.manage", module: "hrm",   action: "manage",   description: "Check-in / check-out, edit records" },
  { code: "attendance.export", module: "hrm",   action: "export",   description: "Export attendance report" },

  // HRM / Leave — 4
  { code: "leave.read",     module: "hrm",     action: "read",     description: "View leave requests, balances" },
  { code: "leave.request",  module: "hrm",     action: "request",  description: "Submit own leave requests" },
  { code: "leave.approve",  module: "hrm",     action: "approve",  description: "Approve / reject leave requests" },
  { code: "leave.manage",   module: "hrm",     action: "manage",   description: "Manage leave types, carry-over rules" },

  // HRM / Departments & Designations — 4
  { code: "departments.read",   module: "hrm", action: "read",     description: "View departments" },
  { code: "departments.create", module: "hrm", action: "create",   description: "Create departments" },
  { code: "departments.update", module: "hrm", action: "update",   description: "Edit departments" },
  { code: "departments.delete", module: "hrm", action: "delete",   description: "Delete departments" },
];

// ──────────────────────────────────────────────────────────────────────────────
// 2. Tiered role → permission assignment (spec §8.2 RBAC table 704)
// ──────────────────────────────────────────────────────────────────────────────
function getPermissionCodes(mod: string, actions?: string[]): string[] {
  const rows = PERMISSIONS.filter((p) => p.module === mod);
  if (!actions) return rows.map((p) => p.code);
  return rows.filter((p) => actions.includes(p.action)).map((p) => p.code);
}

const ALL_CODES = PERMISSIONS.map((p) => p.code);

const ROLE_PERMISSIONS: Record<RoleType, string[]> = {
  // SUPER_ADMIN — ALL 60+ permissions explicitly
  [RoleType.SUPER_ADMIN]: ALL_CODES,

  // ADMIN — all non-system: dashboard, crm, inventory, sales, hrm, audit.read,
  // users.read/create/update, roles.read. NOT users.delete, roles.create/delete, system.settings
  [RoleType.ADMIN]: [
    ...getPermissionCodes("dashboard"),
    ...getPermissionCodes("users", ["read", "create", "update"]),
    ...["profile.update"],
    ...getPermissionCodes("roles", ["read"]),
    ...["audit.read"],
    ...getPermissionCodes("crm"),
    ...getPermissionCodes("inventory"),
    ...getPermissionCodes("sales"),
    ...getPermissionCodes("hrm"),
  ],

  // MANAGER — dashboard+CRM+inventory(read/create/update/no delete)+sales+HR
  // (read/attendance.manage/leave.approve) + users.read. No administration.
  [RoleType.MANAGER]: [
    ...getPermissionCodes("dashboard", ["read"]),
    ...["users.read", "profile.update"],
    ...getPermissionCodes("crm"),
    ...[
      ...getPermissionCodes("inventory"),
    ].filter((c) => c !== "products.delete" && c !== "categories.delete" && c !== "warehouses.delete"),
    ...getPermissionCodes("sales"),
    ...getPermissionCodes("hrm", ["read", "manage", "approve", "request"]),
  ],

  // SALES — dashboard.read, full CRM, sales.pos/orders.read/payments.read,
  // customers.read/create, inventory.read.
  [RoleType.SALES]: [
    ...getPermissionCodes("dashboard", ["read"]),
    ...["profile.update"],
    ...getPermissionCodes("crm"),
    ...["pos.use", "pos.checkout", "pos.discount"],
    ...getPermissionCodes("sales", ["read", "create"]),
    ...getPermissionCodes("payments", ["read", "create"]),
    ...getPermissionCodes("inventory", ["read"]),
  ],

  // CASHIER — POS, customer lookup/create, payments, basic inventory.read.
  [RoleType.CASHIER]: [
    ...["profile.update"],
    ...["pos.use", "pos.checkout", "pos.discount"],
    ...getPermissionCodes("payments", ["create", "read"]),
    ...getPermissionCodes("sales", ["read", "create"]),
    ...["customers.read", "customers.create"],
    ...getPermissionCodes("inventory", ["read"]),
  ],

  // HR — hrm.* (everything in HRM), dashboard.read, users.read, profile.update
  [RoleType.HR]: [
    ...getPermissionCodes("dashboard", ["read"]),
    ...["users.read", "profile.update"],
    ...getPermissionCodes("hrm"),
  ],

  // VIEWER — read-only across dashboard, crm, inventory, sales, hrm.
  // Zero write actions.
  [RoleType.VIEWER]: [
    ...getPermissionCodes("dashboard", ["read"]),
    ...getPermissionCodes("crm", ["read"]),
    ...getPermissionCodes("inventory", ["read"]),
    ...getPermissionCodes("sales", ["read"]),
    ...getPermissionCodes("payments", ["read"]),
    ...getPermissionCodes("hrm", ["read"]),
    ...["profile.update"],
  ],
};

// ──────────────────────────────────────────────────────────────────────────────
// 3. Upsert all (idempotent — safe to re-run)
// ──────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🌱 Phase 3 RBAC seed: ${PERMISSIONS.length} permissions, ${Object.keys(ROLE_PERMISSIONS).length} roles…`);

  // 3a. Upsert each permission (code is unique)
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      create: perm,
      update: {
        module: perm.module,
        action: perm.action,
        description: perm.description ?? null,
      },
    });
  }
  console.log(`  ✔ Permissions upserted: ${PERMISSIONS.length}`);

  // 3b. For each role → delete old RolePermission rows then insert.
  // (Delete is simpler than diff; preserves idempotency on re-run.)
  for (const [roleType, codes] of Object.entries(ROLE_PERMISSIONS) as [RoleType, string[]][]) {
    const role = await prisma.role.findUnique({ where: { name: roleType } });
    if (!role) {
      console.warn(`  ⚠ Role not found: ${roleType} — skipping (run seed_phase2_admin first).`);
      continue;
    }
    // delete existing
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    // insert new
    const perms = await prisma.permission.findMany({
      where: { code: { in: codes } },
      select: { id: true },
    });
    if (perms.length !== codes.length) {
      console.warn(`  ⚠ Missing permission rows for role=${roleType}: expected ${codes.length}, found ${perms.length}. Continuing with what we have.`);
    }
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
    console.log(`  ✔ Role '${roleType}' assigned ${perms.length} permissions.`);
  }

  const totalAssignments = await prisma.rolePermission.count();
  console.log(`✅ Phase 3 RBAC seed complete. Total RolePermission rows: ${totalAssignments}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
