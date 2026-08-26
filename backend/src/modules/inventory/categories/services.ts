import type { Request } from "express";
import { prisma } from "@/lib/prisma";
import type { CreateCategoryDto, ListCategoriesQuery, UpdateCategoryDto } from "./validators";
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

export type ListCategoriesResponse = Awaited<ReturnType<typeof CategoryService["list"]>>;

export const CategoryService = {
  async list(q: ListCategoriesQuery) {
    const where: Record<string, unknown> = {};
    if (q.search) {
      where.name = { contains: q.search, mode: "insensitive" };
    }
    if (q.parentId !== undefined) {
      where.parentId = q.parentId;
    }

    const orderBy: Record<string, unknown> = q.sortBy
      ? { [q.sortBy]: q.sortOrder }
      : { createdAt: q.sortOrder };

    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const [totalItems, items] = await Promise.all([
      prisma.category.count({ where }),
      prisma.category.findMany({
        where,
        skip,
        take,
        orderBy,
      }),
    ]);

    return { items, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },

  async create(dto: CreateCategoryDto, req: Request) {
    const meta = extractMeta(req);

    const created = await prisma.$transaction(async (tx) => {
      const existing = await tx.category.findUnique({ where: { name: dto.name } });
      if (existing) throw new ConflictError("A category with this name already exists.");

      const category = await tx.category.create({
        data: {
          name: dto.name,
          parentId: dto.parentId || null,
          description: dto.description || null,
          createdById: req.user?.id,
        },
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.CREATE,
        entityType: "Category",
        entityId: category.id,
        afterData: omitSensitive(category),
        ip: meta.ip,
        ua: meta.ua,
      });
      return category;
    });

    return { category: created };
  },

  async getById(id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
    });
    if (!category) throw new NotFoundError("Category not found.");
    return category;
  },

  async update(id: string, dto: UpdateCategoryDto, req: Request) {
    const meta = extractMeta(req);

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.category.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Category not found.");

      if (dto.name && dto.name !== before.name) {
        const dup = await tx.category.findUnique({ where: { name: dto.name } });
        if (dup) throw new ConflictError("A category with this name already exists.");
      }

      const data: Record<string, unknown> = {};
      for (const k of ["name", "parentId", "description"] as const) {
        if ((dto as Record<string, unknown>)[k] !== undefined) {
          const v = (dto as Record<string, unknown>)[k];
          data[k] = v;
        }
      }
      if (Object.keys(data).length === 0) {
        return before;
      }

      const after = await tx.category.update({
        where: { id },
        data,
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "Category",
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
      const before = await tx.category.findUnique({
        where: { id },
        include: { products: true },
      });
      if (!before) throw new NotFoundError("Category not found.");

      if (before.products.length > 0) {
        throw new ConflictError("Cannot delete category with products.");
      }

      await tx.category.delete({ where: { id } });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.DELETE,
        entityType: "Category",
        entityId: id,
        beforeData: omitSensitive(before),
        ip: meta.ip,
        ua: meta.ua,
      });
    });
  },
};
