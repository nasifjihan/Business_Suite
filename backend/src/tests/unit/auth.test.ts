import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { seedBaseline, createTestJwt } from '../testUtils';

const app = createApp();

describe('Auth Module', () => {
  let seeded: Awaited<ReturnType<typeof seedBaseline>>;

  beforeEach(async () => {
    seeded = await seedBaseline(prisma);
  });

  it('POST /api/v1/auth/login with empty body returns 422 validation error', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/auth/login with valid credentials returns 200 with tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'TestPass123!' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.tokenType).toBe('Bearer');
    expect(res.body.data.user.id).toBe(seeded.admin.id);
  });

  it('POST /api/v1/auth/login with wrong password returns 401 generic message', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'WrongPass123!' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Invalid email or password');
  });

  it('POST /api/v1/auth/login with non-existent email returns identical 401 message (no enumeration)', async () => {
    const wrongPwRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'WrongPass123!' });
    const missingEmailRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nonexistent@test.com', password: 'AnyPass123!' });
    expect(missingEmailRes.status).toBe(401);
    expect(missingEmailRes.body.error.message).toBe(wrongPwRes.body.error.message);
  });

  it.skip('POST /api/v1/auth/register with existing email returns 409 conflict', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'admin@test.com', password: 'TestPass123!', firstName: 'Test', lastName: 'Dup' });
    expect(res.status).toBe(409);
  });

  it.skip('POST /api/v1/auth/register with valid user returns 201 created', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'newuser@test.com', password: 'TestPass123!', firstName: 'New', lastName: 'User' });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
  });

  it('POST /api/v1/auth/change-password with invalid JWT returns 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', 'Bearer invalid.jwt.token')
      .send({ currentPassword: 'TestPass123!', newPassword: 'NewTestPass123!' });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/auth/refresh with valid refresh token returns 200 new access_token', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'TestPass123!' });
    const cookies = loginRes.headers['set-cookie'];
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookies);
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).toBeDefined();
    expect(refreshRes.body.data.accessToken).not.toBe(loginRes.body.data.accessToken);
  });

  it('POST /api/v1/auth/refresh with invalid refresh token returns 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refreshToken=invalid.token.here');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/auth/logout with valid token returns 200 success', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'TestPass123!' });
    const cookies = loginRes.headers['set-cookie'];
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookies);
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.data.ok).toBe(true);
  });

  it.skip('Auth strict rate limiter triggers 429 after 10 rapid login attempts', async () => {
    (globalThis as any).__FORCE_RATE_LIMIT_TEST__ = true;
    try {
      let status429Hit = false;
      for (let i = 0; i < 15; i++) {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: `ratelimit${i}@test.com`, password: 'WrongPass123!' });
        if (res.status === 429) {
          status429Hit = true;
          break;
        }
      }
      expect(status429Hit).toBe(true);
    } finally {
      delete (globalThis as any).__FORCE_RATE_LIMIT_TEST__;
    }
  });

  it('POST /api/v1/auth/forgot-password returns same success for both existing and non-existing email (no enumeration)', async () => {
    const existingRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'admin@test.com' });
    const nonExistingRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nouser@noemail.zzz' });
    expect(existingRes.status).toBe(200);
    expect(nonExistingRes.status).toBe(200);
    expect(existingRes.body.data.ok).toBe(true);
    expect(nonExistingRes.body.data.ok).toBe(true);
    expect(JSON.stringify(nonExistingRes.body)).toBe(JSON.stringify(existingRes.body));
  });
});
