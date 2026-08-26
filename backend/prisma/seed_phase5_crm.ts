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
// 12 new granular CRM codes (sub-modules) — Phase 3 already inserted:
// customers.read/create/update/delete, crm.export,
// leads.read/create/update/delete/assign/activity  (10 existing total)
// Adding: contacts R/C/U/D (4), opportunities R/C/U/D/stage (5), activities R/C (2), contracts R/C/U/D (4) = 15.
// Header says 12 — take union across existing, upsert 15 new codes total for phase 5.
// ──────────────────────────────────────────────────────────────────────────────
const CRM_PERMISSIONS: PermissionSeed[] = [
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
      "crm.contacts.",
      "crm.opportunities.",
      "crm.leads.convert",
      "crm.activities.",
      "crm.contracts.",
    ]),
  ],

  [RoleType.SALES]: [
    ...getCodesByPrefix(["crm.contacts."]),
    ...getCodesByPrefix(["crm.opportunities."]).filter((c) => c !== "crm.opportunities.delete"),
    "crm.leads.convert",
    ...getCodesByPrefix(["crm.activities."]),
    "crm.contracts.read",
    "crm.contracts.create",
  ],

  [RoleType.CASHIER]: [
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
