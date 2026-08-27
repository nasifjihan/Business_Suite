import type { Request } from "express";
import { prisma } from "@/lib/prisma";
import type { CreateOrderCheckoutDto, ListOrdersQuery, UpdateOrderStatusDto } from "./validators";
import {
  applyPagination,
  buildPaginationMeta,
} from "@/utils/pagination";
import {
  NotFoundError,
  UnprocessableEntityError,
} from "@/lib/errors";
import { omitSensitive, writeAudit, extractMeta } from "@/middleware/audit";
import {
  AuditAction,
  InvoiceStatus,
  OrderStatus,
  PaymentStatus,
  ProductStatus,
} from "@prisma/client";
import { Prisma } from "@prisma/client";

type DecimalInstance = InstanceType<(typeof Prisma)["Decimal"]>;
const DecimalCtor = Prisma.Decimal;

export type ListOrdersResponse = Awaited<ReturnType<typeof OrderService["list"]>>;

const TAX_RATE_FALLBACK = 0;

function d2(value: number | DecimalInstance | string): DecimalInstance {
  const n = new DecimalCtor(value);
  return new DecimalCtor(n.toFixed(2));
}

function computePaymentStatus(paidTotal: DecimalInstance, grandTotal: DecimalInstance): PaymentStatus {
  if (grandTotal.lte(0)) return PaymentStatus.PAID;
  const ratio = (paidTotal as unknown as { dividedBy: (v: DecimalInstance | number) => DecimalInstance }).dividedBy(grandTotal);
  if (ratio.gte(1)) return PaymentStatus.PAID;
  if (ratio.gt(0)) return PaymentStatus.PARTIAL;
  return PaymentStatus.UNPAID;
}

async function generateOrderCode(tx: Prisma.TransactionClient): Promise<string> {
  const last = await tx.order.findFirst({
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });
  if (!last) return "INV-0001";
  const numPart = last.orderNumber.replace(/^INV-/, "");
  const n = parseInt(numPart, 10) || 0;
  return `INV-${String(n + 1).padStart(4, "0")}`;
}

