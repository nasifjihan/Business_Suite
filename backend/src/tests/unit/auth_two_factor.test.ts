/**
 * Integration tests for two-factor authentication.
 *
 * These drive the real HTTP surface end to end — no service mocking — because
 * the thing most likely to break is the *contract between the two login steps*
 * (does step 1 stop issuing a session? does step 2 issue a real one?), and that
 * contract only exists at the route layer.
 *
 * TOTP codes are generated with the same library the server verifies with, from
 * the secret the server itself handed out in the setup response. That keeps the
 * test honest: it proves the QR/manual-entry secret really is the one enrolled.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { generate } from 'otplib';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { CONFIG } from '@/config/env';
import { decryptSecret } from '@/utils/crypto';
import { seedBaseline } from '../testUtils';

const app = createApp();

const PASSWORD = 'TestPass123!';
const EMAIL = 'admin@test.com';

/** Log in with password only and return the access token + refresh cookies. */
async function login(email = EMAIL) {
  return request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
}

/** A live code for whatever secret is currently enrolled for `userId`. */
async function currentTotpCode(userId: string): Promise<string> {
  const row = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const plain = decryptSecret(row.twoFactorSecret!, CONFIG.twoFactor.encryptionKey);
  expect(plain).not.toBeNull();
  return generate({ secret: plain! });
}

/** Complete step 2 of login and return a real access token. */
async function completeLogin(): Promise<string> {
  const step1 = await login();
  const res = await request(app)
    .post('/api/v1/auth/2fa/verify')
    .send({
      challengeToken: step1.body.data.challengeToken,
      code: await currentTotpCode(EMAIL_USER_ID),
    });
  expect(res.status).toBe(200);
  return res.body.data.accessToken as string;
}

/** Set after each `seedBaseline` so helpers do not need the id threaded through. */
let EMAIL_USER_ID = '';

/** Take the account from "2FA off" to "2FA on" through the public API only,
 * exactly as the profile page does. Returns the plaintext recovery codes. */
async function enrolTwoFactor(): Promise<{ recoveryCodes: string[] }> {
  const before = await login();
  const accessToken = before.body.data.accessToken as string;

  const setup = await request(app)
    .post('/api/v1/auth/2fa/setup')
    .set('Authorization', `Bearer ${accessToken}`);
  expect(setup.status).toBe(200);

  const enable = await request(app)
    .post('/api/v1/auth/2fa/enable')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ code: await generate({ secret: setup.body.data.secret }) });

  expect(enable.status).toBe(200);
  return { recoveryCodes: enable.body.data.recoveryCodes };
}

