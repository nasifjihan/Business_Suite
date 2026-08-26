import type { Request } from "express";
import { prisma } from "@/lib/prisma";
import type { CreateWarehouseDto, ListWarehousesQuery, UpdateWarehouseDto } from "./validators";
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

export type ListWarehousesResponse = Awaited<ReturnType<typeof WarehouseService["list"]>>;

export const WarehouseService = {
  async list(q: ListWarehousesQuery) {
    const where: Record<string, unknown> = {};
    if (q.search) {
      where.name = { contains: q.search, mode: "insensitive" };
    }
    if (q.isActive !== undefined) {
      where.isActive = q.isActive;
    }

    const orderBy: Record<string, unknown> = q.sortBy
      ? { [q.sortBy]: q.sortOrder }
      : { createdAt: q.sortOrder };

    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const [totalItems, items] = await Promise.all([
      prisma.warehouse.count({ where }),
      prisma.warehouse.findMany({
        where,
        skip,
        take,
        orderBy,
      }),
    ]);

    return { items, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },

  async create(dto: CreateWarehouseDto, req: Request) {
    const meta = extractMeta(req);

    const created = await prisma.$transaction(async (tx) => {
      const existingName = await tx.warehouse.findUnique({ where: { name: dto.name } });
      if (existingName) throw new ConflictError("A warehouse with this name already exists.");

      if (dto.code) {
        const existingCode = await tx.warehouse.findUnique({ where: { code: dto.code } });
        if (existingCode) throw new ConflictError("A warehouse with this code already exists.");
      }

      const warehouse = await tx.warehouse.create({
        data: {
          name: dto.name,
          code: dto.code || null,
          location: dto.location || null,
          isActive: dto.isActive ?? true,
          createdById: req.user?.id,
        },
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.CREATE,
        entityType: "Warehouse",
        entityId: warehouse.id,
        afterData: omitSensitive(warehouse),
        ip: meta.ip,
        ua: meta.ua,
      });
      return warehouse;
    });

    return { warehouse: created };
  },

  async getById(id: string) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
    });
    if (!warehouse) throw new NotFoundError("Warehouse not found.");
    return warehouse;
  },

  async update(id: string, dto: UpdateWarehouseDto, req: Request) {
    const meta = extractMeta(req);

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.warehouse.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Warehouse not found.");

      if (dto.name && dto.name !== before.name) {
        const dup = await tx.warehouse.findUnique({ where: { name: dto.name } });
        if (dup) throw new ConflictError("A warehouse with this name already exists.");
      }

      if (dto.code && dto.code !== before.code) {
        const dup = await tx.warehouse.findUnique({ where: { code: dto.code } });
        if (dup) throw new ConflictError("A warehouse with this code already exists.");
      }

      const data: Record<string, unknown> = {};
      for (const k of ["name", "code", "location", "isActive"] as const) {
        if ((dto as Record<string, unknown>)[k] !== undefined) {
          const v = (dto as Record<string, unknown>)[k];
          data[k] = v;
        }
      }
      if (Object.keys(data).length === 0) {
        return before;
      }

      const after = await tx.warehouse.update({
        where: { id },
        data,
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "Warehouse",
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

  async softRemove(id: string, req: Request) {
    const meta = extractMeta(req);

    await prisma.$transaction(async (tx) => {
      const before = await tx.warehouse.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Warehouse not found.");

      const after = await tx.warehouse.update({
        where: { id },
        data: { isActive: false },
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "Warehouse",
        entityId: id,
        beforeData: omitSensitive(before),
        afterData: omitSensitive(after),
        ip: meta.ip,
        ua: meta.ua,
      });
    });
  },
};
