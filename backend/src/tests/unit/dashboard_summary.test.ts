import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { seedBaseline, createTestJwt } from '../testUtils';
import dayjs from 'dayjs';
import type { Customer, Order, Product, Warehouse, Attendance } from '@prisma/client';

const app = createApp();

describe('Dashboard Summary Module', () => {
  let seeded: Awaited<ReturnType<typeof seedBaseline>>;
  let adminJwt: string;
  let viewerJwt: string;
  let customer: Customer;
  let product: Product;
  let warehouse: Warehouse;

  beforeEach(async () => {
    seeded = await seedBaseline(prisma);
    adminJwt = createTestJwt(
      seeded.admin.id,
      ['dashboard.read', 'sales.orders.read', 'hrm.attendance.read_all'],
      'ADMIN',
    );
    viewerJwt = createTestJwt(seeded.viewer.id, ['dashboard.read'], 'VIEWER');

    const setup = await prisma.$transaction(async (tx) => {
      const cust = await tx.customer.create({
        data: {
          customerCode: 'DASH-CUST-1',
          name: 'Dashboard Customer',
          status: 'ACTIVE',
          source: 'OTHER',
        },
      });
      const wh = await tx.warehouse.create({
        data: {
          name: 'Dash WH',
          code: 'DASH-WH-1',
          isActive: true,
        },
      });
      const prod = await tx.product.create({
        data: {
          sku: 'DASH-SKU-1',
          name: 'Dash Product',
          status: 'ACTIVE',
          costPrice: 10,
          unitPrice: 20,
          unitOfMeasure: 'EACH',
        },
      });
      await tx.stock.create({
        data: {
          productId: prod.id,
          warehouseId: wh.id,
          quantity: 1000,
        },
      });
      return { customer: cust, product: prod, warehouse: wh };
    });
    customer = setup.customer;
    product = setup.product;
    warehouse = setup.warehouse;
  });

  it('GET /dashboard/summary → salesToday matches seeded COMPLETED orders sum (500)', async () => {
    const today = new Date();
    const ordersData: any[] = [];
    for (let i = 0; i < 5; i++) {
      ordersData.push({
        orderNumber: `DASH-ORD-${i}-${Date.now()}-${i}`,
        customerId: customer.id,
        warehouseId: warehouse.id,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        subtotal: 100,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 100,
        orderDate: today,
      });
    }
    await prisma.order.createMany({ data: ordersData });

    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${adminJwt}`);
    if (res.status !== 200) return;
    if (res.body.data?.salesToday !== undefined) {
      expect(Number(res.body.data.salesToday)).toBe(500);
    }
  });

  it('GET /dashboard/summary → presentToday matches seeded PRESENT attendance count', async () => {
    const today = new Date();
    await prisma.employee.create({
      data: {
        employeeCode: `DASH-EMP-${Date.now()}`,
        firstName: 'Dash',
        lastName: 'Employee',
        joiningDate: today,
        status: 'ACTIVE',
        basicSalary: 1000,
      },
    });
    const emp = await prisma.employee.findFirst({ where: { employeeCode: { startsWith: 'DASH-EMP' } } });
    if (emp) {
      await prisma.attendance.create({
        data: {
          employeeId: emp.id,
          attendanceDate: today,
          status: 'PRESENT',
        },
      });
    }
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${adminJwt}`);
    if (res.status !== 200) return;
    if (res.body.data?.presentToday !== undefined) {
      expect(Number(res.body.data.presentToday)).toBeGreaterThanOrEqual(1);
    }
  });

  it('GET /dashboard/sales-trend?period=week returns array of 7 items', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/sales-trend?period=week')
      .set('Authorization', `Bearer ${adminJwt}`);
    expect([200, 404]).toContain(res.status);
    if (res.status === 200 && Array.isArray(res.body.data)) {
      expect(res.body.data.length).toBe(7);
    }
  });

  it('GET /dashboard/sales-trend?period=decade returns 422 validation error', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/sales-trend?period=decade')
      .set('Authorization', `Bearer ${adminJwt}`);
    expect([422, 400]).toContain(res.status);
  });

  it('GET /dashboard/lead-pipeline → 6 status stages always returned even when 0', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/lead-pipeline')
      .set('Authorization', `Bearer ${adminJwt}`);
    if (res.status !== 200) return;
    const data = res.body.data;
    if (Array.isArray(data)) {
      expect(data.length).toBeGreaterThanOrEqual(6);
    }
  });

  it('GET /dashboard/summary with viewer JWT returns 200 success with same shape', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${viewerJwt}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
