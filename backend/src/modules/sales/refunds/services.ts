import type { Request } from "express";
import { prisma } from "@/lib/prisma";
import type { CreateRefundDto, ListRefundsQuery } from "./validators";
import { AuditAction, RefundReason, OrderStatus } from "@prisma/client";
import { applyPagination, buildPaginationMeta } from "@/utils/pagination";
import { NotFoundError, UnprocessableEntityError } from "@/lib/errors";
import { omitSensitive, writeAudit, extractMeta } from "@/middleware/audit";

export type ListRefundsResponse = Awaited<
  ReturnType<(typeof RefundService)["list"]>
>;

const generateRefundNumber = async (tx: {
  refund: { count: (args: object) => Promise<number> };
}): Promise<string> => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const prefix = `REF-${yyyy}${mm}`;
  const count = await tx.refund.count({
    where: { refundNumber: { startsWith: prefix } },
  });
  return `${prefix}-${String(count + 1).padStart(5, "0")}`;
};

export const RefundService = {
  async list(q: ListRefundsQuery) {
    const where: Record<string, unknown> = {};
    if (q.orderId) where.orderId = q.orderId;
    if (q.productId) where.productId = q.productId;
    if (q.reason) where.reason = q.reason;
    if (q.restock !== undefined) where.restock = q.restock;
    if (q.dateFrom || q.dateTo) {
      where.refundDate = {};
      if (q.dateFrom)
        (where.refundDate as Record<string, unknown>).gte = q.dateFrom;
      if (q.dateTo)
        (where.refundDate as Record<string, unknown>).lte = q.dateTo;
    }
    if (q.search) {
      where.OR = [
        { refundNumber: { contains: q.search, mode: "insensitive" } },
        { note: { contains: q.search, mode: "insensitive" } },
      ];
    }

    const orderBy: Record<string, unknown> = q.sortBy
      ? { [q.sortBy]: q.sortOrder }
      : { refundDate: q.sortOrder };

    const { skip, take } = applyPagination({
      page: q.page,
      pageSize: q.pageSize,
    });

    const [totalItems, items] = await Promise.all([
      prisma.refund.count({ where }),
      prisma.refund.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          order: { select: { orderNumber: true, totalAmount: true } },
          orderItem: {
            select: {
              id: true,
              productName: true,
              quantity: true,
              unitPrice: true,
            },
          },
          product: { select: { id: true, sku: true, name: true } },
          processor: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    return {
      items,
      meta: buildPaginationMeta({
        page: q.page,
        pageSize: q.pageSize,
        totalItems,
      }),
    };
  },

  async create(dto: CreateRefundDto, req: Request) {
    const meta = extractMeta(req);

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: dto.orderId },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true } },
            },
          },
        },
      });
      if (!order) throw new NotFoundError("Order not found.");

      const orderItemMap = new Map(order.items.map((oi) => [oi.id, oi]));

      for (const item of dto.items) {
        const orderItem = orderItemMap.get(item.orderItemId);
        if (!orderItem) {
          throw new UnprocessableEntityError(
            `Order item ${item.orderItemId} not found in order.`,
          );
        }
        const refundableQty = orderItem.quantity - orderItem.refundedQty;
        if (item.quantity > refundableQty) {
          throw new UnprocessableEntityError(
            `Refund quantity ${item.quantity} exceeds refundable quantity ${refundableQty} for item ${orderItem.productName}.`,
          );
        }
      }

      for (const item of dto.items) {
        const orderItem = orderItemMap.get(item.orderItemId)!;
        await tx.orderItem.update({
          where: { id: item.orderItemId },
          data: { refundedQty: { increment: item.quantity } },
        });
      }

      if (dto.restock && order.warehouseId) {
        for (const item of dto.items) {
          const orderItem = orderItemMap.get(item.orderItemId)!;
          const existingStock = await tx.stock.findUnique({
            where: {
              productId_warehouseId: {
                productId: orderItem.productId,
                warehouseId: order.warehouseId!,
              },
            },
          });
          if (existingStock) {
            await tx.stock.update({
              where: {
                productId_warehouseId: {
                  productId: orderItem.productId,
                  warehouseId: order.warehouseId!,
                },
              },
              data: { quantity: { increment: item.quantity } },
            });
          } else {
            await tx.stock.create({
              data: {
                productId: orderItem.productId,
                warehouseId: order.warehouseId!,
                quantity: item.quantity,
                minimumLevel: 0,
              },
            });
          }
        }
      }

      const refundNumber = await generateRefundNumber(tx);

      let totalRefundAmount = 0;
      const firstItem = dto.items[0];
      const firstOrderItem = orderItemMap.get(firstItem.orderItemId)!;

      for (const item of dto.items) {
        const orderItem = orderItemMap.get(item.orderItemId)!;
        const unitPrice = item.unitPrice ?? Number(orderItem.unitPrice);
        totalRefundAmount += unitPrice * item.quantity;
      }

      const beforeOrder = { ...order };
      const allItemsRefunded = order.items.every((oi) => {
        const refundItem = dto.items.find((di) => di.orderItemId === oi.id);
        const totalRefundedForItem =
          oi.refundedQty + (refundItem?.quantity ?? 0);
        return totalRefundedForItem >= oi.quantity;
      });

      let updatedOrder;
      if (allItemsRefunded && order.status !== OrderStatus.REFUNDED) {
        updatedOrder = await tx.order.update({
          where: { id: dto.orderId },
          data: { status: OrderStatus.REFUNDED },
        });
      } else {
        updatedOrder = await tx.order.update({
          where: { id: dto.orderId },
          data: {},
        });
      }

      const refunds = [];
      for (const item of dto.items) {
        const orderItem = orderItemMap.get(item.orderItemId)!;
        const unitPrice = item.unitPrice ?? Number(orderItem.unitPrice);
        const itemAmount = unitPrice * item.quantity;

        const refund: any = await tx.refund.create({
          data: {
            refundNumber:
              dto.items.length > 1
                ? `${refundNumber}-${refunds.length + 1}`
                : refundNumber,
            orderId: dto.orderId,
            orderItemId: item.orderItemId,
            paymentId: dto.paymentId || null,
            productId: orderItem.productId,
            amount: itemAmount,
            quantity: item.quantity,
            reason: dto.reason,
            restock: dto.restock,
            note: dto.note || null,
            processedBy: req.user?.id,
            refundDate: new Date(),
          },
        });
        refunds.push(refund);

        await writeAudit(tx, {
          userId: req.user?.id,
          action: AuditAction.CREATE,
          entityType: "Refund",
          entityId: refund.id,
          afterData: omitSensitive(refund),
          ip: meta.ip,
          ua: meta.ua,
          metadata: { orderId: dto.orderId, productId: orderItem.productId },
        });
      }

      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "Order",
        entityId: updatedOrder.id,
        beforeData: omitSensitive(beforeOrder),
        afterData: omitSensitive(updatedOrder),
        ip: meta.ip,
        ua: meta.ua,
        metadata: { refundCount: refunds.length, totalRefundAmount },
      });

      return refunds.length === 1 ? refunds[0] : refunds;
    });

    return result;
  },

  async getById(id: string) {
    const refund = await prisma.refund.findUnique({
      where: { id },
      include: {
        order: true,
        orderItem: true,
        product: { select: { id: true, sku: true, name: true } },
        payment: { select: { id: true, paymentNumber: true, amount: true } },
        processor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!refund) throw new NotFoundError("Refund not found.");
    return refund;
  },
};
