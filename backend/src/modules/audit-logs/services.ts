import { prisma } from "@/lib/prisma";
import type { ListAuditLogsQuery } from "./validators";
import { applyPagination, buildPaginationMeta } from "@/utils/pagination";

export const AuditLogService = {
  async list(q: ListAuditLogsQuery) {
    const where: Record<string, unknown> = {};
    if (q.entityType) where.entityType = q.entityType;
    if (q.action) where.action = q.action;
    if (q.userId) where.userId = q.userId;
    if (q.dateFrom || q.dateTo) {
      const range: Record<string, Date> = {};
      if (q.dateFrom) range.gte = q.dateFrom;
      if (q.dateTo) range.lte = q.dateTo;
      where.createdAt = range;
    }
    if (q.search) {
      where.OR = [
        { entityType: { contains: q.search, mode: "insensitive" } },
        { entityId: { contains: q.search, mode: "insensitive" } },
      ];
    }

    const orderBy = q.sortBy ? { [q.sortBy]: q.sortOrder } : { createdAt: q.sortOrder };
    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const [totalItems, items] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, roleId: true },
          },
        },
      }),
    ]);

    return { items, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },
};
