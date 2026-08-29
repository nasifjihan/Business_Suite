import { prisma } from "@/lib/prisma";
import { Prisma, OrderStatus, PaymentStatus, LeadStatus, AttendanceStatus } from "@prisma/client";
import type { Request } from "express";

export type DashboardSummary = {
  salesToday: number;
  salesYesterday: number;
  salesThisMonth: number;
  salesLastMonth: number;
  ordersToday: number;
  ordersYesterday: number;
  newCustomersThisMonth: number;
  newCustomersLastMonth: number;
  openLeadsCount: number;
  openLeadsPrevWeek: number;
  presentToday: number;
  presentYesterday: number;
  pendingLeaves: number;
  pendingLeavesYesterday: number;
  lowStockCount: number;
  lowStockPrevWeek: number;
  avgOrderValueThisMonth: number;
  leadConversionRateThisMonth: number;
  ordersThisMonth: number;
  ordersLastMonth: number;
  salesThisWeek: number;
  salesLastWeek: number;
  wonLeadsThisMonth: number;
  lostLeadsThisMonth: number;
  completedOrdersToday: number;
  completedOrdersYesterday: number;
};

export type SalesTrendPoint = { date: string; total: number; orders: number };
export type TopProductRow = { productId: string; name: string; qtySold: number; revenue: number };
export type LeadPipelineRow = { status: LeadStatus; count: number; value: number };
export type AttendanceSummaryRow = { PRESENT: number; LATE: number; ABSENT: number; HALF_DAY: number; LEAVE: number };
export type RecentOrderRow = { id: string; orderNumber: string; customerName: string | null; grandTotal: number; status: OrderStatus; orderDate: string };
export type RecentActivity = { id: string; time: string; actorName: string | null; action: string; entityType: string | null; description: string };

const ALL_LEAD_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"];
const ATTENDANCE_KEYS: AttendanceStatus[] = ["PRESENT", "LATE", "ABSENT", "HALF_DAY", "LEAVE"];

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "bigint" ? Number(v) : Number(v);
  return isNaN(n) ? 0 : n;
}

type SalesTrendRaw = { date_label: string; total: number; orders: bigint };
type TopProductsRaw = { product_id: string; name: string; qty_sold: bigint; revenue: number };
type LeadPipelineRaw = { status: LeadStatus; count: bigint; value: number };
type AttendanceRaw = { status: AttendanceStatus; count: bigint };
type RecentActivitiesRaw = { id: string; time: Date; actor_name: string | null; action: string; entity_type: string | null; description: string };

