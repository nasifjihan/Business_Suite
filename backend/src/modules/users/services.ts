import type { Request } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { CreateUserDto, ListUsersQuery, UpdateUserDto } from "./validators";
import { UserStatus } from "@prisma/client";
import { AuditAction } from "@prisma/client";
import {
  applyPagination,
  buildPaginationMeta,
} from "@/utils/pagination";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import { omitSensitive, writeAudit, extractMeta } from "@/middleware/audit";
import { hashPassword } from "@/utils/password";

const SENSITIVE_OMIT = {
  passwordHash: true,
} as const;

export type ListUsersResponse = Awaited<ReturnType<typeof UserService["list"]>>;

export const UserService = {
  async list(q: ListUsersQuery) {
    const where: Record<string, unknown> = {};
    if (q.search) {
      where.OR = [
        { firstName: { contains: q.search, mode: "insensitive" } },
        { lastName: { contains: q.search, mode: "insensitive" } },
        { email: { contains: q.search, mode: "insensitive" } },
      ];
    }
    if (q.status) where.status = q.status;
    if (q.roleId) where.roleId = q.roleId;

    const orderBy: Record<string, unknown> = q.sortBy
      ? { [q.sortBy]: q.sortOrder }
      : { createdAt: q.sortOrder };

    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const [totalItems, items] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy,
        omit: SENSITIVE_OMIT,
        include: {
          role: { select: { id: true, name: true, displayName: true } },
        },
      }),
    ]);

    return { items, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },

  async create(dto: CreateUserDto, req: Request) {
    // 1. Email duplicate check
    const existing = await prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new ConflictError("A user with this email already exists.");

    // 2. Verify role exists
    const role = await prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) throw new NotFoundError("Role not found.");

    // 3. Generate a random 16-char strong password (shown ONCE to admin in response).
    const tempPassword =
      crypto.randomBytes(10).toString("base64url").slice(0, 8) +
      "A1!" +
      crypto.randomBytes(4).toString("base64url").replace(/[^A-Za-z0-9]/g, "").slice(0, 6);
    const passwordHash = await hashPassword(tempPassword);

    const meta = extractMeta(req);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email.toLowerCase(),
          passwordHash,
          roleId: dto.roleId,
          phone: dto.phone || null,
          avatarUrl: dto.avatarUrl || null,
          mustChangePassword: true,
          status: UserStatus.ACTIVE,
        },
        omit: SENSITIVE_OMIT,
        include: {
          role: { select: { id: true, name: true, displayName: true } },
        },
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.CREATE,
        entityType: "User",
        entityId: user.id,
        afterData: omitSensitive(user),
        ip: meta.ip,
        ua: meta.ua,
      });
      return user;
    });

    // return temp password ONCE — caller must display banner in UI and never save it
    return { user: created, tempPassword };
  },

  async update(id: string, dto: UpdateUserDto, req: Request) {
    if (dto.email && dto.email.toLowerCase() !== dto.email) dto.email = dto.email.toLowerCase();

    const meta = extractMeta(req);

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({
        where: { id },
        omit: SENSITIVE_OMIT,
        include: {
          role: { select: { id: true, name: true, displayName: true } },
        },
      });
      if (!before) throw new NotFoundError("User not found.");

      if (dto.email && dto.email !== before.email) {
        const dup = await tx.user.findUnique({ where: { email: dto.email } });
        if (dup) throw new ConflictError("A user with this email already exists.");
      }
      if (dto.roleId && dto.roleId !== before.roleId) {
        const r = await tx.role.findUnique({ where: { id: dto.roleId } });
        if (!r) throw new NotFoundError("Role not found.");
      }

      const data: Record<string, unknown> = {};
      for (const k of ["firstName", "lastName", "email", "roleId", "phone", "avatarUrl", "status", "mustChangePassword"] as const) {
        if ((dto as Record<string, unknown>)[k] !== undefined) data[k] = (dto as Record<string, unknown>)[k];
      }
      if (Object.keys(data).length === 0) {
        return before;
      }

      const after = await tx.user.update({
        where: { id },
        data,
        omit: SENSITIVE_OMIT,
        include: {
          role: { select: { id: true, name: true, displayName: true } },
        },
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "User",
        entityId: after.id,
        beforeData: omitSensitive(before),
        afterData: omitSensitive(after),
        ip: meta.ip,
        ua: meta.ua,
      });

      // Deactivation → logout all existing sessions by revoking refresh tokens
      if (dto.status === UserStatus.INACTIVE && before.status !== UserStatus.INACTIVE) {
        await tx.refreshToken.updateMany({
          where: { userId: after.id, revokedAt: null },
          data: { revokedAt: new Date(), isFamilyRevoked: true },
        });
      }

      return after;
    });

    return updated;
  },

  async setStatus(id: string, newStatus: UserStatus, req: Request) {
    return UserService.update(id, { status: newStatus }, req);
  },

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      omit: SENSITIVE_OMIT,
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: { select: { code: true } } },
            },
          },
        },
      },
    });
    if (!user) throw new NotFoundError("User not found.");
    const permissions =
      user.role?.permissions?.map((rp) => rp.permission.code).filter(Boolean) ?? [];
    const { role, ...rest } = user as unknown as {
      role: typeof user.role & { permissions?: { permission: { code: string } }[] };
    };
    return {
      user: {
        ...rest,
        id: user.id,
        role: role?.name ?? null,
        roleId: role?.id ?? null,
        roleDisplayName: role?.displayName ?? null,
      } as unknown as Record<string, unknown>,
      permissions,
    };
  },

  async changeOwnPassword(
    userId: string,
    dto: { currentPassword: string; newPassword: string },
    req: Request,
  ) {
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestError("New password must differ from current password.");
    }
    const meta = extractMeta(req);

    await prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({ where: { id: userId } });
      if (!before) throw new NotFoundError("User not found.");
      const match = await bcrypt.compare(dto.currentPassword, before.passwordHash);
      if (!match) throw new BadRequestError("Current password is incorrect.");
      const newHash = await hashPassword(dto.newPassword);
      const after = await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newHash, mustChangePassword: false },
        omit: SENSITIVE_OMIT,
      });
      // Invalidate all refresh sessions: user must re-login on other devices
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), isFamilyRevoked: true },
      });
      await writeAudit(tx, {
        userId,
        action: AuditAction.UPDATE,
        entityType: "User",
        entityId: userId,
        beforeData: { passwordChanged: false },
        afterData: { passwordChanged: true, mustChangePassword: after.mustChangePassword },
        ip: meta.ip,
        ua: meta.ua,
      });
    });
    return { ok: true as const };
  },
};
