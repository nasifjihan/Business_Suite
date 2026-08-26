/**
 * Phase 6 seed:
 *   - Insert 15 granular inventory permissions (inventory.* sub-module codes)
 *   - Assign tiered grants to all 7 roles.
 *   - Idempotent additive: no deleteMany; diff existing perms then insert missing;
 *     diff existing RolePermission pairs then insert missing grants.
 *
 * Run AFTER schema changes & prisma generate.
 *   npx ts-node prisma/seed_phase6_inventory.ts
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
// 15 granular Inventory codes (sub-modules with inventory.* prefix):
//   inventory.categories  R/C/U/D (4)
//   inventory.products    R/C/U/D (4)
//   inventory.warehouses  R/C/U/D (4)
//   inventory.stock       R       (1)
//   inventory.movements   R/C     (2)
// ──────────────────────────────────────────────────────────────────────────────
const INVENTORY_PERMISSIONS: PermissionSeed[] = [
  // Inventory / Categories (4)
  { code: "inventory.categories.read",   module: "inventory", action: "read",   description: "View product categories" },
  { code: "inventory.categories.create", module: "inventory", action: "create", description: "Create product categories" },
  { code: "inventory.categories.update", module: "inventory", action: "update", description: "Edit product categories" },
  { code: "inventory.categories.delete", module: "inventory", action: "delete", description: "Delete product categories" },

  // Inventory / Products (4)
  { code: "inventory.products.read",   module: "inventory", action: "read",   description: "View products, SKUs & pricing" },
  { code: "inventory.products.create", module: "inventory", action: "create", description: "Create new product records" },
  { code: "inventory.products.update", module: "inventory", action: "update", description: "Edit products, prices, images" },
  { code: "inventory.products.delete", module: "inventory", action: "delete", description: "Delete product records" },

  // Inventory / Warehouses (4)
  { code: "inventory.warehouses.read",   module: "inventory", action: "read",   description: "View warehouses & locations" },
  { code: "inventory.warehouses.create", module: "inventory", action: "create", description: "Create warehouse records" },
  { code: "inventory.warehouses.update", module: "inventory", action: "update", description: "Edit warehouse details" },
  { code: "inventory.warehouses.delete", module: "inventory", action: "delete", description: "Delete warehouses" },

  // Inventory / Stock (1)
  { code: "inventory.stock.read", module: "inventory", action: "read", description: "View stock on hand per warehouse" },

  // Inventory / Movements (2)
  { code: "inventory.movements.read",   module: "inventory", action: "read",   description: "View stock movement history (transfers/adjustments)" },
  { code: "inventory.movements.create", module: "inventory", action: "create", description: "Record stock movements (in/out/transfer/adjust)" },
];

const ALL_INVENTORY_CODES = INVENTORY_PERMISSIONS.map((p) => p.code);

// ──────────────────────────────────────────────────────────────────────────────
// Tiered role → inventory code grants (7 roles)
// ──────────────────────────────────────────────────────────────────────────────
const ROLE_GRANTS: Record<RoleType, string[]> = {
  [RoleType.SUPER_ADMIN]: ALL_INVENTORY_CODES,

  [RoleType.ADMIN]: ALL_INVENTORY_CODES,

  [RoleType.MANAGER]: ALL_INVENTORY_CODES,

  [RoleType.SALES]: [
    "inventory.categories.read",
    "inventory.products.read",
    "inventory.warehouses.read",
    "inventory.stock.read",
  ],

  [RoleType.CASHIER]: [
    "inventory.products.read",
  ],

  [RoleType.HR]: [],

  [RoleType.VIEWER]: [
    "inventory.categories.read",
    "inventory.products.read",
    "inventory.warehouses.read",
    "inventory.stock.read",
    "inventory.movements.read",
  ],
};

async function main() {
  console.log(`🌱 Phase 6 Inventory seed: ${INVENTORY_PERMISSIONS.length} permissions, 7 roles…`);

  // ── Step 1: Idempotent permission insert (additive — no deletes) ──
  const existingPerms = await prisma.permission.findMany({
    where: { code: { in: ALL_INVENTORY_CODES } },
    select: { code: true },
  });
  const existingCodes = new Set(existingPerms.map((p) => p.code));
  const permsToInsert = INVENTORY_PERMISSIONS.filter((p) => !existingCodes.has(p.code));

  if (permsToInsert.length > 0) {
    await prisma.permission.createMany({
      data: permsToInsert,
      skipDuplicates: true,
    });
    console.log(`  ✔ Inventory permissions seeded: ${permsToInsert.length} new codes`);
  } else {
    console.log(`  ✔ Inventory permissions already present: ${ALL_INVENTORY_CODES.length} codes`);
  }

  // ── Step 2: Idempotent RolePermission grants (additive — no deletes) ──
  const roleNames = Object.keys(ROLE_GRANTS) as RoleType[];
  const roles = await prisma.role.findMany({
    where: { name: { in: roleNames } },
    select: { id: true, name: true },
  });
  const roleByName = new Map(roles.map((r) => [r.name, r.id]));

  // Fetch ALL inventory permission ids (we need them for grants)
  const allInventoryPermRows = await prisma.permission.findMany({
    where: { code: { in: ALL_INVENTORY_CODES } },
    select: { id: true, code: true },
  });
  const permIdByCode = new Map(allInventoryPermRows.map((p) => [p.code, p.id]));

  // Existing RolePermissions: filter by our 7 roles + inventory permission ids
  const inventoryPermIds = allInventoryPermRows.map((p) => p.id);
  const roleIds = roles.map((r) => r.id);
  const existingRolePerms = await prisma.rolePermission.findMany({
    where: {
      roleId: { in: roleIds },
      permissionId: { in: inventoryPermIds },
    },
    select: { roleId: true, permissionId: true },
  });
  const existingGrantKeys = new Set(
    existingRolePerms.map((rp) => `${rp.roleId}|${rp.permissionId}`)
  );

  // Per-role diff and additive insert
  for (const [roleType, codes] of Object.entries(ROLE_GRANTS) as [RoleType, string[]][]) {
    const roleId = roleByName.get(roleType);
    if (!roleId) {
      console.warn(`  ⚠ Role not found: ${roleType} — skipping.`);
      continue;
    }

    if (codes.length === 0) {
      console.log(`  ✔ Role '${roleType}': no inventory grants (empty set).`);
      continue;
    }

    const grantsToInsert: { roleId: string; permissionId: string }[] = [];
    for (const code of codes) {
      const permId = permIdByCode.get(code);
      if (!permId) continue;
      const key = `${roleId}|${permId}`;
      if (!existingGrantKeys.has(key)) {
        grantsToInsert.push({ roleId, permissionId: permId });
      }
    }

    if (grantsToInsert.length === 0) {
      console.log(`  ✔ Role '${roleType}': all ${codes.length} inventory grants already present.`);
    } else {
      await prisma.rolePermission.createMany({
        data: grantsToInsert,
        skipDuplicates: true,
      });
      console.log(`  ✔ Role '${roleType}': added ${grantsToInsert.length} new inventory grants (pre-existing: ${codes.length - grantsToInsert.length}).`);
    }
  }

  console.log("✅ Phase 6 Inventory seed complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
