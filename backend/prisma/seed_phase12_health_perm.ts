#!/usr/bin/env ts-node
import { prisma } from "../src/lib/prisma";
import { RoleType } from "@prisma/client";

type PermRow = {
  code: string;
  module: string;
  action: string;
  description: string;
};

const HEALTH_PERMISSIONS: PermRow[] = [
  {
    code: "system.health.read",
    module: "SYSTEM",
    action: "read",
    description: "Read backend uptime & DB connectivity status",
  },
];

const ALL_ROLES: RoleType[] = [
  RoleType.SUPER_ADMIN,
  RoleType.ADMIN,
  RoleType.MANAGER,
  RoleType.HR,
  RoleType.SALES,
  RoleType.CASHIER,
  RoleType.VIEWER,
];

async function main() {
  console.log(
    `[health-seed] Upserting ${HEALTH_PERMISSIONS.length} system.health.* permission codes (additive only — no delete)...`
  );
  for (const perm of HEALTH_PERMISSIONS) {
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

  const roleList = await prisma.role.findMany({
    where: { name: { in: ALL_ROLES } },
    select: { id: true, name: true },
  });
  const byName: Record<string, string> = {};
  for (const r of roleList) byName[String(r.name)] = r.id;

  const byCode: Record<string, string> = {};
  for (const perm of HEALTH_PERMISSIONS) {
    const p = await prisma.permission.findUnique({
      where: { code: perm.code },
      select: { id: true, code: true },
    });
    if (p) byCode[p.code] = p.id;
  }

  console.log(
    `[health-seed] Applying role grants (additive createMany skipDuplicates)...`
  );
  const rows: { roleId: string; permissionId: string }[] = [];
  for (const roleName of ALL_ROLES) {
    const roleId = byName[roleName];
    if (!roleId) {
      console.warn(
        `  Warning: role ${roleName} not found in DB RoleType enum — skipping grants`
      );
      continue;
    }
    const codes = HEALTH_PERMISSIONS.map((p) => p.code);
    const roleRows = codes
      .filter((c) => byCode[c])
      .map((code) => ({ roleId, permissionId: byCode[code] }));
    rows.push(...roleRows);
  }
  if (rows.length > 0) {
    await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true });
  }

  console.log(`Done 1 perm, 7 rows.`);
}

main()
  .catch((e) => {
    console.error("seed_phase12_health_perm failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
