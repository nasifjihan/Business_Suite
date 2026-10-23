/**
 * Phase 5 seed:
 *   - Insert CRM granular permissions (module= crm.* pattern, 12 new sub-module codes)
 *   - Assign to all 7 tiers.
 *   - This augments Phase 3 seed crm entries (6 customer-lead level entries).
 *
 * Run AFTER schema changes & prisma generate.
 *   npx ts-node prisma/seed_phase5_crm.ts
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
// 24 granular CRM codes.
//
// Phase 3 inserted the legacy un-namespaced aliases (customers.read/…,
// leads.read/…, crm.export) — 10 codes. Phase 5 adds the namespaced codes the
// routes and the admin UI actually use: customers R/C/U/D (4), leads R/C/U/D (4),
// contacts R/C/U/D (4), opportunities R/C/U/D/stage (5), leads.convert (1),
// activities R/C (2), contracts R/C/U/D (4) = 24.
// ──────────────────────────────────────────────────────────────────────────────
const CRM_PERMISSIONS: PermissionSeed[] = [
  // CRM / Customers (4) and CRM / Leads (4)
  //
  // These are the codes the API routes actually authorize on (see
  // src/modules/crm/{customers,leads}/routes.ts) and the ones the admin UI gates
  // on. Phase 3 only created the legacy un-namespaced aliases
  // (customers.read/create/update/delete, leads.read/create/update/delete), so
  // without these entries every CRM customer and lead endpoint answered 403 for
  // every role, including SUPER_ADMIN — no role can be granted a code that does
  // not exist. The legacy aliases are kept and still granted so existing gates
  // that fall back to them keep working.
  { code: "crm.customers.read",   module: "crm", action: "read",   description: "View customers list & detail" },
  { code: "crm.customers.create", module: "crm", action: "create", description: "Create customers" },
  { code: "crm.customers.update", module: "crm", action: "update", description: "Edit customer data" },
  { code: "crm.customers.delete", module: "crm", action: "delete", description: "Delete customers" },

  { code: "crm.leads.read",   module: "crm", action: "read",   description: "View leads & pipeline" },
  { code: "crm.leads.create", module: "crm", action: "create", description: "Create new leads" },
  { code: "crm.leads.update", module: "crm", action: "update", description: "Edit lead data, status changes" },
  { code: "crm.leads.delete", module: "crm", action: "delete", description: "Delete leads" },

  // CRM / Contacts (4)
  { code: "crm.contacts.read",      module: "crm", action: "read",     description: "View customer contacts (sub-list)" },
  { code: "crm.contacts.create",    module: "crm", action: "create",   description: "Add new customer contacts" },
  { code: "crm.contacts.update",    module: "crm", action: "update",   description: "Edit contact data / set primary" },
  { code: "crm.contacts.delete",    module: "crm", action: "delete",   description: "Remove contacts from a customer" },

  // CRM / Opportunities (5)
  { code: "crm.opportunities.read",    module: "crm", action: "read",     description: "View opportunity pipeline & stages" },
  { code: "crm.opportunities.create",  module: "crm", action: "create",   description: "Create new deals / opportunities" },
  { code: "crm.opportunities.update",  module: "crm", action: "update",   description: "Edit deal amount / expected close / assignment" },
  { code: "crm.opportunities.delete",  module: "crm", action: "delete",   description: "Delete opportunities" },
  { code: "crm.opportunities.stage",   module: "crm", action: "stage",    description: "Quick stage change PATCH /:id/stage (Kanban move)" },

  // CRM / Lead convert (1)
  { code: "crm.leads.convert",      module: "crm", action: "convert",  description: "Convert qualified lead → Customer + Opportunity $transaction" },

  // CRM / Activities (2 — append-only: read + create; never update/delete per §5 audit)
  { code: "crm.activities.read",    module: "crm", action: "read",     description: "View activity timeline on leads & customers" },
  { code: "crm.activities.create",  module: "crm", action: "create",   description: "Post activity CALL/EMAIL/NOTE/TASK/PROPOSAL_SENT" },

  // CRM / Contracts (4)
  { code: "crm.contracts.read",     module: "crm", action: "read",     description: "View customer contracts" },
  { code: "crm.contracts.create",   module: "crm", action: "create",   description: "Create new contracts (DRAFT)" },
  { code: "crm.contracts.update",   module: "crm", action: "update",   description: "Edit contract terms / dates / sign date" },
  { code: "crm.contracts.delete",   module: "crm", action: "delete",   description: "Delete contracts (DRAFT-only recommended)" },
];

function getCodesByPrefix(prefixes: string[]): string[] {
  const all = CRM_PERMISSIONS.map((p) => p.code);
  return all.filter((c) => prefixes.some((pfx) => c.startsWith(pfx)));
}

// Tiered role assignments. Phase 3 already set broad `crm` module permissions; here we add
// the granular phase5 codes. We RE-APPLY the full set (idempotent pattern) per phase3
// deleteMany + createMany convention per role.
const ADDITIONAL_ROLE_GRANTS: Record<RoleType, string[]> = {
  [RoleType.SUPER_ADMIN]: CRM_PERMISSIONS.map((p) => p.code),

  [RoleType.ADMIN]: CRM_PERMISSIONS.map((p) => p.code),

  [RoleType.MANAGER]: [
    ...getCodesByPrefix([
      "crm.customers.",
      "crm.leads.",
      "crm.contacts.",
      "crm.opportunities.",
      "crm.leads.convert",
      "crm.activities.",
      "crm.contracts.",
    ]),
  ],

  [RoleType.SALES]: [
    ...getCodesByPrefix(["crm.customers.", "crm.leads.", "crm.contacts."]),
    ...getCodesByPrefix(["crm.opportunities."]).filter((c) => c !== "crm.opportunities.delete"),
    "crm.leads.convert",
    ...getCodesByPrefix(["crm.activities."]),
    "crm.contracts.read",
    "crm.contracts.create",
  ],

  [RoleType.CASHIER]: [
    // Mirrors the legacy `customers.read` / `customers.create` the tier already had.
    "crm.customers.read",
    "crm.customers.create",
    "crm.contacts.read",
    "crm.activities.read",
    "crm.contracts.read",
  ],

  [RoleType.HR]: [],

  [RoleType.VIEWER]: [
    ...CRM_PERMISSIONS.filter((p) => p.action === "read").map((p) => p.code),
  ],
};

async function main() {
  console.log(`🌱 Phase 5 CRM seed: ${CRM_PERMISSIONS.length} permissions, 7 roles…`);

  for (const perm of CRM_PERMISSIONS) {
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
  console.log(`  ✔ CRM Permissions upserted: ${CRM_PERMISSIONS.length}`);

  for (const [roleType, codes] of Object.entries(ADDITIONAL_ROLE_GRANTS) as [RoleType, string[]][]) {
    const role = await prisma.role.findUnique({ where: { name: roleType } });
    if (!role) {
      console.warn(`  ⚠ Role not found: ${roleType} — skipping.`);
      continue;
    }
    const existing = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
      select: { permissionId: true, permission: { select: { code: true } } },
    });
    const existingCodes = new Set(existing.map((r) => r.permission.code));
    const toInsert = codes.filter((c) => !existingCodes.has(c));
    if (toInsert.length === 0) {
      console.log(`  ✔ Role '${roleType}': all phase5 codes already present.`);
      continue;
    }
    const permIds = await prisma.permission.findMany({
      where: { code: { in: toInsert } },
      select: { id: true },
    });
    await prisma.rolePermission.createMany({
      data: permIds.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
    console.log(`  ✔ Role '${roleType}' added ${permIds.length} new CRM granular permissions.`);
  }

  console.log("✅ Phase 5 CRM seed complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
