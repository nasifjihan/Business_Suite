import type { Request } from "express";
import { prisma } from "@/lib/prisma";
import type { CreateRoleDto, ListRolesQuery, UpdateRoleDto } from "./validators";
import { applyPagination, buildPaginationMeta } from "@/utils/pagination";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/errors";
import { RoleType, AuditAction } from "@prisma/client";
import { extractMeta, omitSensitive, writeAudit } from "@/middleware/audit";

export const RoleService = {
  async list(q: ListRolesQuery) {
    const where: Record<string, unknown> = {};
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: "insensitive" } },
        { displayName: { contains: q.search, mode: "insensitive" } },
      ];
    }
    const orderBy = q.sortBy ? { [q.sortBy]: q.sortOrder } : { createdAt: q.sortOrder };
    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const [totalItems, items] = await Promise.all([
      prisma.role.count({ where }),
      prisma.role.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          _count: { select: { users: true, permissions: true } },
          permissions: { include: { permission: { select: { code: true } } } },
        },
      }),
    ]);

    const shaped = items.map((r) => ({
      id: r.id,
      name: r.name,
      displayName: r.displayName,
      description: r.description,
      isSystem: r.isSystem,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      userCount: r._count.users,
      permissionCount: r._count.permissions,
      permissionCodes: r.permissions.map((p) => p.permission.code),
    }));

    return { items: shaped, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },

  async getById(id: string) {
    const r = await prisma.role.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, permissions: true } },
        permissions: { include: { permission: { select: { code: true, module: true, action: true, description: true } } } },
      },
    });
    if (!r) throw new NotFoundError("Role not found.");
    return {
      id: r.id,
      name: r.name,
      displayName: r.displayName,
      description: r.description,
      isSystem: r.isSystem,
      userCount: r._count.users,
      permissionCount: r._count.permissions,
      permissions: r.permissions.map((p) => ({
        code: p.permission.code,
        module: p.permission.module,
        action: p.permission.action,
        description: p.permission.description ?? null,
      })),
    };
  },

  async create(dto: CreateRoleDto, req: Request) {
    // Custom roles are non-system. isSystem is forced false (can only be set in seed).
    const meta = extractMeta(req);

    const dup = await prisma.role.findFirst({
      where: { displayName: { equals: dto.displayName, mode: "insensitive" } },
    });
    if (dup) throw new ConflictError("A role with this display name already exists.");

    const created = await prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          name: dto.name.toUpperCase().replace(/\s+/g, "_") as unknown as RoleType,
          displayName: dto.displayName,
          description: dto.description || null,
          isSystem: false,
        },
      });
      if (dto.permissionCodes && dto.permissionCodes.length > 0) {
        const perms = await tx.permission.findMany({
          where: { code: { in: dto.permissionCodes } },
          select: { id: true },
        });
        if (perms.length !== dto.permissionCodes.length) {
          throw new BadRequestError("One or more permission codes are invalid.");
        }
        await tx.rolePermission.createMany({
          data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
          skipDuplicates: true,
        });
      }
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.CREATE,
        entityType: "Role",
        entityId: role.id,
        afterData: omitSensitive({ ...role, permissionCodes: dto.permissionCodes }),
        ip: meta.ip,
        ua: meta.ua,
      });
      return RoleService.getById(role.id);
    });
    return created;
  },

  async update(id: string, dto: UpdateRoleDto, req: Request) {
    const meta = extractMeta(req);

    const updated = await prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({ where: { id } });
      if (!role) throw new NotFoundError("Role not found.");
      if (role.isSystem && (dto.name || dto.permissionCodes === undefined)) {
        // System roles: allow permission assignment & displayName/description edits.
        // Forbid renaming the raw enum `name` field for system roles.
        if (dto.name) {
          throw new BadRequestError("Cannot rename a system role.");
        }
      }
      if (dto.displayName) {
        const dup = await tx.role.findFirst({
          where: {
            displayName: { equals: dto.displayName, mode: "insensitive" },
            NOT: { id },
          },
        });
        if (dup) throw new ConflictError("A role with this display name already exists.");
      }

      const data: Record<string, unknown> = {};
      if (dto.name) data.name = dto.name.toUpperCase().replace(/\s+/g, "_") as unknown as RoleType;
      if (dto.displayName !== undefined) data.displayName = dto.displayName;
      if (dto.description !== undefined) data.description = dto.description || null;

      let updatedRole: typeof role;
      if (Object.keys(data).length > 0) {
        updatedRole = await tx.role.update({ where: { id }, data });
      } else {
        updatedRole = role;
      }

      if (dto.permissionCodes) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        if (dto.permissionCodes.length > 0) {
          const perms = await tx.permission.findMany({
            where: { code: { in: dto.permissionCodes } },
            select: { id: true },
          });
          if (perms.length !== dto.permissionCodes.length) {
            throw new BadRequestError("One or more permission codes are invalid.");
          }
          await tx.rolePermission.createMany({
            data: perms.map((p) => ({ roleId: id, permissionId: p.id })),
            skipDuplicates: true,
          });
        }
      }

      const fetched = await RoleService.getById(updatedRole.id);
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "Role",
        entityId: updatedRole.id,
        afterData: omitSensitive(fetched),
        ip: meta.ip,
        ua: meta.ua,
      });
      return fetched;
    });

    return updated;
  },

  async delete(id: string, req: Request) {
    const meta = extractMeta(req);
    await prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({ where: { id } });
      if (!role) throw new NotFoundError("Role not found.");
      if (role.isSystem) throw new BadRequestError("Cannot delete a system role.");

      const inUse = await tx.user.count({ where: { roleId: id, status: "ACTIVE" } });
      if (inUse > 0) throw new ConflictError("Cannot delete role — it is assigned to one or more active users. Reassign them first.");

      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.role.delete({ where: { id } });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.DELETE,
        entityType: "Role",
        entityId: id,
        beforeData: omitSensitive(role),
        ip: meta.ip,
        ua: meta.ua,
      });
    });
    return { ok: true as const };
  },
};
