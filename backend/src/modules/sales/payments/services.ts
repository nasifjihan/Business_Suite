import type { Request } from "express";
import { prisma } from "@/lib/prisma";
import type { CreatePaymentDto, ListPaymentsQuery } from "./validators";
import { AuditAction, PaymentStatus } from "@prisma/client";
import {
  applyPagination,
  buildPaginationMeta,
} from "@/utils/pagination";
import {
  NotFoundError,
} from "@/lib/errors";
import { omitSensitive, writeAudit, extractMeta } from "@/middleware/audit";

export type ListPaymentsResponse = Awaited<ReturnType<typeof PaymentService["list"]>>;

const computePaymentStatus = (totalPaid: number, orderTotal: number): PaymentStatus => {
  const paid = Number(totalPaid.toFixed(2));
  const total = Number(orderTotal.toFixed(2));
  if (paid >= total && total > 0) return PaymentStatus.PAID;
  if (paid > 0) return PaymentStatus.PARTIAL;
  return PaymentStatus.UNPAID;
};

const generatePaymentNumber = async (tx: { payment: { count: (args: object) => Promise<number> } }): Promise<string> => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const prefix = `PAY-${yyyy}${mm}`;
  const count = await tx.payment.count({ where: { paymentNumber: { startsWith: prefix } } });
  return `${prefix}-${String(count + 1).padStart(5, "0")}`;
};

export const PaymentService = {
  async list(q: ListPaymentsQuery) {
    const where: Record<string, unknown> = {};
    if (q.orderId) where.orderId = q.orderId;
    if (q.invoiceId) where.invoiceId = q.invoiceId;
    if (q.method) where.method = q.method;
    if (q.status) where.status = q.status;
    if (q.dateFrom || q.dateTo) {
      where.paidAt = {};
      if (q.dateFrom) (where.paidAt as Record<string, unknown>).gte = q.dateFrom;
      if (q.dateTo) (where.paidAt as Record<string, unknown>).lte = q.dateTo;
    }
    if (q.search) {
      where.OR = [
        { paymentNumber: { contains: q.search, mode: "insensitive" } },
        { reference: { contains: q.search, mode: "insensitive" } },
      ];
    }

    const orderBy: Record<string, unknown> = q.sortBy
      ? { [q.sortBy]: q.sortOrder }
      : { paidAt: q.sortOrder };

    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const [totalItems, items] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          order: { select: { orderNumber: true, totalAmount: true } },
          invoice: { select: { invoiceNumber: true } },
          receiver: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    return { items, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },

  async create(dto: CreatePaymentDto, req: Request) {
    const meta = extractMeta(req);

    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: dto.orderId } });
      if (!order) throw new NotFoundError("Order not found.");

      if (dto.invoiceId) {
        const invoice = await tx.invoice.findUnique({ where: { id: dto.invoiceId } });
        if (!invoice) throw new NotFoundError("Invoice not found.");
      }

      const paymentNumber = await generatePaymentNumber(tx);

      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          orderId: dto.orderId,
          invoiceId: dto.invoiceId || null,
          amount: dto.amount,
          method: dto.method,
          status: dto.status,
          paidAt: dto.paidAt || new Date(),
          transactionFee: dto.transactionFee,
          reference: dto.reference || null,
          notes: dto.notes || null,
          receivedBy: req.user?.id,
        },
      });

      const payments = await tx.payment.findMany({
        where: { orderId: dto.orderId, status: PaymentStatus.PAID },
        select: { amount: true },
      });
      const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const newPaymentStatus = computePaymentStatus(totalPaid, Number(order.totalAmount));

      const beforeOrder = { ...order };
      const updatedOrder = await tx.order.update({
        where: { id: dto.orderId },
        data: { paymentStatus: newPaymentStatus },
      });

      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.CREATE,
        entityType: "Payment",
        entityId: payment.id,
        afterData: omitSensitive(payment),
        ip: meta.ip,
        ua: meta.ua,
      });

      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "Order",
        entityId: updatedOrder.id,
        beforeData: omitSensitive(beforeOrder),
        afterData: omitSensitive(updatedOrder),
        ip: meta.ip,
        ua: meta.ua,
      });

      return payment;
    });

    return created;
  },

  async getById(id: string) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        order: true,
        invoice: true,
        receiver: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!payment) throw new NotFoundError("Payment not found.");
    return payment;
  },
};