async function generateInvoiceCode(tx: Prisma.TransactionClient): Promise<string> {
  const last = await tx.invoice.findFirst({
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  if (!last) return "INV-INV-0001";
  const numPart = last.invoiceNumber.replace(/^INV-INV-/, "");
  const n = parseInt(numPart, 10) || 0;
  return `INV-INV-${String(n + 1).padStart(4, "0")}`;
}

async function generatePaymentCode(tx: Prisma.TransactionClient): Promise<string> {
  const last = await tx.payment.findFirst({
    orderBy: { paymentNumber: "desc" },
    select: { paymentNumber: true },
  });
  if (!last) return "PAY-0001";
  const numPart = last.paymentNumber.replace(/^PAY-/, "");
  const n = parseInt(numPart, 10) || 0;
  return `PAY-${String(n + 1).padStart(4, "0")}`;
}

type LowStockWarning = {
  productId: string;
  productName: string;
  warehouseId?: string;
  available: number;
  requested: number;
};

type OrderItemLine = {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: DecimalInstance;
  discountAmount: DecimalInstance;
  taxRatePercent: number;
  taxAmount: DecimalInstance;
  lineTotal: DecimalInstance;
};

export const OrderService = {
  async list(q: ListOrdersQuery) {
    const where: Prisma.OrderWhereInput = {};
    if (q.search) {
      where.OR = [
        { orderNumber: { contains: q.search, mode: "insensitive" } },
        { customer: { name: { contains: q.search, mode: "insensitive" } } },
      ];
    }
    if (q.customerId) where.customerId = q.customerId;
    if (q.warehouseId) where.warehouseId = q.warehouseId;
    if (q.status) where.status = q.status;
    if (q.paymentStatus) where.paymentStatus = q.paymentStatus;
    if (q.orderDateFrom || q.orderDateTo) {
      const dateWhere: Prisma.DateTimeFilter = {};
      if (q.orderDateFrom) dateWhere.gte = q.orderDateFrom;
      if (q.orderDateTo) dateWhere.lte = q.orderDateTo;
      (where as Prisma.OrderWhereInput & { orderDate?: Prisma.DateTimeFilter }).orderDate = dateWhere;
    }

    const orderBy: Prisma.OrderOrderByWithRelationInput = q.sortBy
      ? { [q.sortBy]: q.sortOrder } as unknown as Prisma.OrderOrderByWithRelationInput
      : { createdAt: q.sortOrder } as Prisma.OrderOrderByWithRelationInput;

    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const [totalItems, items] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          customer: { select: { id: true, name: true, customerCode: true } },
          warehouse: { select: { id: true, name: true } },
          _count: { select: { items: true, invoices: true } },
        },
      }),
    ]);

    return { items, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },

  async getById(id: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        warehouse: true,
        items: {
          include: { product: { select: { id: true, sku: true, name: true } } },
        },
        invoices: true,
      },
    });
    if (!order) throw new NotFoundError("Order not found.");
    return order;
  },

  async checkout(dto: CreateOrderCheckoutDto, req: Request) {
    const meta = extractMeta(req);
    const userId = req.user?.id;

    const result = await prisma.$transaction(async (tx) => {
      const productIds = dto.items.map((it) => it.productId);
      const uniqueIds = [...new Set(productIds)];

      const products = await tx.product.findMany({
        where: {
          id: { in: uniqueIds },
          status: ProductStatus.ACTIVE,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          unitPrice: true,
          costPrice: true,
        },
      });

      if (products.length !== uniqueIds.length) {
        const found = new Set(products.map((p) => p.id));
        const missing = uniqueIds.filter((pid) => !found.has(pid));
        throw new UnprocessableEntityError(
          `Some products are invalid or inactive: ${missing.join(", ")}`,
        );
      }

      const productMap = new Map(products.map((p) => [p.id, p]));

      const stockMap = new Map<string, number>();
      const lowStockWarnings: LowStockWarning[] = [];
      if (dto.warehouseId) {
        const stockRows = await tx.stock.findMany({
          where: {
            productId: { in: uniqueIds },
            warehouseId: dto.warehouseId,
          },
          select: { productId: true, quantity: true, minimumLevel: true },
        });
        for (const row of stockRows) {
          stockMap.set(row.productId, row.quantity);
        }
      }

      const orderItemData: OrderItemLine[] = [];

      let subtotalDecimal = d2(0);
      let itemsTaxDecimal = d2(0);
      let itemsDiscountDecimal = d2(0);

      for (const it of dto.items) {
        const product = productMap.get(it.productId)!;
        const freshUnitPrice = d2(product.unitPrice as unknown as number | DecimalInstance | string);
        const itemDiscount = d2(it.discountAmount);
        const qty = it.quantity;

        if (qty <= 0) {
          throw new UnprocessableEntityError(
            `Invalid quantity for product ${product.name}`,
          );
        }

        if (dto.warehouseId) {
          const available = stockMap.get(it.productId) ?? 0;
          if (qty > available) {
            throw new UnprocessableEntityError(
              `Insufficient stock for ${product.name} at warehouse: requested ${qty}, available ${available}`,
            );
          }
          if (available <= qty) {
            lowStockWarnings.push({
              productId: product.id,
              productName: product.name,
              warehouseId: dto.warehouseId,
              available,
              requested: qty,
            });
          }
          if (available - qty < 0) {
            throw new UnprocessableEntityError(
              `Negative stock forbidden for ${product.name}`,
            );
          }
        }

        const lineBeforeTax = (freshUnitPrice as unknown as { times: (n: number) => DecimalInstance; minus: (n: DecimalInstance) => DecimalInstance })
          .times(qty)
          .minus(itemDiscount);
        const lineTax = d2(
          (lineBeforeTax as unknown as { times: (n: number) => DecimalInstance; dividedBy: (n: number) => DecimalInstance })
            .times(it.taxRatePercent ?? TAX_RATE_FALLBACK)
            .dividedBy(100),
        );
        const lineTotal = d2(
          (lineBeforeTax as unknown as { plus: (n: DecimalInstance) => DecimalInstance }).plus(lineTax),
        );

        if ((lineTotal as unknown as { lt: (n: number) => boolean }).lt(0)) {
          throw new UnprocessableEntityError(
            `Line total cannot be negative for ${product.name}`,
          );
        }

        subtotalDecimal = (subtotalDecimal as unknown as { plus: (n: DecimalInstance) => DecimalInstance }).plus(
          (freshUnitPrice as unknown as { times: (n: number) => DecimalInstance }).times(qty),
        ) as DecimalInstance;
        itemsDiscountDecimal = (itemsDiscountDecimal as unknown as { plus: (n: DecimalInstance) => DecimalInstance }).plus(itemDiscount) as DecimalInstance;
        itemsTaxDecimal = (itemsTaxDecimal as unknown as { plus: (n: DecimalInstance) => DecimalInstance }).plus(lineTax) as DecimalInstance;

        orderItemData.push({
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          quantity: qty,
          unitPrice: freshUnitPrice,
          discountAmount: itemDiscount,
          taxRatePercent: it.taxRatePercent ?? TAX_RATE_FALLBACK,
          taxAmount: lineTax,
          lineTotal,
        });
      }

      subtotalDecimal = d2(subtotalDecimal);
      itemsDiscountDecimal = d2(itemsDiscountDecimal);
      itemsTaxDecimal = d2(itemsTaxDecimal);

      const headerDiscount = d2(dto.discountAmount ?? 0);
      if ((headerDiscount as unknown as { gt: (n: DecimalInstance) => boolean }).gt(subtotalDecimal)) {
        throw new UnprocessableEntityError(
          "Header discount cannot exceed subtotal.",
        );
      }

      const totalDiscount = d2(
        (itemsDiscountDecimal as unknown as { plus: (n: DecimalInstance) => DecimalInstance }).plus(headerDiscount),
      );
      const totalBeforeTax = d2(
        (subtotalDecimal as unknown as { minus: (n: DecimalInstance) => DecimalInstance }).minus(totalDiscount),
      );
      const taxAmount = d2(itemsTaxDecimal);
      const totalAmount = d2(
        (totalBeforeTax as unknown as { plus: (n: DecimalInstance) => DecimalInstance }).plus(taxAmount),
      );

      if ((totalAmount as unknown as { lt: (n: number) => boolean }).lt(0)) {
        throw new UnprocessableEntityError("Grand total cannot be negative.");
      }

      if (dto.warehouseId) {
        for (const it of orderItemData) {
          const available = stockMap.get(it.productId) ?? 0;
          const newQty = available - it.quantity;
          if (newQty < 0) {
            throw new UnprocessableEntityError(
              `Negative stock double-guard failed for ${it.productName}`,
            );
          }
          await tx.stock.update({
            where: {
              productId_warehouseId: {
                productId: it.productId,
                warehouseId: dto.warehouseId,
              },
            },
            data: {
              quantity: { decrement: it.quantity },
            },
          });
          await tx.stockMovement.create({
            data: {
              movementType: "OUT",
              productId: it.productId,
              warehouseId: dto.warehouseId,
              quantity: it.quantity,
              reference: "ORDER-" + it.productId.slice(0, 8),
              userId,
              createdBy: userId,
            },
          });
        }
      }

      const orderNumber = await generateOrderCode(tx);

      const orderCreateData: Prisma.OrderCreateInput = {
        orderNumber,
        customer: dto.customerId ? { connect: { id: dto.customerId } } : undefined,
        warehouse: dto.warehouseId ? { connect: { id: dto.warehouseId } } : undefined,
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.UNPAID,
        subtotal: subtotalDecimal as unknown as Prisma.Decimal,
        discountAmount: totalDiscount as unknown as Prisma.Decimal,
        taxAmount: taxAmount as unknown as Prisma.Decimal,
        totalAmount: totalAmount as unknown as Prisma.Decimal,
        orderDate: new Date(),
        dueDate: dto.dueDate ?? undefined,
        notes: dto.notes ?? undefined,
        creator: userId ? { connect: { id: userId } } : undefined,
      };

      const order = await tx.order.create({ data: orderCreateData });

      const invoiceNumber = await generateInvoiceCode(tx);
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          order: { connect: { id: order.id } },
          customer: dto.customerId ? { connect: { id: dto.customerId } } : undefined,
          status: InvoiceStatus.ISSUED,
          subtotal: subtotalDecimal as unknown as Prisma.Decimal,
          discountAmount: totalDiscount as unknown as Prisma.Decimal,
          taxAmount: taxAmount as unknown as Prisma.Decimal,
          totalAmount: totalAmount as unknown as Prisma.Decimal,
          amountPaid: d2(0) as unknown as Prisma.Decimal,
          issuedAt: new Date(),
          dueAt: dto.dueDate ?? undefined,
          notes: dto.notes ?? undefined,
        },
      });

      const items = await tx.orderItem.createManyAndReturn({
        data: orderItemData.map((it) => ({
          orderId: order.id,
          productId: it.productId,
          productName: it.productName,
          productSku: it.productSku,
          quantity: it.quantity,
          unitPrice: it.unitPrice as unknown as Prisma.Decimal,
          discountAmount: it.discountAmount as unknown as Prisma.Decimal,
          taxRatePercent: it.taxRatePercent,
          taxAmount: it.taxAmount as unknown as Prisma.Decimal,
          lineTotal: it.lineTotal as unknown as Prisma.Decimal,
        })),
      });

      let payments: unknown[] = [];
      let paidTotal = d2(0);

      if (dto.payments && dto.payments.length > 0) {
        const paymentDataInput: Prisma.PaymentCreateManyInput[] = [];
        for (const p of dto.payments) {
          const amt = d2(p.amount);
          if ((amt as unknown as { lt: (n: number) => boolean }).lt(0)) {
            throw new UnprocessableEntityError("Payment amount cannot be negative.");
          }
          paidTotal = (paidTotal as unknown as { plus: (n: DecimalInstance) => DecimalInstance }).plus(amt) as DecimalInstance;
          const pCode = await generatePaymentCode(tx);
          const pData: Prisma.PaymentCreateManyInput = {
            paymentNumber: pCode,
            invoiceId: invoice.id,
            amount: amt as unknown as Prisma.Decimal,
            method: p.method,
            status: PaymentStatus.PAID,
            paidAt: new Date(),
            reference: p.reference ?? undefined,
            notes: p.notes ?? undefined,
            receivedBy: userId ?? undefined,
          };
          paymentDataInput.push(pData);
        }
        payments = await tx.payment.createManyAndReturn({ data: paymentDataInput });
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { amountPaid: d2(paidTotal) as unknown as Prisma.Decimal },
        });
      }

      const finalPaid = d2(paidTotal);
      const ps = computePaymentStatus(finalPaid, totalAmount);
      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: ps },
      });

      if (dto.customerId) {
        await tx.customer.update({
          where: { id: dto.customerId },
          data: {
            totalSpent: { increment: totalAmount as unknown as Prisma.Decimal },
            orderCount: { increment: 1 },
          },
        });
      }

      await writeAudit(tx, {
        userId,
        action: AuditAction.CREATE,
        entityType: "Order",
        entityId: order.id,
        afterData: omitSensitive(order),
        metadata: { orderNumber, totalAmount: parseFloat((totalAmount as unknown as { toNumber: () => number }).toNumber().toFixed(2)) },
        ip: meta.ip,
        ua: meta.ua,
      });
      await writeAudit(tx, {
        userId,
        action: AuditAction.CREATE,
        entityType: "Invoice",
        entityId: invoice.id,
        afterData: omitSensitive(invoice),
        metadata: { orderId: order.id, invoiceNumber },
        ip: meta.ip,
        ua: meta.ua,
      });
      if (payments.length > 0) {
        const firstPayment = payments[0] as { id: string };
        await writeAudit(tx, {
          userId,
          action: AuditAction.CREATE,
          entityType: "Payment",
          entityId: firstPayment.id,
          metadata: {
            orderId: order.id,
            count: payments.length,
            totalPaid: parseFloat((finalPaid as unknown as { toNumber: () => number }).toNumber().toFixed(2)),
          },
          afterData: payments.map((p) => omitSensitive(p)),
          ip: meta.ip,
          ua: meta.ua,
        });
      }

      return { order, items, invoices: [invoice], payments, lowStockWarnings };
    });

    return result;
  },

  async updateStatus(id: string, dto: UpdateOrderStatusDto, req: Request) {
    const meta = extractMeta(req);
    const userId = req.user?.id;

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.order.findUnique({
        where: { id },
        include: {
          items: true,
          warehouse: { select: { id: true } },
        },
      });
      if (!before) throw new NotFoundError("Order not found.");

      if (dto.status === OrderStatus.CANCELLED && before.status !== OrderStatus.CANCELLED) {
        if (before.warehouseId) {
          for (const it of before.items) {
            await tx.stock.update({
              where: {
                productId_warehouseId: {
                  productId: it.productId,
                  warehouseId: before.warehouseId,
                },
              },
              data: { quantity: { increment: it.quantity } },
            });
            await tx.stockMovement.create({
              data: {
                movementType: "IN",
                productId: it.productId,
                warehouseId: before.warehouseId,
                quantity: it.quantity,
                reference: "CANCEL-" + before.orderNumber,
                userId,
                createdBy: userId,
              },
            });
          }
        }
      }

      const after = await tx.order.update({
        where: { id },
        data: {
          status: dto.status,
        },
      });

      await writeAudit(tx, {
        userId,
        action: AuditAction.UPDATE,
        entityType: "Order",
        entityId: after.id,
        beforeData: omitSensitive(before),
        afterData: omitSensitive(after),
        metadata: { statusChange: { from: before.status, to: dto.status }, notes: dto.notes },
        ip: meta.ip,
        ua: meta.ua,
      });

      return after;
    });

    return updated;
  },

  async remove(id: string, req: Request) {
    const meta = extractMeta(req);
    const userId = req.user?.id;

    await prisma.$transaction(async (tx) => {
      const before = await tx.order.findUnique({
        where: { id },
        include: { items: true, warehouse: { select: { id: true } } },
      });
      if (!before) throw new NotFoundError("Order not found.");

      if (
        before.status !== OrderStatus.PENDING &&
        before.status !== OrderStatus.CANCELLED
      ) {
        throw new UnprocessableEntityError(
          "Only PENDING or CANCELLED orders may be deleted.",
        );
      }

      if (before.status !== OrderStatus.CANCELLED && before.warehouseId) {
        for (const it of before.items) {
          const stockRow = await tx.stock.findUnique({
            where: {
              productId_warehouseId: {
                productId: it.productId,
                warehouseId: before.warehouseId,
              },
            },
            select: { quantity: true },
          });
          if (stockRow && stockRow.quantity + it.quantity < 0) {
            throw new UnprocessableEntityError("Negative stock not allowed during restock on delete.");
          }
          await tx.stock.update({
            where: {
              productId_warehouseId: {
                productId: it.productId,
                warehouseId: before.warehouseId,
              },
            },
            data: { quantity: { increment: it.quantity } },
          });
        }
      }

      await tx.invoice.deleteMany({ where: { orderId: id } });
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.order.delete({ where: { id } });

      await writeAudit(tx, {
        userId,
        action: AuditAction.DELETE,
        entityType: "Order",
        entityId: id,
        beforeData: omitSensitive(before),
        ip: meta.ip,
        ua: meta.ua,
      });
    });
  },
};
