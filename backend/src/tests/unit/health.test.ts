import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { seedBaseline, resetDatabase } from '../testUtils';

describe('Health Module', () => {
  let app: Express;
  let seeded: Awaited<ReturnType<typeof seedBaseline>>;

  beforeAll(async () => {
    seeded = await seedBaseline(prisma);
    app = createApp();
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
  });

  it('GET /health → 200 OK success true data.status ok, db connected, uptimeSeconds > 0, version is non-empty string, timestamp matches ISO', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.db).toBe('connected');
    expect(typeof res.body.data.uptimeSeconds).toBe('number');
    expect(res.body.data.uptimeSeconds).toBeGreaterThan(0);
    expect(typeof res.body.data.version).toBe('string');
    expect(res.body.data.version.length).toBeGreaterThan(0);
    expect(typeof res.body.data.timestamp).toBe('string');
    expect(res.body.data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('GET /health without Authorization header still returns 200 (public endpoint unauthenticated)', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.status).toBe('ok');
  });

  it('GET /api/v1/health (the old path still also) returns same 200 + status ok (compat check)', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.status).toBe('ok');
  });

  it.skip('prisma SELECT 1 mocks failure → returns 503 service unavailable data.db disconnected', async () => {
    const originalQueryRaw = prisma.$queryRawUnsafe;
    prisma.$queryRawUnsafe = (() => {
      throw new Error('DB connection failed');
    }) as typeof prisma.$queryRawUnsafe;

    try {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.data?.db).toBe('disconnected');
    } finally {
      prisma.$queryRawUnsafe = originalQueryRaw;
    }
  });
});