export const DashboardService = {
  async summary(_req: Request): Promise<DashboardSummary> {
    const today = Prisma.sql`CURRENT_DATE`;
    const yesterday = Prisma.sql`CURRENT_DATE - INTERVAL '1 day'`;
    const monthStart = Prisma.sql`DATE_TRUNC('month', CURRENT_DATE)`;
    const lastMonthStart = Prisma.sql`DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`;
    const lastMonthEnd = Prisma.sql`DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day'`;
    const weekStart = Prisma.sql`DATE_TRUNC('week', CURRENT_DATE)`;
    const lastWeekStart = Prisma.sql`DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days'`;
    const lastWeekEnd = Prisma.sql`DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 day'`;

    const [
      salesTodayRow,
      salesYesterdayRow,
      salesThisMonthRow,
      salesLastMonthRow,
      ordersTodayRow,
      ordersYesterdayRow,
      newCustomersThisMonthRow,
      newCustomersLastMonthRow,
      openLeadsCountRow,
      openLeadsPrevWeekRow,
      presentTodayRow,
      presentYesterdayRow,
      pendingLeavesRow,
      pendingLeavesYesterdayRow,
      lowStockCountRow,
      lowStockPrevWeekRow,
      avgOrderValueRow,
      leadConvRow,
      ordersThisMonthRow,
      ordersLastMonthRow,
      salesThisWeekRow,
      salesLastWeekRow,
      wonLeadsRow,
      lostLeadsRow,
      completedTodayRow,
      completedYesterdayRow,
    ] = await Promise.all([
      prisma.$queryRaw<{ s: number }[]>(Prisma.sql`SELECT COALESCE(SUM("totalAmount"),0)::float AS s FROM "Order" WHERE "orderDate" = ${today} AND status <> 'CANCELLED'`),
      prisma.$queryRaw<{ s: number }[]>(Prisma.sql`SELECT COALESCE(SUM("totalAmount"),0)::float AS s FROM "Order" WHERE "orderDate" = ${yesterday} AND status <> 'CANCELLED'`),
      prisma.$queryRaw<{ s: number }[]>(Prisma.sql`SELECT COALESCE(SUM("totalAmount"),0)::float AS s FROM "Order" WHERE "orderDate" >= ${monthStart} AND "orderDate" <= ${today} AND status <> 'CANCELLED'`),
      prisma.$queryRaw<{ s: number }[]>(Prisma.sql`SELECT COALESCE(SUM("totalAmount"),0)::float AS s FROM "Order" WHERE "orderDate" >= ${lastMonthStart} AND "orderDate" <= ${lastMonthEnd} AND status <> 'CANCELLED'`),
      prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`SELECT COUNT(*)::bigint AS c FROM "Order" WHERE "orderDate" = ${today}`),
      prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`SELECT COUNT(*)::bigint AS c FROM "Order" WHERE "orderDate" = ${yesterday}`),
      prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`SELECT COUNT(*)::bigint AS c FROM "Customer" WHERE "createdAt" >= ${monthStart} AND "createdAt" <= ${today} + INTERVAL '1 day'`),
      prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`SELECT COUNT(*)::bigint AS c FROM "Customer" WHERE "createdAt" >= ${lastMonthStart} AND "createdAt" <= ${lastMonthEnd} + INTERVAL '1 day'`),
      prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`SELECT COUNT(*)::bigint AS c FROM "Lead" WHERE status IN ('NEW','CONTACTED','QUALIFIED','PROPOSAL')`),
      prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`SELECT COUNT(*)::bigint AS c FROM "Lead" WHERE status IN ('NEW','CONTACTED','QUALIFIED','PROPOSAL') AND "createdAt" < ${weekStart}`),
      prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`SELECT COUNT(*)::bigint AS c FROM "Attendance" WHERE "attendanceDate" = ${today} AND status IN ('PRESENT','LATE','HALF_DAY')`),
      prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`SELECT COUNT(*)::bigint AS c FROM "Attendance" WHERE "attendanceDate" = ${yesterday} AND status IN ('PRESENT','LATE','HALF_DAY')`),
      prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`SELECT COUNT(*)::bigint AS c FROM "LeaveRequest" WHERE status = 'PENDING'`),
      prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`SELECT COUNT(*)::bigint AS c FROM "LeaveRequest" WHERE status = 'PENDING' AND "createdAt" < ${today}`),
      prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`SELECT COUNT(DISTINCT p.id)::bigint AS c FROM "Product" p INNER JOIN "Stock" s ON s."productId" = p.id GROUP BY p.id, p.status HAVING COALESCE(SUM(s.quantity),0) < MAX(s."minimumLevel")`),
      prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`SELECT COUNT(DISTINCT p.id)::bigint AS c FROM "Product" p INNER JOIN "Stock" s ON s."productId" = p.id WHERE s."updatedAt" < ${weekStart} GROUP BY p.id HAVING COALESCE(SUM(s.quantity),0) < MAX(s."minimumLevel")`),
      prisma.$queryRaw<{ s: number }[]>(Prisma.sql`SELECT COALESCE(SUM("totalAmount")::float / NULLIF(COUNT(*),0),0)::float AS s FROM "Order" WHERE "orderDate" >= ${monthStart} AND "orderDate" <= ${today} AND status = 'COMPLETED'`),
      prisma.$queryRaw<{ won: bigint; total: bigint }[]>(Prisma.sql`SELECT COUNT(*) FILTER (WHERE status='WON')::bigint AS won, COUNT(*) FILTER (WHERE status IN ('WON','LOST'))::bigint AS total FROM "Lead" WHERE "createdAt" >= ${monthStart} AND "createdAt" <= ${today} + INTERVAL '1 day'`),
      prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`SELECT COUNT(*)::bigint AS c FROM "Order" WHERE "orderDate" >= ${monthStart} AND "orderDate" <= ${today}`),
      prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`SELECT COUNT(*)::bigint AS c FROM "Order" WHERE "orderDate" >= ${lastMonthStart} AND "orderDate" <= ${lastMonthEnd}`),
      prisma.$queryRaw<{ s: number }[]>(Prisma.sql`SELECT COALESCE(SUM("totalAmount"),0)::float AS s FROM "Order" WHERE "orderDate" >= ${weekStart} AND "orderDate" <= ${today} AND status <> 'CANCELLED'`),
      prisma.$queryRaw<{ s: number }[]>(Prisma.sql`SELECT COALESCE(SUM("totalAmount"),0)::float AS s FROM "Order" WHERE "orderDate" >= ${lastWeekStart} AND "orderDate" <= ${lastWeekEnd} AND status <> 'CANCELLED'`),
      prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`SELECT COUNT(*)::bigint AS c FROM "Lead" WHERE status = 'WON' AND "wonLostAt" >= ${monthStart} AND "wonLostAt" <= ${today} + INTERVAL '1 day'`),
      prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`SELECT COUNT(*)::bigint AS c FROM "Lead" WHERE status = 'LOST' AND "wonLostAt" >= ${monthStart} AND "wonLostAt" <= ${today} + INTERVAL '1 day'`),
      prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`SELECT COUNT(*)::bigint AS c FROM "Order" WHERE "orderDate" = ${today} AND status = 'COMPLETED'`),
      prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`SELECT COUNT(*)::bigint AS c FROM "Order" WHERE "orderDate" = ${yesterday} AND status = 'COMPLETED'`),
    ]);

    const won = toNum(leadConvRow[0]?.won);
    const totalWonLost = toNum(leadConvRow[0]?.total);
    const leadConversionRateThisMonth = totalWonLost > 0 ? Math.round((won / totalWonLost) * 1000) / 10 : 0;

    return {
      salesToday: toNum(salesTodayRow[0]?.s),
      salesYesterday: toNum(salesYesterdayRow[0]?.s),
      salesThisMonth: toNum(salesThisMonthRow[0]?.s),
      salesLastMonth: toNum(salesLastMonthRow[0]?.s),
      ordersToday: toNum(ordersTodayRow[0]?.c),
      ordersYesterday: toNum(ordersYesterdayRow[0]?.c),
      newCustomersThisMonth: toNum(newCustomersThisMonthRow[0]?.c),
      newCustomersLastMonth: toNum(newCustomersLastMonthRow[0]?.c),
      openLeadsCount: toNum(openLeadsCountRow[0]?.c),
      openLeadsPrevWeek: toNum(openLeadsPrevWeekRow[0]?.c),
      presentToday: toNum(presentTodayRow[0]?.c),
      presentYesterday: toNum(presentYesterdayRow[0]?.c),
      pendingLeaves: toNum(pendingLeavesRow[0]?.c),
      pendingLeavesYesterday: toNum(pendingLeavesYesterdayRow[0]?.c),
      lowStockCount: toNum(lowStockCountRow[0]?.c),
      lowStockPrevWeek: toNum(lowStockPrevWeekRow[0]?.c),
      avgOrderValueThisMonth: toNum(avgOrderValueRow[0]?.s),
      leadConversionRateThisMonth,
      ordersThisMonth: toNum(ordersThisMonthRow[0]?.c),
      ordersLastMonth: toNum(ordersLastMonthRow[0]?.c),
      salesThisWeek: toNum(salesThisWeekRow[0]?.s),
      salesLastWeek: toNum(salesLastWeekRow[0]?.s),
      wonLeadsThisMonth: toNum(wonLeadsRow[0]?.c),
      lostLeadsThisMonth: toNum(lostLeadsRow[0]?.c),
      completedOrdersToday: toNum(completedTodayRow[0]?.c),
      completedOrdersYesterday: toNum(completedYesterdayRow[0]?.c),
    };
  },

  async salesTrend(period: "week" | "month" | "quarter" | "year"): Promise<SalesTrendPoint[]> {
    if (period === "week") {
      const rows = await prisma.$queryRaw<SalesTrendRaw[]>(Prisma.sql`
        WITH series AS (
          SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day')::date AS d
        )
        SELECT
          TO_CHAR(s.d, 'YYYY-MM-DD') AS date_label,
          COALESCE(SUM(o."totalAmount"),0)::float AS total,
          COALESCE(COUNT(o.id),0)::bigint AS orders
        FROM series s
        LEFT JOIN "Order" o ON o."orderDate" = s.d AND o.status <> 'CANCELLED'
        GROUP BY s.d
        ORDER BY s.d
      `);
      return rows.map((r: SalesTrendRaw) => ({ date: r.date_label, total: toNum(r.total), orders: toNum(r.orders) }));
    }

    if (period === "month") {
      const rows = await prisma.$queryRaw<SalesTrendRaw[]>(Prisma.sql`
        WITH series AS (
          SELECT generate_series(
            DATE_TRUNC('month', CURRENT_DATE)::date,
            CURRENT_DATE,
            INTERVAL '1 day'
          )::date AS d
        )
        SELECT
          TO_CHAR(s.d, 'YYYY-MM-DD') AS date_label,
          COALESCE(SUM(o."totalAmount"),0)::float AS total,
          COALESCE(COUNT(o.id),0)::bigint AS orders
        FROM series s
        LEFT JOIN "Order" o ON o."orderDate" = s.d AND o.status <> 'CANCELLED'
        GROUP BY s.d
        ORDER BY s.d
      `);
      return rows.map((r: SalesTrendRaw) => ({ date: r.date_label, total: toNum(r.total), orders: toNum(r.orders) }));
    }

    if (period === "quarter") {
      const rows = await prisma.$queryRaw<SalesTrendRaw[]>(Prisma.sql`
        WITH series AS (
          SELECT generate_series(
            CURRENT_DATE - INTERVAL '89 days',
            CURRENT_DATE,
            INTERVAL '1 day'
          )::date AS d
        )
        SELECT
          TO_CHAR(s.d, 'YYYY-MM-DD') AS date_label,
          COALESCE(SUM(o."totalAmount"),0)::float AS total,
          COALESCE(COUNT(o.id),0)::bigint AS orders
        FROM series s
        LEFT JOIN "Order" o ON o."orderDate" = s.d AND o.status <> 'CANCELLED'
        GROUP BY s.d
        ORDER BY s.d
      `);
      return rows.map((r: SalesTrendRaw) => ({ date: r.date_label, total: toNum(r.total), orders: toNum(r.orders) }));
    }

    const rows = await prisma.$queryRaw<SalesTrendRaw[]>(Prisma.sql`
      WITH series AS (
        SELECT generate_series(
          DATE_TRUNC('year', CURRENT_DATE - INTERVAL '11 months'),
          DATE_TRUNC('month', CURRENT_DATE),
          INTERVAL '1 month'
        )::date AS d
      )
      SELECT
        TO_CHAR(s.d, 'YYYY-MM') AS date_label,
        COALESCE(SUM(o."totalAmount"),0)::float AS total,
        COALESCE(COUNT(o.id),0)::bigint AS orders
      FROM series s
      LEFT JOIN "Order" o ON DATE_TRUNC('month', o."orderDate") = s.d AND o.status <> 'CANCELLED'
      GROUP BY s.d
      ORDER BY s.d
    `);
    return rows.map((r: SalesTrendRaw) => ({ date: r.date_label, total: toNum(r.total), orders: toNum(r.orders) }));
  },

  async topProducts(limit: number): Promise<TopProductRow[]> {
    const rows = await prisma.$queryRaw<TopProductsRaw[]>(Prisma.sql`
      SELECT
        oi."productId",
        MAX(oi."productName") AS name,
        COALESCE(SUM(oi.quantity),0)::bigint AS qty_sold,
        COALESCE(SUM(oi.quantity * oi."unitPrice"),0)::float AS revenue
      FROM "OrderItem" oi
      INNER JOIN "Order" o ON o.id = oi."orderId"
      WHERE o.status = 'COMPLETED'
      GROUP BY oi."productId"
      ORDER BY revenue DESC
      LIMIT ${limit}::int
    `);
    return rows.map((r: TopProductsRaw) => ({
      productId: r.product_id,
      name: r.name,
      qtySold: toNum(r.qty_sold),
      revenue: toNum(r.revenue),
    }));
  },

  async leadPipeline(): Promise<LeadPipelineRow[]> {
    const rows = await prisma.$queryRaw<LeadPipelineRaw[]>(Prisma.sql`
      SELECT
        status,
        COUNT(*)::bigint AS count,
        COALESCE(SUM(value),0)::float AS value
      FROM "Lead"
      GROUP BY status
    `);
    const byStatus: Record<string, { count: number; value: number }> = {};
    for (const r of rows) {
      byStatus[String(r.status)] = { count: toNum(r.count), value: toNum(r.value) };
    }
    return ALL_LEAD_STATUSES.map((s: LeadStatus) => ({
      status: s,
      count: byStatus[s]?.count ?? 0,
      value: byStatus[s]?.value ?? 0,
    }));
  },

  async attendanceSummary(date?: Date): Promise<AttendanceSummaryRow> {
    const targetDate = date ? Prisma.sql`${date}::date` : Prisma.sql`CURRENT_DATE`;
    const rows = await prisma.$queryRaw<AttendanceRaw[]>(Prisma.sql`
      SELECT status, COUNT(*)::bigint AS count
      FROM "Attendance"
      WHERE "attendanceDate" = ${targetDate}
      GROUP BY status
    `);
    const byStatus: Record<string, number> = {};
    for (const r of rows) byStatus[String(r.status)] = toNum(r.count);
    const result: Partial<AttendanceSummaryRow> = {};
    for (const k of ATTENDANCE_KEYS) result[k] = byStatus[k] ?? 0;
    return result as AttendanceSummaryRow;
  },

  async recentOrders(limit: number): Promise<RecentOrderRow[]> {
    const orders = await prisma.order.findMany({
      where: {
        status: { not: "CANCELLED" },
      },
      take: limit,
      orderBy: [{ orderDate: "desc" }],
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        status: true,
        orderDate: true,
        customer: { select: { name: true } },
      },
    });
    return orders.map((o: { id: string; orderNumber: string; totalAmount: Prisma.Decimal | number; status: OrderStatus; orderDate: Date | string; customer: { name: string } | null }) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customer?.name ?? null,
      grandTotal: toNum(o.totalAmount),
      status: o.status,
      orderDate: typeof o.orderDate === "string" ? o.orderDate : o.orderDate.toISOString().slice(0, 10),
    }));
  },

  async recentActivities(limit: number): Promise<RecentActivity[]> {
    const rows = await prisma.$queryRaw<RecentActivitiesRaw[]>(Prisma.sql`
      SELECT
        al.id,
        al."createdAt" AS time,
        u."firstName" || ' ' || u."lastName" AS actor_name,
        al.action::text AS action,
        al."entityType" AS entity_type,
        COALESCE(
          al.metadata->>'description',
          al.action::text || ' ' || COALESCE(al."entityType", '') || CASE WHEN al."entityId" IS NOT NULL THEN ' ' || al."entityId" ELSE '' END
        ) AS description
      FROM "AuditLog" al
      LEFT JOIN "User" u ON u.id = al."userId"
      ORDER BY al."createdAt" DESC
      LIMIT ${limit}::int
    `);
    return rows.map((r: RecentActivitiesRaw) => ({
      id: r.id,
      time: r.time.toISOString(),
      actorName: r.actor_name ?? null,
      action: r.action,
      entityType: r.entity_type ?? null,
      description: r.description,
    }));
  },
};
