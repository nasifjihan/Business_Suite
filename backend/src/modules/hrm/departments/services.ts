import type { Request } from "express";
import { prisma } from "@/lib/prisma";
import type { CreateDepartmentDto, ListDepartmentsQuery, UpdateDepartmentDto } from "./validators";
import { AuditAction, UserStatus } from "@prisma/client";
import {
  applyPagination,
  buildPaginationMeta,
} from "@/utils/pagination";
import {
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import { omitSensitive, writeAudit, extractMeta } from "@/middleware/audit";

export type ListDepartmentsResponse = Awaited<ReturnType<typeof DepartmentService["list"]>>;

export const DepartmentService = {
  async list(q: ListDepartmentsQuery) {
    const where: Record<string, unknown> = {};
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: "insensitive" } },
        { code: { contains: q.search, mode: "insensitive" } },
      ];
    }
    if (q.status !== undefined) {
      where.status = q.status;
    } else if (q.isActive !== undefined) {
      where.status = q.isActive ? "ACTIVE" : "INACTIVE";
    }

    const orderBy: Record<string, unknown> = q.sortBy
      ? { [q.sortBy]: q.sortOrder }
      : { createdAt: q.sortOrder };

    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const [totalItems, items] = await Promise.all([
      prisma.department.count({ where }),
      prisma.department.findMany({
        where,
        skip,
        take,
        orderBy,
      }),
    ]);

    return { items, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },

  async generateDepartmentCode() {
    const last = await prisma.department.findFirst({
      where: { code: { startsWith: "DEPT-" } },
      orderBy: { code: "desc" },
      select: { code: true },
    });
    if (!last) return "DEPT-0001";
    const numPart = last.code.replace("DEPT-", "");
    const n = parseInt(numPart, 10) || 0;
    return `DEPT-${String(n + 1).padStart(4, "0")}`;
  },

  async create(dto: CreateDepartmentDto, req: Request) {
    const meta = extractMeta(req);

    const code = dto.code || (await DepartmentService.generateDepartmentCode());

    const created = await prisma.$transaction(async (tx) => {
      const existingName = await tx.department.findUnique({ where: { name: dto.name } });
      if (existingName) throw new ConflictError("A department with this name already exists.");

      const existingCode = await tx.department.findUnique({ where: { code } });
      if (existingCode) throw new ConflictError("A department with this code already exists.");

      const department = await tx.department.create({
        data: {
          name: dto.name,
          code,
          managerId: dto.managerId || null,
          description: dto.description || null,
          status: dto.status ?? UserStatus.ACTIVE,
        },
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.CREATE,
        entityType: "Department",
        entityId: department.id,
        afterData: omitSensitive(department),
        ip: meta.ip,
        ua: meta.ua,
      });
      return department;
    });

    return { department: created };
  },

  async getById(id: string) {
    const department = await prisma.department.findUnique({
      where: { id },
    });
    if (!department) throw new NotFoundError("Department not found.");
    return department;
  },

  async update(id: string, dto: UpdateDepartmentDto, req: Request) {
    const meta = extractMeta(req);

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.department.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Department not found.");

      if (dto.name && dto.name !== before.name) {
        const dup = await tx.department.findUnique({ where: { name: dto.name } });
        if (dup) throw new ConflictError("A department with this name already exists.");
      }

      if (dto.code && dto.code !== before.code) {
        const dup = await tx.department.findUnique({ where: { code: dto.code } });
        if (dup) throw new ConflictError("A department with this code already exists.");
      }

      const data: Record<string, unknown> = {};
      for (const k of ["name", "code", "managerId", "description", "status"] as const) {
        if ((dto as Record<string, unknown>)[k] !== undefined) {
          const v = (dto as Record<string, unknown>)[k];
          data[k] = v ?? null;
        }
      }
      if (Object.keys(data).length === 0) {
        return before;
      }

      const after = await tx.department.update({
        where: { id },
        data,
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "Department",
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
      const before = await tx.department.findUnique({
        where: { id },
        include: { employees: true, designations: true },
      });
      if (!before) throw new NotFoundError("Department not found.");

      if (before.employees.length > 0) {
        throw new ConflictError("Cannot delete department with employees.");
      }

      if (before.designations.length > 0) {
        throw new ConflictError("Cannot delete department with designations.");
      }

      await tx.department.delete({ where: { id } });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.DELETE,
        entityType: "Department",
        entityId: id,
        beforeData: omitSensitive(before),
        ip: meta.ip,
        ua: meta.ua,
      });
    });
  },

  async softDelete(id: string, req: Request) {
    const meta = extractMeta(req);

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.department.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Department not found.");

      const after = await tx.department.update({
        where: { id },
        data: { status: UserStatus.INACTIVE },
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "Department",
        entityId: after.id,
        beforeData: omitSensitive(before),
        afterData: omitSensitive(after),
        ip: meta.ip,
        ua: meta.ua,
        metadata: { softDelete: true },
      });
      return after;
    });

    return updated;
  },
};
