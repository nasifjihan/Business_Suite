import type { PrismaClient, RoleType, User } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { CONFIG } from '@/config/env';
import { prisma as prismaSingleton } from '@/lib/prisma';

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.refund.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.stockMovement.deleteMany(),
    prisma.stock.deleteMany(),
    prisma.leadActivity.deleteMany(),
    prisma.activity.deleteMany(),
    prisma.contact.deleteMany(),
    prisma.opportunity.deleteMany(),
    prisma.contract.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.warehouse.deleteMany(),
    prisma.attendance.deleteMany(),
    prisma.leaveRequest.deleteMany(),
    prisma.employee.deleteMany(),
    prisma.designation.deleteMany(),
    prisma.department.deleteMany(),
    prisma.leaveType.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.user.deleteMany(),
    prisma.role.deleteMany(),
    prisma.permission.deleteMany(),
  ]);
}

export interface CreateTestUserInput {
  email?: string;
  password?: string;
  roleName?: RoleType;
  firstName?: string;
  lastName?: string;
}

export async function createTestUser(
  prisma: PrismaClient = prismaSingleton,
  input: CreateTestUserInput = {},
): Promise<User> {
  const {
    email = 'test@example.com',
    roleName = 'ADMIN',
    firstName = 'Test',
    lastName = 'User',
  } = input;

  const role = await prisma.role.upsert({
    where: { name: roleName },
    create: {
      name: roleName,
      displayName: roleName.charAt(0) + roleName.slice(1).toLowerCase().replace('_', ' '),
      isSystem: true,
    },
    update: {},
  });

  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    create: {
      email: email.toLowerCase(),
      passwordHash: '$2a$10$FIXEDSALTFIXEDSALTFIXEDSALTFIXEDSALTFIXEDSALTfixe1234',
      firstName,
      lastName,
      roleId: role.id,
      status: 'ACTIVE',
      mustChangePassword: false,
    },
    update: {
      roleId: role.id,
      status: 'ACTIVE',
    },
  });

  return user;
}

export function createTestJwt(
  userId: string,
  permissions: string[] = [],
  roleName: RoleType = 'ADMIN',
): string {
  const jti = randomUUID();
  const payload = {
    sub: userId,
    roleId: '00000000-0000-0000-0000-000000000000',
    role: roleName,
    jti,
    type: 'access' as const,
    permissions,
  };
  return jwt.sign(payload, CONFIG.jwt.accessSecret, {
    expiresIn: '1h',
  });
}

const ROLE_DISPLAY_NAMES: Record<RoleType, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  SALES: 'Sales',
  CASHIER: 'Cashier',
  HR: 'HR',
  VIEWER: 'Viewer',
};

const BASE_PERMISSIONS = [
  'dashboard.read',
  'crm.customers.read',
  'crm.customers.create',
  'crm.customers.update',
  'crm.customers.delete',
  'crm.leads.read',
  'crm.leads.create',
  'inventory.products.read',
  'inventory.products.create',
  'inventory.products.update',
  'inventory.products.delete',
  'inventory.warehouses.read',
  'inventory.warehouses.create',
  'inventory.stock.read',
  'inventory.stock.create',
  'inventory.stockMovements.read',
  'inventory.stockMovements.create',
  'sales.orders.read',
  'sales.orders.create',
  'sales.orders.update',
  'sales.orders.delete',
  'sales.payments.read',
  'sales.payments.create',
  'sales.refunds.read',
  'sales.refunds.create',
  'hrm.employees.read',
  'hrm.employees.read_all',
  'hrm.employees.create',
  'hrm.employees.update',
  'hrm.employees.delete',
  'hrm.attendance.read',
  'hrm.attendance.read_all',
  'hrm.attendance.create',
  'hrm.attendance.update',
  'hrm.attendance.self_check',
  'hrm.leave.read',
  'hrm.leave.read_all',
  'hrm.leave.create',
  'hrm.leave.update',
  'hrm.leave.approve',
  'hrm.departments.read',
  'hrm.designations.read',
  'users.read',
  'users.create',
  'roles.read',
  'permissions.read',
  'auditLogs.read',
];

const VIEWER_PERMISSIONS = [
  'dashboard.read',
  'crm.customers.read',
  'crm.leads.read',
  'inventory.products.read',
  'inventory.warehouses.read',
  'inventory.stock.read',
  'sales.orders.read',
  'hrm.employees.read',
  'hrm.attendance.read',
  'hrm.leave.read',
];

export interface SeededUsers {
  superAdmin: User;
  admin: User;
  hr: User;
  sales: User;
  cashier: User;
  manager: User;
  viewer: User;
}

export async function seedBaseline(
  prisma: PrismaClient = prismaSingleton,
): Promise<SeededUsers> {
  const roleNames: RoleType[] = ['SUPER_ADMIN', 'ADMIN', 'HR', 'SALES', 'CASHIER', 'MANAGER', 'VIEWER'];

  const permissionCodes = Array.from(new Set([...BASE_PERMISSIONS, ...VIEWER_PERMISSIONS]));

  const { permissions } = await prisma.$transaction(async (tx) => {
    const permissions = await Promise.all(
      permissionCodes.map(async (code) => {
        const [module, action] = code.split('.');
        return tx.permission.upsert({
          where: { code },
          create: {
            code,
            module: module || 'general',
            action: action || 'read',
          },
          update: {},
        });
      }),
    );

    await Promise.all(
      roleNames.map(async (name) => {
        const displayName = ROLE_DISPLAY_NAMES[name];
        const isViewer = name === 'VIEWER';
        const permsToAssign = isViewer ? VIEWER_PERMISSIONS : BASE_PERMISSIONS;

        const role = await tx.role.upsert({
          where: { name },
          create: { name, displayName, isSystem: true },
          update: { displayName },
        });

        for (const code of permsToAssign) {
          const perm = permissions.find((p) => p.code === code);
          if (perm) {
            await tx.rolePermission.upsert({
              where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
              create: { roleId: role.id, permissionId: perm.id },
              update: {},
            });
          }
        }
        return role;
      }),
    );

    return { permissions };
  });

  const superAdmin = await createTestUser(prisma, {
    email: 'superadmin@test.com',
    roleName: 'SUPER_ADMIN',
    firstName: 'Super',
    lastName: 'Admin',
  });
  const admin = await createTestUser(prisma, {
    email: 'admin@test.com',
    roleName: 'ADMIN',
    firstName: 'Admin',
    lastName: 'User',
  });
  const hr = await createTestUser(prisma, {
    email: 'hr@test.com',
    roleName: 'HR',
    firstName: 'HR',
    lastName: 'User',
  });
  const sales = await createTestUser(prisma, {
    email: 'sales@test.com',
    roleName: 'SALES',
    firstName: 'Sales',
    lastName: 'User',
  });
  const cashier = await createTestUser(prisma, {
    email: 'cashier@test.com',
    roleName: 'CASHIER',
    firstName: 'Cashier',
    lastName: 'User',
  });
  const manager = await createTestUser(prisma, {
    email: 'manager@test.com',
    roleName: 'MANAGER',
    firstName: 'Manager',
    lastName: 'User',
  });
  const viewer = await createTestUser(prisma, {
    email: 'viewer@test.com',
    roleName: 'VIEWER',
    firstName: 'Viewer',
    lastName: 'User',
  });

  return { superAdmin, admin, hr, sales, cashier, manager, viewer };
}
