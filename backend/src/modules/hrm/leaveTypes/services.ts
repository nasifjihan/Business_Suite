import type { Request } from "express";
import { prisma } from "@/lib/prisma";
import type { CreateLeaveTypeDto, ListLeaveTypesQuery, UpdateLeaveTypeDto } from "./validators";
import { AuditAction, Prisma, UserStatus } from "@prisma/client";
import {
  applyPagination,
  buildPaginationMeta,
} from "@/utils/pagination";
import {
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import { omitSensitive, writeAudit, extractMeta } from "@/middleware/audit";

export type ListLeaveTypesResponse = Awaited<ReturnType<typeof LeaveTypeService["list"]>>;

export const LeaveTypeService = {
  async list(q: ListLeaveTypesQuery) {
    const where: Prisma.LeaveTypeWhereInput = {};
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: "insensitive" } },
        { code: { contains: q.search, mode: "insensitive" } },
      ];
    }
    if (q.status !== undefined) {
      where.status = q.status;
    }

    const orderBy: Prisma.LeaveTypeOrderByWithRelationInput = q.sortBy
      ? { [q.sortBy]: q.sortOrder } as unknown as Prisma.LeaveTypeOrderByWithRelationInput
      : { createdAt: q.sortOrder } as Prisma.LeaveTypeOrderByWithRelationInput;

    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const [totalItems, items] = await Promise.all([
      prisma.leaveType.count({ where }),
      prisma.leaveType.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          _count: { select: { leaveRequests: true } },
        },
      }),
    ]);

    return { items, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },

  async getById(id: string) {
    const leaveType = await prisma.leaveType.findUnique({
      where: { id },
      include: {
        _count: { select: { leaveRequests: true } },
      },
    });
    if (!leaveType) throw new NotFoundError("Leave type not found.");
    return leaveType;
  },

  async create(dto: CreateLeaveTypeDto, req: Request) {
    const meta = extractMeta(req);

    const created = await prisma.$transaction(async (tx) => {
      const existingCode = await tx.leaveType.findUnique({ where: { code: dto.code } });
      if (existingCode) throw new ConflictError("A leave type with this code already exists.");

      const existingName = await tx.leaveType.findUnique({ where: { name: dto.name } });
      if (existingName) throw new ConflictError("A leave type with this name already exists.");

      const leaveType = await tx.leaveType.create({
        data: {
          code: dto.code,
          name: dto.name,
          defaultDays: dto.defaultDays,
          maxCarryOver: dto.maxCarryOver,
          requiresDocuments: dto.requiresDocuments,
          status: dto.status ?? UserStatus.ACTIVE,
          description: dto.description ?? null,
        },
      });

      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.CREATE,
        entityType: "LeaveType",
        entityId: leaveType.id,
        afterData: omitSensitive(leaveType),
        ip: meta.ip,
        ua: meta.ua,
      });

      return leaveType;
    });

    return { leaveType: created };
  },

  async update(id: string, dto: UpdateLeaveTypeDto, req: Request) {
    const meta = extractMeta(req);

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.leaveType.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Leave type not found.");

      if (dto.code && dto.code !== before.code) {
        const dup = await tx.leaveType.findUnique({ where: { code: dto.code } });
        if (dup) throw new ConflictError("A leave type with this code already exists.");
      }

      if (dto.name && dto.name !== before.name) {
        const dup = await tx.leaveType.findUnique({ where: { name: dto.name } });
        if (dup) throw new ConflictError("A leave type with this name already exists.");
      }

      const data: Prisma.LeaveTypeUpdateInput = {};
      for (const k of ["code", "name", "defaultDays", "maxCarryOver", "requiresDocuments", "status", "description"] as const) {
        if ((dto as Record<string, unknown>)[k] !== undefined) {
          const v = (dto as Record<string, unknown>)[k];
          (data as Record<string, unknown>)[k] = v === null ? null : v;
        }
      }

      if (Object.keys(data).length === 0) {
        return before;
      }

      const after = await tx.leaveType.update({
        where: { id },
        data,
      });

      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "LeaveType",
        entityId: after.id,
        beforeData: omitSensitive(before),
        afterData: omitSensitive(after),
        ip: meta.ip,
        ua: meta.ua,
      });

      return after;
    });

    return updated;
  },

  async remove(id: string, req: Request) {
    const meta = extractMeta(req);

    await prisma.$transaction(async (tx) => {
      const before = await tx.leaveType.findUnique({
        where: { id },
        include: { _count: { select: { leaveRequests: true } } },
      });
      if (!before) throw new NotFoundError("Leave type not found.");

      if (before._count.leaveRequests > 0) {
        throw new ConflictError("Cannot delete leave type with existing leave requests.");
      }

      await tx.leaveType.delete({ where: { id } });

      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.DELETE,
        entityType: "LeaveType",
        entityId: id,
        beforeData: omitSensitive(before),
        ip: meta.ip,
        ua: meta.ua,
      });
    });
  },
};
