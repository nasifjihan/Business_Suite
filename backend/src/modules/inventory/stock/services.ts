import { prisma } from "@/lib/prisma";
import type { ListStockQuery } from "./validators";
import {
  applyPagination,
  buildPaginationMeta,
} from "@/utils/pagination";
import { NotFoundError } from "@/lib/errors";

export const StockService = {
  async list(q: ListStockQuery) {
    const where: Record<string, unknown> = {};

    if (q.productId) where.productId = q.productId;
    if (q.warehouseId) where.warehouseId = q.warehouseId;
    if (q.lowOnly === true) {
      where.AND = [
        { quantity: { lt: prisma.stock.fields.minimumLevel } },
      ];
    }

    const orderBy: Record<string, unknown> = q.sortBy
      ? { [q.sortBy]: q.sortOrder }
      : { updatedAt: q.sortOrder };

    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const [totalItems, items] = await Promise.all([
      prisma.stock.count({ where }),
      prisma.stock.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          product: true,
          warehouse: true,
        },
      }),
    ]);

    return { items, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },

  async getByCompositeKey(productId: string, warehouseId: string) {
    const stock = await prisma.stock.findUnique({
      where: {
        productId_warehouseId: { productId, warehouseId },
      },
      include: {
        product: true,
        warehouse: true,
      },
    });
    if (!stock) throw new NotFoundError("Stock record not found.");
    return stock;
  },
};
