import { prisma } from "../src/lib/prisma";

type PermRow = {
  code: string;
  module: string;
  action: string;
  description: string;
};

const DASHBOARD_PERMISSIONS: PermRow[] = [
  { code: "dashboard.read", module: "DASHBOARD", action: "read", description: "View dashboard KPIs and charts" },
];

const ALL_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "HR",
  "MANAGER",
  "SALES",
  "CASHIER",
  "VIEWER",
];

async function main() {
  console.log(`[dashboard-seed] Upserting ${DASHBOARD_PERMISSIONS.length} dashboard.* permission codes (additive only — no delete)...`);
  for (const perm of DASHBOARD_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {
        module: perm.module,
        action: perm.action,
        description: perm.description ?? undefined,
      },
      create: {
        code: perm.code,
        module: perm.module,
        action: perm.action,
        description: perm.description,
      },
    });
  }

  const roleList = await prisma.role.findMany({ select: { id: true, name: true } });
  const byName: Record<string, string> = {};
  for (const r of roleList) byName[String(r.name)] = r.id;

  const byCode: Record<string, string> = {};
  for (const perm of DASHBOARD_PERMISSIONS) {
    const p = await prisma.permission.findUnique({ where: { code: perm.code }, select: { id: true, code: true } });
    if (p) byCode[p.code] = p.id;
  }

  console.log(`[dashboard-seed] Applying role grants (additive createMany skipDuplicates)...`);
  for (const roleName of ALL_ROLES) {
    const roleId = byName[roleName];
    if (!roleId) {
      console.warn(`  ⚠ role ${roleName} not found in DB RoleType enum — skipping grants`);
      continue;
    }
    const codes = DASHBOARD_PERMISSIONS.map((p) => p.code);
    const rows = codes
      .filter((c) => byCode[c])
      .map((code) => ({ roleId, permissionId: byCode[code] }));
    if (rows.length === 0) continue;
    await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true });
    console.log(`  ✅ ${roleName}: ${rows.length} dashboard.* codes granted (additive; existing untouched)`);
  }

  console.log(`\n✅ Phase 9 Dashboard seed complete. ${DASHBOARD_PERMISSIONS.length} codes; 7 role tiers applied. Re-login to refresh JWT permissions!`);
}

main()
  .catch((e) => {
    console.error("❌ seed_phase9_dashboard failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