describe('Two-factor authentication', () => {
  let seeded: Awaited<ReturnType<typeof seedBaseline>>;

  beforeEach(async () => {
    seeded = await seedBaseline(prisma);
    EMAIL_USER_ID = seeded.admin.id;
  });

  it('leaves a login with 2FA off completely unchanged', async () => {
    const res = await login();

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.id).toBe(seeded.admin.id);
    // The discriminator must be absent, not `false` — the frontend branches on
    // its presence.
    expect(res.body.data.twoFactorRequired).toBeUndefined();
    expect(String(res.headers['set-cookie'])).toContain('refreshToken=');
  });

  it('setup returns a scannable QR code and a manual-entry secret, but does not enable 2FA', async () => {
    const before = await login();
    const res = await request(app)
      .post('/api/v1/auth/2fa/setup')
      .set('Authorization', `Bearer ${before.body.data.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.secret).toMatch(/^[A-Z2-7]+$/);
    expect(res.body.data.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    expect(res.body.data.qrDataUrl).toMatch(/^data:image\/png;base64,/);

    // Enrolment is two-phase on purpose: abandoning setup must not lock the
    // account behind a secret the user never successfully scanned.
    const stillPasswordOnly = await login();
    expect(stillPasswordOnly.body.data.accessToken).toBeDefined();
    expect(stillPasswordOnly.body.data.twoFactorRequired).toBeUndefined();
  });

  it('enable then login returns a challenge with no session, and verify completes the login', async () => {
    const { recoveryCodes } = await enrolTwoFactor();
    // Exactly ten codes, human-transcribable format (5-5-5-5 hex).
    expect(recoveryCodes).toHaveLength(10);
    expect(recoveryCodes[0]).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}-[0-9A-F]{5}-[0-9A-F]{5}$/);

    const step1 = await login();
    expect(step1.status).toBe(200);
    expect(step1.body.data.twoFactorRequired).toBe(true);
    expect(step1.body.data.challengeToken).toBeDefined();
    // The whole point of the challenge step: no session leaks out of step 1.
    expect(step1.body.data.accessToken).toBeUndefined();
    expect(step1.headers['set-cookie']).toBeUndefined();

    // The secret is stored encrypted, never in plaintext.
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: seeded.admin.id } });
    expect(stored.twoFactorSecret!.startsWith('v1.')).toBe(true);
    expect(stored.twoFactorSecret).not.toContain(
      decryptSecret(stored.twoFactorSecret!, CONFIG.twoFactor.encryptionKey)!,
    );

    const step2 = await request(app)
      .post('/api/v1/auth/2fa/verify')
      .send({ challengeToken: step1.body.data.challengeToken, code: await currentTotpCode(seeded.admin.id) });

    expect(step2.status).toBe(200);
    expect(step2.body.data.accessToken).toBeDefined();
    expect(step2.body.data.user.id).toBe(seeded.admin.id);
    expect(String(step2.headers['set-cookie'])).toContain('refreshToken=');
  });

  it('rejects a wrong code and issues no session', async () => {
    await enrolTwoFactor();
    const step1 = await login();

    const res = await request(app)
      .post('/api/v1/auth/2fa/verify')
      .send({ challengeToken: step1.body.data.challengeToken, code: '000000' });

    expect(res.status).toBe(401);
    expect(res.body.data?.accessToken).toBeUndefined();
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('accepts a recovery code once and rejects it on reuse', async () => {
    const { recoveryCodes } = await enrolTwoFactor();
    const recoveryCode = recoveryCodes[0];

    const first = await login();
    const firstRes = await request(app)
      .post('/api/v1/auth/2fa/verify')
      .send({ challengeToken: first.body.data.challengeToken, code: recoveryCode });
    expect(firstRes.status).toBe(200);
    expect(firstRes.body.data.accessToken).toBeDefined();

    // Same code, fresh challenge: must now fail, because a stolen code list is
    // worth one login per code rather than unlimited access.
    const second = await login();
    const secondRes = await request(app)
      .post('/api/v1/auth/2fa/verify')
      .send({ challengeToken: second.body.data.challengeToken, code: recoveryCode });
    expect(secondRes.status).toBe(401);

    const remaining = await prisma.user.findUniqueOrThrow({
      where: { id: seeded.admin.id },
    });
    expect(remaining.twoFactorRecoveryCodes).toHaveLength(9);
  });

  it('does not accept the challenge token as a Bearer access token', async () => {
    await enrolTwoFactor();
    const step1 = await login();
    const challengeToken = step1.body.data.challengeToken as string;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${challengeToken}`);

    expect(res.status).toBe(401);
  });

  it('disable requires the password, wipes the secret, and restores password-only login', async () => {
    await enrolTwoFactor();
    const accessToken = await completeLogin();

    const wrongPassword = await request(app)
      .post('/api/v1/auth/2fa/disable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ password: 'NotMyPassword1!' });
    expect(wrongPassword.status).toBe(422);
    // A rejected attempt must not have changed anything.
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: seeded.admin.id } })).twoFactorEnabled,
    ).toBe(true);

    const ok = await request(app)
      .post('/api/v1/auth/2fa/disable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ password: PASSWORD });
    expect(ok.status).toBe(200);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: seeded.admin.id } });
    expect(row.twoFactorEnabled).toBe(false);
    expect(row.twoFactorSecret).toBeNull();
    expect(row.twoFactorRecoveryCodes).toHaveLength(0);

    const after = await login();
    expect(after.body.data.accessToken).toBeDefined();
    expect(after.body.data.twoFactorRequired).toBeUndefined();
  });

  it('reports status for the profile card', async () => {
    const before = await login();
    const offRes = await request(app)
      .get('/api/v1/auth/2fa/status')
      .set('Authorization', `Bearer ${before.body.data.accessToken}`);
    expect(offRes.status).toBe(200);
    expect(offRes.body.data).toEqual({ enabled: false, recoveryCodesRemaining: 0 });

    await enrolTwoFactor();
    const accessToken = await completeLogin();
    const onRes = await request(app)
      .get('/api/v1/auth/2fa/status')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(onRes.status).toBe(200);
    expect(onRes.body.data).toEqual({ enabled: true, recoveryCodesRemaining: 10 });
  });

  it('rejects 2FA management calls that carry no access token at all', async () => {
    for (const call of [
      request(app).get('/api/v1/auth/2fa/status'),
      request(app).post('/api/v1/auth/2fa/setup'),
      request(app).post('/api/v1/auth/2fa/enable').send({ code: '123456' }),
      request(app).post('/api/v1/auth/2fa/disable').send({ password: PASSWORD }),
    ]) {
      expect((await call).status).toBe(401);
    }
  });
});
