import type { Request } from "express";
import { prisma } from "@/lib/prisma";
import type { AdjustCreditDto, ListCreditsQuery } from "./validators";
import { AuditAction } from "@prisma/client";
import {
  applyPagination,
  buildPaginationMeta,
} from "@/utils/pagination";
import {
  NotFoundError,
  UnprocessableEntityError,
} from "@/lib/errors";
import { omitSensitive, writeAudit, extractMeta } from "@/middleware/audit";

export type ListCreditsResponse = Awaited<ReturnType<typeof CustomerCreditService["listCredits"]>>;

export const CustomerCreditService = {
  async listCredits(q: ListCreditsQuery) {
    const where: Record<string, unknown> = {};
    if (q.withPositiveBalance === true || q.minBalance !== undefined) {
      where.creditBalance = {};
      if (q.withPositiveBalance === true) {
        (where.creditBalance as Record<string, unknown>).gt = 0;
      }
      if (q.minBalance !== undefined) {
        (where.creditBalance as Record<string, unknown>).gte = q.minBalance;
      }
    }
    if (q.status) where.status = q.status;
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: "insensitive" } },
        { customerCode: { contains: q.search, mode: "insensitive" } },
        { email: { contains: q.search, mode: "insensitive" } },
        { companyName: { contains: q.search, mode: "insensitive" } },
      ];
    }

    const orderBy: Record<string, unknown> = q.sortBy
      ? { [q.sortBy]: q.sortOrder }
      : { creditBalance: "desc" };

    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const [totalItems, items] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          _count: {
            select: { orders: true, invoices: true },
          },
        },
      }),
    ]);

    return { items, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },

  async adjust(dto: AdjustCreditDto, req: Request) {
    const meta = extractMeta(req);

    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: dto.customerId },
      });
      if (!customer) throw new NotFoundError("Customer not found.");

      const currentBalance = Number(customer.creditBalance);
      const newBalance = currentBalance + Number(dto.deltaAmount);

      if (newBalance < 0) {
        throw new UnprocessableEntityError(
          `Credit adjustment would result in negative balance (${newBalance.toFixed(2)}). Current balance: ${currentBalance.toFixed(2)}, Delta: ${dto.deltaAmount.toFixed(2)}`,
        );
      }

      const before = { ...customer };
      const updated = await tx.customer.update({
        where: { id: dto.customerId },
        data: { creditBalance: newBalance },
      });

      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "Customer",
        entityId: updated.id,
        beforeData: omitSensitive(before),
        afterData: omitSensitive(updated),
        ip: meta.ip,
        ua: meta.ua,
        metadata: {
          creditAdjustment: {
            deltaAmount: dto.deltaAmount,
            oldBalance: currentBalance,
            newBalance,
            note: dto.note || null,
          },
        },
      });

      return {
        customer: updated,
        oldBalance: currentBalance,
        deltaAmount: dto.deltaAmount,
        newBalance,
      };
    });

    return result;
  },
};
