import type { Request } from "express";
import { prisma } from "@/lib/prisma";
import type { CreateDesignationDto, ListDesignationsQuery, UpdateDesignationDto } from "./validators";
import { AuditAction } from "@prisma/client";
import {
  applyPagination,
  buildPaginationMeta,
} from "@/utils/pagination";
import {
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import { omitSensitive, writeAudit, extractMeta } from "@/middleware/audit";

export type ListDesignationsResponse = Awaited<ReturnType<typeof DesignationService["list"]>>;

export const DesignationService = {
  async list(q: ListDesignationsQuery) {
    const where: Record<string, unknown> = {};
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: "insensitive" } },
        { code: { contains: q.search, mode: "insensitive" } },
      ];
    }
    if (q.departmentId !== undefined) {
      where.departmentId = q.departmentId;
    }

    const orderBy: Record<string, unknown> = q.sortBy
      ? { [q.sortBy]: q.sortOrder }
      : { createdAt: q.sortOrder };

    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const [totalItems, items] = await Promise.all([
      prisma.designation.count({ where }),
      prisma.designation.findMany({
        where,
        skip,
        take,
        orderBy,
      }),
    ]);

    return { items, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },

  async generateDesignationCode() {
    const last = await prisma.designation.findFirst({
      where: { code: { startsWith: "DESG-" } },
      orderBy: { code: "desc" },
      select: { code: true },
    });
    if (!last) return "DESG-0001";
    const numPart = last.code.replace("DESG-", "");
    const n = parseInt(numPart, 10) || 0;
    return `DESG-${String(n + 1).padStart(4, "0")}`;
  },

  async create(dto: CreateDesignationDto, req: Request) {
    const meta = extractMeta(req);

    const code = dto.code || (await DesignationService.generateDesignationCode());

    const created = await prisma.$transaction(async (tx) => {
      const existingName = await tx.designation.findUnique({ where: { name: dto.name } });
      if (existingName) throw new ConflictError("A designation with this name already exists.");

      const existingCode = await tx.designation.findUnique({ where: { code } });
      if (existingCode) throw new ConflictError("A designation with this code already exists.");

      if (dto.departmentId) {
        const dept = await tx.department.findUnique({ where: { id: dto.departmentId } });
        if (!dept) throw new NotFoundError("Department not found.");
      }

      const designation = await tx.designation.create({
        data: {
          name: dto.name,
          code,
          departmentId: dto.departmentId || null,
          description: dto.description || null,
        },
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.CREATE,
        entityType: "Designation",
        entityId: designation.id,
        afterData: omitSensitive(designation),
        ip: meta.ip,
        ua: meta.ua,
      });
      return designation;
    });

    return { designation: created };
  },

  async getById(id: string) {
    const designation = await prisma.designation.findUnique({
      where: { id },
    });
    if (!designation) throw new NotFoundError("Designation not found.");
    return designation;
  },

  async update(id: string, dto: UpdateDesignationDto, req: Request) {
    const meta = extractMeta(req);

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.designation.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Designation not found.");

      if (dto.name && dto.name !== before.name) {
        const dup = await tx.designation.findUnique({ where: { name: dto.name } });
        if (dup) throw new ConflictError("A designation with this name already exists.");
      }

      if (dto.code && dto.code !== before.code) {
        const dup = await tx.designation.findUnique({ where: { code: dto.code } });
        if (dup) throw new ConflictError("A designation with this code already exists.");
      }

      if (dto.departmentId && dto.departmentId !== before.departmentId) {
        const dept = await tx.department.findUnique({ where: { id: dto.departmentId } });
        if (!dept) throw new NotFoundError("Department not found.");
      }

      const data: Record<string, unknown> = {};
      for (const k of ["name", "code", "departmentId", "description"] as const) {
        if ((dto as Record<string, unknown>)[k] !== undefined) {
          const v = (dto as Record<string, unknown>)[k];
          data[k] = v ?? null;
        }
      }
      if (Object.keys(data).length === 0) {
        return before;
      }

      const after = await tx.designation.update({
        where: { id },
        data,
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "Designation",
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
      const before = await tx.designation.findUnique({
        where: { id },
        include: { employees: true },
      });
      if (!before) throw new NotFoundError("Designation not found.");

      if (before.employees.length > 0) {
        throw new ConflictError("Cannot delete designation with employees.");
      }

      await tx.designation.delete({ where: { id } });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.DELETE,
        entityType: "Designation",
        entityId: id,
        beforeData: omitSensitive(before),
        ip: meta.ip,
        ua: meta.ua,
      });
    });
  },
};
