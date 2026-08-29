import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { seedBaseline, createTestJwt } from '../testUtils';

const app = createApp();

describe('Inventory Products Module', () => {
  let seeded: Awaited<ReturnType<typeof seedBaseline>>;
  let adminJwt: string;

  beforeEach(async () => {
    seeded = await seedBaseline(prisma);
    adminJwt = createTestJwt(
      seeded.admin.id,
      ['inventory.products.read', 'inventory.products.create', 'inventory.products.update'],
      'ADMIN',
    );
  });

  it('GET /api/v1/inventory/products with admin JWT returns 200 with pagination meta', async () => {
    const res = await request(app)
      .get('/api/v1/inventory/products')
      .set('Authorization', `Bearer ${adminJwt}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.meta).toBeDefined();
    expect(res.body.data.meta.page).toBeDefined();
    expect(res.body.data.meta.totalItems).toBeDefined();
  });

  it('POST /api/v1/inventory/products with minimal valid body returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/products')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({ name: 'TestProduct', costPrice: 5, unitPrice: 10 });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
  });

  it('POST duplicate SKU returns 409 conflict (P2002) or 422 validator duplicate', async () => {
    await request(app)
      .post('/api/v1/inventory/products')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({ sku: 'DUP123', name: 'Product 1', costPrice: 5, unitPrice: 10 });
    const dupRes = await request(app)
      .post('/api/v1/inventory/products')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({ sku: 'DUP123', name: 'Product 2', costPrice: 5, unitPrice: 10 });
    expect([409, 422]).toContain(dupRes.status);
  });

  it('GET /api/v1/inventory/products?status=ACTIVE filters correctly', async () => {
    await request(app)
      .post('/api/v1/inventory/products')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({ name: 'Active Product', costPrice: 5, unitPrice: 10, status: 'ACTIVE' });
    await request(app)
      .post('/api/v1/inventory/products')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({ name: 'Inactive Product', costPrice: 5, unitPrice: 10, status: 'INACTIVE' });
    const res = await request(app)
      .get('/api/v1/inventory/products?status=ACTIVE')
      .set('Authorization', `Bearer ${adminJwt}`);
    expect(res.status).toBe(200);
    for (const p of res.body.data.items) {
      expect(p.status).toBe('ACTIVE');
    }
  });

  it('GET /api/v1/inventory/products?pageSize=100 returns 200 (under MAX cap)', async () => {
    const res = await request(app)
      .get('/api/v1/inventory/products?pageSize=100')
      .set('Authorization', `Bearer ${adminJwt}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/v1/inventory/products?pageSize=101 returns 422 validation error (MAX cap 100)', async () => {
    const res = await request(app)
      .get('/api/v1/inventory/products?pageSize=101')
      .set('Authorization', `Bearer ${adminJwt}`);
    expect(res.status).toBe(422);
  });

  it('PATCH /api/v1/inventory/products/:id updates unitPrice correctly', async () => {
    const createRes = await request(app)
      .post('/api/v1/inventory/products')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({ name: 'UpdateMe', costPrice: 5, unitPrice: 10 });
    const id = createRes.body.data.id;
    const patchRes = await request(app)
      .patch(`/api/v1/inventory/products/${id}`)
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({ unitPrice: 19.99 });
    expect(patchRes.status).toBe(200);
    expect(Number(patchRes.body.data.unitPrice)).toBe(19.99);
  });
});
