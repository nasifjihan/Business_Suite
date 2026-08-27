import { prisma } from "../src/lib/prisma";

type PermRow = {
  code: string;
  module: string;
  action: string;
  description: string;
};

const HRM_PERMISSIONS: PermRow[] = [
  { code: "hrm.departments.read", module: "HRM", action: "read", description: "View departments list and details" },
  { code: "hrm.departments.create", module: "HRM", action: "create", description: "Create new departments" },
  { code: "hrm.departments.update", module: "HRM", action: "update", description: "Update departments" },
  { code: "hrm.departments.delete", module: "HRM", action: "delete", description: "Delete / deactivate departments" },

  { code: "hrm.designations.read", module: "HRM", action: "read", description: "View designations list and details" },
  { code: "hrm.designations.create", module: "HRM", action: "create", description: "Create new designations" },
  { code: "hrm.designations.update", module: "HRM", action: "update", description: "Update designations" },
  { code: "hrm.designations.delete", module: "HRM", action: "delete", description: "Delete / deactivate designations" },

  { code: "hrm.employees.read", module: "HRM", action: "read", description: "View employee directory (salary redacted unless update granted)" },
  { code: "hrm.employees.create", module: "HRM", action: "create", description: "Onboard new employees" },
  { code: "hrm.employees.update", module: "HRM", action: "update", description: "Edit employee records (includes salary access)" },
  { code: "hrm.employees.delete", module: "HRM", action: "delete", description: "Terminate / soft delete employees" },

  { code: "hrm.attendance.read", module: "HRM", action: "read", description: "View own attendance records" },
  { code: "hrm.attendance.read_all", module: "HRM", action: "read_all", description: "View all employees attendance" },
  { code: "hrm.attendance.self_check", module: "HRM", action: "self_check", description: "Check in and out yourself" },
  { code: "hrm.attendance.create", module: "HRM", action: "create", description: "Mark attendance on behalf of employees" },
  { code: "hrm.attendance.update", module: "HRM", action: "update", description: "Edit attendance records" },
  { code: "hrm.attendance.delete", module: "HRM", action: "delete", description: "Remove attendance records" },

  { code: "hrm.leave_types.read", module: "HRM", action: "read", description: "View leave types catalog" },
  { code: "hrm.leave_types.create", module: "HRM", action: "create", description: "Create leave types" },
  { code: "hrm.leave_types.update", module: "HRM", action: "update", description: "Update leave types" },
  { code: "hrm.leave_types.delete", module: "HRM", action: "delete", description: "Delete leave types" },

  { code: "hrm.leave.read", module: "HRM", action: "read", description: "View own leave requests" },
  { code: "hrm.leave.read_all", module: "HRM", action: "read_all", description: "View all employees leave requests" },
  { code: "hrm.leave.create", module: "HRM", action: "create", description: "Submit new leave request" },
  { code: "hrm.leave.approve", module: "HRM", action: "approve", description: "Approve or reject leave requests" },
  { code: "hrm.leave.cancel", module: "HRM", action: "cancel", description: "Cancel own pending leave request" },
  { code: "hrm.leave.update", module: "HRM", action: "update", description: "Edit leave records (admin)" },
  { code: "hrm.leave.delete", module: "HRM", action: "delete", description: "Delete leave records (admin)" },
];

const GRANT_BY_ROLE: Record<string, string[]> = {
  SUPER_ADMIN: HRM_PERMISSIONS.map((p) => p.code),
  ADMIN: HRM_PERMISSIONS.map((p) => p.code),
  HR: HRM_PERMISSIONS.map((p) => p.code),
  MANAGER: [
    "hrm.departments.read",
    "hrm.designations.read",
    "hrm.employees.read",
    "hrm.attendance.read_all",
    "hrm.attendance.create",
    "hrm.leave_types.read",
    "hrm.leave.read_all",
    "hrm.leave.approve",
    "hrm.leave.cancel",
  ],
  SALES: [
    "hrm.attendance.read",
    "hrm.attendance.self_check",
    "hrm.leave_types.read",
    "hrm.leave.read",
    "hrm.leave.create",
    "hrm.leave.cancel",
  ],
  CASHIER: [
    "hrm.attendance.read",
    "hrm.attendance.self_check",
    "hrm.leave_types.read",
    "hrm.leave.read",
    "hrm.leave.create",
    "hrm.leave.cancel",
  ],
  VIEWER: [
    "hrm.departments.read",
    "hrm.designations.read",
    "hrm.employees.read",
    "hrm.attendance.read",
    "hrm.leave_types.read",
    "hrm.leave.read",
  ],
};

async function main() {
  console.log(`[hrm-seed] Upserting ${HRM_PERMISSIONS.length} hrm.* permission codes (additive only — no delete)...`);
  for (const perm of HRM_PERMISSIONS) {
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
  for (const perm of HRM_PERMISSIONS) {
    const p = await prisma.permission.findUnique({ where: { code: perm.code }, select: { id: true, code: true } });
    if (p) byCode[p.code] = p.id;
  }

  console.log(`[hrm-seed] Applying role grants (additive createMany skipDuplicates)...`);
  for (const roleName of Object.keys(GRANT_BY_ROLE)) {
    const roleId = byName[roleName];
    if (!roleId) {
      console.warn(`  ⚠ role ${roleName} not found in DB RoleType enum — skipping grants`);
      continue;
    }
    const codes = GRANT_BY_ROLE[roleName];
    const rows = codes
      .filter((c) => byCode[c])
      .map((code) => ({ roleId, permissionId: byCode[code] }));
    if (rows.length === 0) continue;
    await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true });
    console.log(`  ✅ ${roleName}: ${rows.length} hrm.* codes granted (additive; existing untouched)`);
  }

  console.log(`\n✅ Phase 8 HRM seed complete. ${HRM_PERMISSIONS.length} codes; 7 role tiers applied. Re-login to refresh JWT permissions!`);
}

main()
  .catch((e) => {
    console.error("❌ seed_phase8_hrm failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
