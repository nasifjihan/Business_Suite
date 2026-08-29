import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { prisma } from '@/lib/prisma';
import { seedBaseline, createTestJwt } from '../testUtils';
import type { Express } from 'express';

describe('Rate Limiting & Security (Integration)', () => {
  let seeded: Awaited<ReturnType<typeof seedBaseline>>;
  let adminJwt: string;
  let app: Express;

  beforeAll(async () => {
    (globalThis as any).__FORCE_RATE_LIMIT_TEST__ = true;
    await vi.dynamicImportSettled?.();
    vi.resetModules();
    const { createApp } = await import('@/app');
    app = createApp();
    seeded = await seedBaseline(prisma);
    adminJwt = createTestJwt(seeded.admin.id, ['inventory.products.read', 'crm.customers.read'], 'ADMIN');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    (globalThis as any).__FORCE_RATE_LIMIT_TEST__ = undefined;
  });

  it('15 rapid POST /api/v1/auth/login → 11th+ returns 429 Too Many Requests', async () => {
    let first429 = -1;
    for (let i = 0; i < 15; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: `rate-${i}-${Date.now()}-${i}@test.com`, password: 'WrongPass123!' });
      if (res.status === 429 && first429 === -1) {
        first429 = i;
      }
      if (first429 !== -1) break;
    }
    expect(first429).toBeGreaterThanOrEqual(9);
    expect(first429).toBeLessThanOrEqual(12);
  });

  it.skip('2100 GET /api/v1/inventory/products with admin JWT → 2001st returns 429 (slow)', async () => {
    let got429 = false;
    for (let i = 0; i < 2100; i++) {
      const res = await request(app)
        .get('/api/v1/inventory/products?pageSize=1')
        .set('Authorization', `Bearer ${adminJwt}`);
      if (res.status === 429) {
        got429 = true;
        expect(i).toBeGreaterThanOrEqual(1999);
        break;
      }
    }
    expect(got429).toBe(true);
  }, 120000);

  it.skip('110 anon GET /api/v1/crm/customers → 101st returns 429 (slow)', async () => {
    let got429 = false;
    for (let i = 0; i < 110; i++) {
      const res = await request(app).get('/api/v1/crm/customers?pageSize=1');
      if (res.status === 429) {
        got429 = true;
        expect(i).toBeGreaterThanOrEqual(99);
        break;
      }
    }
    expect(got429).toBe(true);
  }, 60000);

  it('Wrong Origin header → access-control-allow-origin is NOT wildcard *', async () => {
    const res = await request(app)
      .get('/api/v1/crm/customers')
      .set('Origin', 'https://evil.com');
    const acao = res.headers['access-control-allow-origin'];
    expect(acao).not.toBe('*');
    expect(['undefined', undefined, ''].includes(String(acao)) || acao === undefined || acao !== '*').toBe(true);
  });

  it('vi.clearAllMocks resets mock state between tests', async () => {
    const spy = vi.fn();
    spy();
    expect(spy).toHaveBeenCalledTimes(1);
    vi.clearAllMocks();
    expect(spy).toHaveBeenCalledTimes(0);
  });
});
