import { prisma } from "@/lib/prisma";
import type { DailySalesSummaryQuery } from "./validators";
import { PaymentStatus, OrderStatus } from "@prisma/client";

export type PaymentMethodBreakdown = {
  method: string;
  sum: number;
};

export type TopProduct = {
  productId: string;
  name: string;
  totalQty: number;
  totalRevenue: number;
};

export type DailySalesSummary = {
  dateFrom: Date;
  dateTo: Date;
  warehouseId?: string;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  totalItemsSold: number;
  paymentMethodBreakdown: PaymentMethodBreakdown[];
  topProducts: TopProduct[];
};

export const DailySalesService = {
  async summary(q: DailySalesSummaryQuery): Promise<DailySalesSummary> {
    const { dateFrom, dateTo, warehouseId } = q;

    const orderWhere: Record<string, unknown> = {
      orderDate: {
        gte: dateFrom,
        lte: dateTo,
      },
      status: {
        not: OrderStatus.CANCELLED,
      },
    };
    if (warehouseId) {
      orderWhere.warehouseId = warehouseId;
    }

    const paidStatuses = [PaymentStatus.PAID, PaymentStatus.PARTIAL];

    const ordersAggregate = await prisma.order.aggregate({
      where: orderWhere,
      _count: { id: true },
      _sum: { totalAmount: true },
    });

    const totalOrders = ordersAggregate._count.id ?? 0;
    const totalRevenue = Number(ordersAggregate._sum.totalAmount ?? 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const orderIds = await prisma.order.findMany({
      where: orderWhere,
      select: { id: true },
    }).then((orders) => orders.map((o) => o.id));

    const itemsSoldAggregate = await prisma.orderItem.aggregate({
      where: { orderId: { in: orderIds } },
      _sum: { quantity: true },
    });
    const totalItemsSold = itemsSoldAggregate._sum.quantity ?? 0;

    const paymentWhere: Record<string, unknown> = {
      status: { in: paidStatuses },
      paidAt: {
        gte: dateFrom,
        lte: dateTo,
      },
    };
    if (warehouseId) {
      paymentWhere.order = {
        warehouseId,
      };
    }

    const paymentBreakdownRaw = await prisma.payment.groupBy({
      by: ["method"],
      where: paymentWhere,
      _sum: { amount: true },
    });
    const paymentMethodBreakdown: PaymentMethodBreakdown[] = paymentBreakdownRaw.map((pb) => ({
      method: pb.method,
      sum: Number(pb._sum.amount ?? 0),
    }));

    const topProductsRaw = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: { orderId: { in: orderIds } },
      _sum: {
        quantity: true,
        lineTotal: true,
      },
      orderBy: {
        _sum: { quantity: "desc" } },
      take: 10,
    });

    const productIds = topProductsRaw.map((tp) => tp.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p.name]));

    const topProducts: TopProduct[] = topProductsRaw.map((tp) => ({
      productId: tp.productId,
      name: productMap.get(tp.productId) ?? "Unknown Product",
      totalQty: tp._sum.quantity ?? 0,
      totalRevenue: Number(tp._sum.lineTotal ?? 0),
    }));

    return {
      dateFrom,
      dateTo,
      warehouseId,
      totalOrders,
      totalRevenue,
      avgOrderValue,
      totalItemsSold,
      paymentMethodBreakdown,
      topProducts,
    };
  },
};
