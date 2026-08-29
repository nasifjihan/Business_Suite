import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { seedBaseline, createTestJwt } from '../testUtils';

const app = createApp();

describe('CRM Customers Module', () => {
  let seeded: Awaited<ReturnType<typeof seedBaseline>>;
  let adminJwt: string;

  beforeEach(async () => {
    seeded = await seedBaseline(prisma);
    adminJwt = createTestJwt(seeded.admin.id, ['crm.customers.read', 'crm.customers.create', 'crm.customers.delete'], 'ADMIN');
  });

  it('GET /api/v1/crm/customers with admin JWT returns 200 with pagination meta', async () => {
    const res = await request(app)
      .get('/api/v1/crm/customers')
      .set('Authorization', `Bearer ${adminJwt}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta.page).toBeDefined();
    expect(res.body.meta.totalItems).toBeDefined();
  });

  it('GET /api/v1/crm/customers without JWT returns 401', async () => {
    const res = await request(app).get('/api/v1/crm/customers');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/crm/customers with valid minimal body returns 201 with id', async () => {
    const res = await request(app)
      .post('/api/v1/crm/customers')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({ name: 'Test Co' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
  });

  it('POST /api/v1/crm/customers with unknown extra field returns 422 strict rejection', async () => {
    const res = await request(app)
      .post('/api/v1/crm/customers')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({ name: 'Test', unknownGarbageField: 'hacker' });
    expect(res.status).toBe(422);
  });

  it('POST /api/v1/crm/customers with duplicate email returns 409 conflict (P2002)', async () => {
    await request(app)
      .post('/api/v1/crm/customers')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({ name: 'Test Co 1', email: 'dup@test.com' });
    const dupRes = await request(app)
      .post('/api/v1/crm/customers')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({ name: 'Test Co 2', email: 'dup@test.com' });
    expect(dupRes.status).toBe(409);
  });

  it('GET /api/v1/crm/customers/:id by UUID returns 200 with correct name', async () => {
    const createRes = await request(app)
      .post('/api/v1/crm/customers')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({ name: 'Test Co' });
    const id = createRes.body.data.id;
    const getRes = await request(app)
      .get(`/api/v1/crm/customers/${id}`)
      .set('Authorization', `Bearer ${adminJwt}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.name).toBe('Test Co');
  });

  it('DELETE /api/v1/crm/customers/:id with fictional UUID returns 404 (P2025)', async () => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .delete(`/api/v1/crm/customers/${fakeUuid}`)
      .set('Authorization', `Bearer ${adminJwt}`);
    expect(res.status).toBe(404);
  });

  it('GET /api/v1/crm/customers?search=Test filters name correctly', async () => {
    await request(app)
      .post('/api/v1/crm/customers')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({ name: 'Test Customer ABC' });
    await request(app)
      .post('/api/v1/crm/customers')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({ name: 'Unrelated XYZ Corp' });
    const res = await request(app)
      .get('/api/v1/crm/customers?search=Test')
      .set('Authorization', `Bearer ${adminJwt}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    for (const c of res.body.data) {
      expect(c.name.toLowerCase()).toContain('test');
    }
  });
});
