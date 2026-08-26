import type { Request } from "express";
import { prisma } from "@/lib/prisma";
import type { CreateProductDto, ListLowStockQuery, ListProductsQuery, UpdateProductDto } from "./validators";
import { AuditAction, ProductStatus } from "@prisma/client";
import {
  applyPagination,
  buildPaginationMeta,
} from "@/utils/pagination";
import {
  NotFoundError,
} from "@/lib/errors";
import { omitSensitive, writeAudit, extractMeta } from "@/middleware/audit";

export type ListProductsResponse = Awaited<ReturnType<typeof ProductService["list"]>>;

export const ProductService = {
  async list(q: ListProductsQuery) {
    const where: Record<string, unknown> = {};
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: "insensitive" } },
        { sku: { contains: q.search, mode: "insensitive" } },
        { barcode: { contains: q.search, mode: "insensitive" } },
      ];
    }
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.status) where.status = q.status;

    const orderBy: Record<string, unknown> = q.sortBy
      ? { [q.sortBy]: q.sortOrder }
      : { createdAt: q.sortOrder };

    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const [totalItems, items] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy,
      }),
    ]);

    return { items, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },

  async listLowStockProducts(q: ListLowStockQuery) {
    const where: Record<string, unknown> = {};
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: "insensitive" } },
        { sku: { contains: q.search, mode: "insensitive" } },
      ];
    }
    if (q.categoryId) where.categoryId = q.categoryId;

    const stockExistsWhere = {
      ...where,
      stockLevels: {
        some: {
          quantity: {
            lt: prisma.stock.fields.minimumLevel,
          },
        },
      },
    };

    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const [totalItems, items] = await Promise.all([
      prisma.product.count({ where: stockExistsWhere }),
      prisma.product.findMany({
        where: stockExistsWhere,
        skip,
        take,
        orderBy: { createdAt: q.sortOrder },
        include: {
          stockLevels: {
            where: {
              quantity: {
                lt: prisma.stock.fields.minimumLevel,
              },
            },
            include: {
              warehouse: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
    ]);

    return { items, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },

  async generateSkuCode() {
    const last = await prisma.product.findFirst({
      orderBy: { createdAt: "desc" },
      select: { sku: true },
    });
    if (!last) return "SKU-0001";
    const numPart = last.sku.replace("SKU-", "");
    const n = parseInt(numPart, 10) || 0;
    return `SKU-${String(n + 1).padStart(4, "0")}`;
  },

  async create(dto: CreateProductDto, req: Request) {
    const meta = extractMeta(req);

    const created = await prisma.$transaction(async (tx) => {
      const sku = await ProductService.generateSkuCode();

      const product = await tx.product.create({
        data: {
          sku,
          name: dto.name,
          barcode: dto.barcode || null,
          categoryId: dto.categoryId || null,
          status: dto.status ?? ProductStatus.ACTIVE,
          description: dto.description || null,
          costPrice: dto.costPrice,
          unitPrice: dto.unitPrice,
          unitOfMeasure: dto.unitOfMeasure,
          weightKg: dto.weightKg || null,
          createdById: req.user?.id,
        },
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.CREATE,
        entityType: "Product",
        entityId: product.id,
        afterData: omitSensitive(product),
        ip: meta.ip,
        ua: meta.ua,
      });
      return product;
    });

    return { product: created };
  },

  async getById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
    });
    if (!product) throw new NotFoundError("Product not found.");
    return product;
  },

  async stockSummary(id: string) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError("Product not found.");

    const stock = await prisma.stock.findMany({
      where: { productId: id },
      include: {
        warehouse: {
          select: { id: true, name: true },
        },
      },
    });

    return stock.map((s) => ({
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      quantity: s.quantity,
      minimumLevel: s.minimumLevel,
    }));
  },

  async update(id: string, dto: UpdateProductDto, req: Request) {
    const meta = extractMeta(req);

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.product.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Product not found.");

      const data: Record<string, unknown> = {};
      for (const k of ["name", "barcode", "categoryId", "status", "description", "costPrice", "unitPrice", "unitOfMeasure", "weightKg"] as const) {
        if ((dto as Record<string, unknown>)[k] !== undefined) {
          const v = (dto as Record<string, unknown>)[k];
          data[k] = v;
        }
      }
      if (Object.keys(data).length === 0) {
        return before;
      }

      const after = await tx.product.update({
        where: { id },
        data,
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "Product",
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
      const before = await tx.product.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Product not found.");

      await tx.product.delete({ where: { id } });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.DELETE,
        entityType: "Product",
        entityId: id,
        beforeData: omitSensitive(before),
        ip: meta.ip,
        ua: meta.ua,
      });
    });
  },
};
