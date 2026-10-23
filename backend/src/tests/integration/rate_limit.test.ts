import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
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
    const { createApp } = await import('../../app.js');
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

  it('Global limiter: from a fresh app, request 101 of 110 returns 429', async () => {
    // This used to run against the shared `app` above and assert the 429 landed
    // near index 100 — which it never could, because the login test above has
    // already spent part of the same 100-request budget (the store is keyed by
    // IP, and every supertest call comes from loopback). It also carried a
    // "2100 requests → 429 at 2001" sibling that has been deleted: it assumed
    // authedLimiter (max 2000) guards authenticated routes, but that limiter is
    // exported from middleware/rateLimiter.ts and never mounted anywhere, so the
    // app-wide 100 is the only ceiling that applies here.
    vi.resetModules();
    const { createApp: createFreshApp } = await import('../../app.js');
    const freshApp = createFreshApp();

    // The suite's afterEach wipes the database, but this file seeds only once in
    // beforeAll — so the admin from beforeAll is long gone by now, and
    // authenticate() looks the user up on every request (it wants a fresh
    // status and the role's permissions from the DB, not the JWT's claims).
    // Re-seed and mint a token for the new id.
    const freshSeed = await seedBaseline(prisma);
    const jwt = createTestJwt(freshSeed.admin.id, ['crm.customers.read'], 'ADMIN');

    let first429 = -1;
    let firstStatus = 0;
    for (let i = 0; i < 110; i++) {
      const res = await request(freshApp)
        .get('/api/v1/crm/customers?pageSize=1')
        .set('Authorization', `Bearer ${jwt}`);
      if (i === 0) firstStatus = res.status;
      if (res.status === 429) {
        first429 = i;
        break;
      }
    }

    // The first call must genuinely succeed, otherwise a 401/403 misread as the
    // limiter would make this pass for the wrong reason.
    expect(firstStatus).toBe(200);
    expect(first429).toBe(100);
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
