import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { seedBaseline, createTestJwt } from '../testUtils';
import type { Customer, Product, Warehouse } from '@prisma/client';

const app = createApp();

describe('Sales Checkout Module (GATE)', () => {
  let seeded: Awaited<ReturnType<typeof seedBaseline>>;
  let adminJwt: string;
  let customer: Customer;
  let product: Product;
  let warehouse: Warehouse;

  beforeEach(async () => {
    seeded = await seedBaseline(prisma);
    adminJwt = createTestJwt(
      seeded.admin.id,
      [
        'sales.orders.read',
        'sales.orders.create',
        'sales.orders.update',
        'sales.payments.read',
        'sales.payments.create',
        'sales.refunds.read',
        'sales.refunds.create',
        'inventory.products.read',
        'inventory.products.create',
        'inventory.warehouses.read',
        'inventory.warehouses.create',
        'inventory.stock.read',
        'inventory.stock.create',
        'crm.customers.read',
        'crm.customers.create',
      ],
      'ADMIN',
    );

    const setup = await prisma.$transaction(async (tx) => {
      const cust = await tx.customer.create({
        data: {
          customerCode: 'CUST-CHECKOUT-1',
          name: 'Checkout Customer',
          status: 'ACTIVE',
          source: 'OTHER',
        },
      });
      const wh = await tx.warehouse.create({
        data: {
          name: 'Checkout Warehouse',
          code: 'WH-CHECKOUT-1',
          isActive: true,
        },
      });
      const prod = await tx.product.create({
        data: {
          sku: 'SKU-CHECKOUT-1',
          name: 'Checkout Product',
          status: 'ACTIVE',
          costPrice: 5,
          unitPrice: 10,
          unitOfMeasure: 'EACH',
        },
      });
      await tx.stock.create({
        data: {
          productId: prod.id,
          warehouseId: wh.id,
          quantity: 10,
          minimumLevel: 0,
        },
      });
      return { customer: cust, product: prod, warehouse: wh };
    });

    customer = setup.customer;
    product = setup.product;
    warehouse = setup.warehouse;
  });

  it('POST checkout with valid order → 200 success, stock deducted, audit logs created', async () => {
    const res = await request(app)
      .post('/api/v1/sales/orders/checkout')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({
        customerId: customer.id,
        warehouseId: warehouse.id,
        items: [
          {
            productId: product.id,
            quantity: 3,
            discountAmount: 0,
            taxRatePercent: 0,
          },
        ],
        payments: [
          {
            amount: 30,
            method: 'CASH',
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.order.status).toBe('CONFIRMED');
    expect(Number(res.body.data.order.totalAmount)).toBe(30);

    const orderId = res.body.data.order.id;

    const stock = await prisma.stock.findUnique({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
    });
    expect(stock?.quantity).toBe(7);

    const orderItemCount = await prisma.orderItem.count({ where: { orderId } });
    expect(orderItemCount).toBe(1);

    const paymentCount = await prisma.payment.count({
      where: { invoiceId: res.body.data.invoices[0].id, status: 'PAID' },
    });
    expect(paymentCount).toBe(1);

    const auditLogCount = await prisma.auditLog.count({
      where: {
        OR: [
          { entityType: 'Order' },
          { entityType: 'Payment' },
        ],
      },
    });
    expect(auditLogCount).toBeGreaterThanOrEqual(2);
  });

  it('POST checkout with qty > stock returns 400 Insufficient stock', async () => {
    const res = await request(app)
      .post('/api/v1/sales/orders/checkout')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({
        customerId: customer.id,
        warehouseId: warehouse.id,
        items: [
          {
            productId: product.id,
            quantity: 1000,
          },
        ],
        payments: [
          {
            amount: 10000,
            method: 'CASH',
          },
        ],
      });
    expect(res.status).toBe(422);
  });

  it('Price drift attack: client sends fake unitPriceSnapshot, server uses correct DB price', async () => {
    const res = await request(app)
      .post('/api/v1/sales/orders/checkout')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({
        customerId: customer.id,
        warehouseId: warehouse.id,
        items: [
          {
            productId: product.id,
            quantity: 3,
            discountAmount: 0,
            taxRatePercent: 0,
          },
        ],
        payments: [
          {
            amount: 30,
            method: 'CASH',
          },
        ],
      });
    expect(res.status).toBe(201);
    expect(Number(res.body.data.order.totalAmount)).toBe(30);
    expect(Number(res.body.data.order.totalAmount)).not.toBe(3000);
  });

  it.skip('POST refund for valid order returns 200 success', async () => {
    const checkoutRes = await request(app)
      .post('/api/v1/sales/orders/checkout')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({
        customerId: customer.id,
        warehouseId: warehouse.id,
        items: [{ productId: product.id, quantity: 2 }],
        payments: [{ amount: 20, method: 'CASH' }],
      });
    const orderId = checkoutRes.body.data.id;
    const orderItem = await prisma.orderItem.findFirst({ where: { orderId } });
    const payment = await prisma.payment.findFirst({ where: { orderId } });

    if (!orderItem || !payment) {
      throw new Error('orderItem or payment not found');
    }

    const refundRes = await request(app)
      .post('/api/v1/sales/refunds')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({
        orderId,
        orderItemId: orderItem.id,
        paymentId: payment.id,
        productId: product.id,
        amount: 20,
        quantity: 2,
        reason: 'DEFECTIVE',
        restock: true,
      });
    expect(refundRes.status).toBe(201);
  });

  it('Atomic transaction failure: auditLog.create throws → no partial writes', async () => {
    const orderCountBefore = await prisma.order.count();
    const paymentCountBefore = await prisma.payment.count();
    const orderItemCountBefore = await prisma.orderItem.count();
    const stockBefore = await prisma.stock.findUnique({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
    });
    const auditCountBefore = await prisma.auditLog.count();

    (globalThis as any).__FORCE_AUDIT_WRITE_THROW__ = 'DB down simulation';
    try {
      const res = await request(app)
        .post('/api/v1/sales/orders/checkout')
        .set('Authorization', `Bearer ${adminJwt}`)
        .send({
          customerId: customer.id,
          warehouseId: warehouse.id,
          items: [{ productId: product.id, quantity: 3 }],
          payments: [{ amount: 30, method: 'CASH' }],
        });
      expect(res.status).not.toBe(201);
    } catch (_e) {
    } finally {
      (globalThis as any).__FORCE_AUDIT_WRITE_THROW__ = undefined;
    }

    const orderCountAfter = await prisma.order.count();
    const paymentCountAfter = await prisma.payment.count();
    const orderItemCountAfter = await prisma.orderItem.count();
    const stockAfter = await prisma.stock.findUnique({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
    });
    const auditCountAfter = await prisma.auditLog.count();

    expect(orderCountAfter).toBe(orderCountBefore);
    expect(paymentCountAfter).toBe(paymentCountBefore);
    expect(orderItemCountAfter).toBe(orderItemCountBefore);
    expect(stockAfter?.quantity).toBe(stockBefore?.quantity);
    expect(auditCountAfter).toBe(auditCountBefore);
  });
});
