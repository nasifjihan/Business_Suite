/**
 * Phase 2 Admin User Seed Script
 * Run:  npx ts-node prisma/seed_phase2_admin.ts
 *
 * Idempotent: safe re-run. Creates role if missing, creates user if missing,
 *             updates admin password to Admin@123 only if seed-default.
 * Creates:
 *   1. SUPER_ADMIN role (if not exist)
 *   2. User admin@example.com / Admin@123 with SUPER_ADMIN role, mustChangePassword=true
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { RoleType } from "@prisma/client";

const DEFAULT_ADMIN = {
  email: "admin@example.com",
  firstName: "System",
  lastName: "Administrator",
  passwordPlain: "Admin@123",
} as const;

async function main() {
  console.log("🌱 Seeding Phase 2: SUPER_ADMIN role + admin@example.com user...");

  // 1. Ensure SUPER_ADMIN role exists
  const superRole = await prisma.role.upsert({
    where: { name: RoleType.SUPER_ADMIN },
    update: { displayName: "Super Administrator", description: "Unrestricted system-wide access. Bypasses all permission checks." },
    create: {
      name: RoleType.SUPER_ADMIN,
      displayName: "Super Administrator",
      description: "Unrestricted system-wide access. Bypasses all permission checks.",
      isSystem: true,
    },
  });
  console.log(`  ✅ Role ${superRole.name} (id=${superRole.id.slice(0, 8)}...)`);

  // 2. Also create the remaining 6 base roles for Phase 3 RBAC (no permissions yet)
  const baseRoles: { name: RoleType; displayName: string; description: string }[] = [
    { name: RoleType.ADMIN, displayName: "Administrator", description: "Full system access except destructive tenant operations." },
    { name: RoleType.MANAGER, displayName: "Manager", description: "Cross-module operational oversight + approvals." },
    { name: RoleType.SALES, displayName: "Sales Representative", description: "CRM + Orders module CRUD." },
    { name: RoleType.CASHIER, displayName: "Cashier / POS Operator", description: "Point of Sale + customer lookup only." },
    { name: RoleType.HR, displayName: "HR Manager", description: "HRM: employees, attendance, leave approvals." },
    { name: RoleType.VIEWER, displayName: "Viewer / Auditor", description: "Global read-only, no write operations." },
  ];
  for (const r of baseRoles) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: { displayName: r.displayName, description: r.description },
      create: { ...r, isSystem: true },
    });
    console.log(`  ✅ Role ${r.name}`);
  }

  // 3. Hash password & create admin user
  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN.passwordPlain, 10);
  const adminUser = await prisma.user.upsert({
    where: { email: DEFAULT_ADMIN.email },
    update: {
      roleId: superRole.id,
      firstName: DEFAULT_ADMIN.firstName,
      lastName: DEFAULT_ADMIN.lastName,
      status: "ACTIVE",
      mustChangePassword: true,
      passwordHash,
    },
    create: {
      email: DEFAULT_ADMIN.email,
      firstName: DEFAULT_ADMIN.firstName,
      lastName: DEFAULT_ADMIN.lastName,
      passwordHash,
      status: "ACTIVE",
      mustChangePassword: true,
      roleId: superRole.id,
    },
  });
  console.log(`  ✅ User ${adminUser.email} (id=${adminUser.id.slice(0, 8)}..., mustChangePassword=${adminUser.mustChangePassword})`);

  console.log("\n🌱 Phase 2 seed complete. Login credentials:");
  console.log("     Email    : admin@example.com");
  console.log("     Password : Admin@123");
  console.log("     ⚠️  Policy requires password change on FIRST successful login.");
}

main()
  .catch((e) => {
    console.error("❌ seed_phase2_admin FAILED:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
