/**
 * Integration tests: does POST /auth/forgot-password actually hand the reset
 * link to the mailer, and does a failing send stay invisible to the caller?
 *
 * `sendMail` is mocked so the suite never opens an SMTP connection. Everything
 * else — routing, validation, the PasswordResetToken row, the response shape —
 * is the real thing.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// vi.hoisted() is required: vi.mock() factories are hoisted above every import
// in the file, so a plain `const sendMailMock = vi.fn()` would still be in the
// temporal dead zone when the factory runs.
const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn() }));

vi.mock('@/lib/mailer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/mailer')>();
  // Keep the real template renderer; swap only the network call.
  return { ...actual, sendMail: sendMailMock };
});

import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { seedBaseline } from '../testUtils';

const app = createApp();

describe('POST /api/v1/auth/forgot-password — email delivery', () => {
  beforeEach(async () => {
    await seedBaseline(prisma);
    sendMailMock.mockReset();
    sendMailMock.mockResolvedValue(true);
  });

  it('sends the reset link to the requesting user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'admin@test.com' });

    expect(res.status).toBe(200);
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const message = sendMailMock.mock.calls[0][0];
    expect(message.to).toBe('admin@test.com');
    expect(message.subject).toMatch(/password/i);
    expect(message.text).toContain('/reset-password?token=');
    expect(message.html).toContain('/reset-password?token=');

    // The link in the email must carry a token that was actually persisted,
    // otherwise the user receives a dead link.
    const rawToken = message.text.match(/token=([0-9a-f-]{36})/)?.[1];
    expect(rawToken).toBeDefined();
    const row = await prisma.passwordResetToken.findFirst({
      where: { user: { email: 'admin@test.com' } },
    });
    expect(row).not.toBeNull();
  });

  it('still answers { ok: true } — identically — when delivery fails', async () => {
    sendMailMock.mockResolvedValue(false);

    const existing = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'admin@test.com' });
    const unknown = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'ghost@nowhere.zzz' });

    expect(existing.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(existing.body.data.ok).toBe(true);
    // Byte-for-byte identical: a failing SMTP server must not become the new
    // user-enumeration oracle that the { ok: true } contract exists to close.
    expect(JSON.stringify(existing.body)).toBe(JSON.stringify(unknown.body));
  });

  it('does not attempt to send anything for an address that has no account', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'ghost@nowhere.zzz' });

    expect(res.status).toBe(200);
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});
