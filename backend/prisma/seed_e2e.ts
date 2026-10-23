/**
 * End-to-end test account.  ->  npm run seed:e2e
 *
 * Kept OUT of seed.ts on purpose: this user exists purely so the Playwright
 * suite (and CI) has a deterministic identity to log in with. Nobody wants an
 * `e2e@example.com` SUPER_ADMIN appearing in a production database, so it is
 * never part of the standard seed set.
 *
 * Two things make it deliberately different from the demo admin:
 *   - `mustChangePassword: false`. The demo admin is forced through
 *     /change-password on first login, which is correct product behaviour but
 *     a terrible automation target: the suite would have to change the shared
 *     password and every later run would break.
 *   - It owns an Employee record, and `User.employeeId` points at it. Nothing
 *     in the API or the UI writes that column, so without this seed the HRM
 *     self-service paths ("My Requests", self check-in/out) have no subject.
 *
 * Idempotent: safe to re-run. The password is reset on every run so a suite
 * that leaves the account in an unexpected state still recovers.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { RoleType } from "@prisma/client";

const E2E_USER = {
  email: process.env.E2E_ADMIN_EMAIL ?? "e2e@example.com",
  passwordPlain: process.env.E2E_ADMIN_PASSWORD ?? "E2eAdmin@123",
  firstName: "End",
  lastName: "ToEnd",
} as const;

const E2E_EMPLOYEE_CODE = "E2E-EMP-001";

async function main() {
  console.log("🌱 Seeding E2E account...");

  const superRole = await prisma.role.findUnique({ where: { name: RoleType.SUPER_ADMIN } });
  if (!superRole) {
    throw new Error("SUPER_ADMIN role is missing — run `npm run seed` first.");
  }

  const department = await prisma.department.findUnique({ where: { code: "ADMIN" }, select: { id: true } });
  const designation = await prisma.designation.findUnique({ where: { code: "MGR" }, select: { id: true } });

  const employee = await prisma.employee.upsert({
    where: { employeeCode: E2E_EMPLOYEE_CODE },
    update: { firstName: E2E_USER.firstName, lastName: E2E_USER.lastName, status: "ACTIVE" },
    create: {
      employeeCode: E2E_EMPLOYEE_CODE,
      firstName: E2E_USER.firstName,
      lastName: E2E_USER.lastName,
      email: E2E_USER.email,
      joiningDate: new Date("2024-01-01"),
      departmentId: department?.id ?? null,
      designationId: designation?.id ?? null,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  const passwordHash = await bcrypt.hash(E2E_USER.passwordPlain, 10);
  const user = await prisma.user.upsert({
    where: { email: E2E_USER.email },
    update: {
      passwordHash,
      roleId: superRole.id,
      status: "ACTIVE",
      // The whole point of this account: no forced rotation.
      mustChangePassword: false,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorRecoveryCodes: [],
      employeeId: employee.id,
    },
    create: {
      email: E2E_USER.email,
      firstName: E2E_USER.firstName,
      lastName: E2E_USER.lastName,
      passwordHash,
      status: "ACTIVE",
      mustChangePassword: false,
      roleId: superRole.id,
      employeeId: employee.id,
    },
  });

  console.log(`  ✅ ${user.email} — SUPER_ADMIN, no forced password change, employee ${E2E_EMPLOYEE_CODE}`);
  console.log(`  ✅ Password: ${E2E_USER.passwordPlain}`);
}

main()
  .catch((e) => {
    console.error("❌ seed_e2e FAILED:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
