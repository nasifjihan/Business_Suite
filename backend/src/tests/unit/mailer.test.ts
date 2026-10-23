/**
 * Unit tests for the mailer module itself — no HTTP, no database.
 *
 * These run with MAIL_ENABLED unset (= false, the default), which is the mode
 * every local checkout is in. That is the mode worth pinning: mail must be
 * inert, and must not throw, when nobody configured it.
 */
import { describe, it, expect } from 'vitest';
import { sendMail, renderPasswordResetEmail } from '@/lib/mailer';
import { CONFIG } from '@/config/env';

describe('mailer', () => {
  it('is disabled by default in the test environment', () => {
    // Guards the assumption behind the next test: if someone sets
    // MAIL_ENABLED=true in backend/.env, this fails loudly instead of letting
    // the "does not send" assertion pass for the wrong reason.
    expect(CONFIG.mail.enabled).toBe(false);
  });

  it('sendMail returns false — and does not throw — when mail is disabled', async () => {
    const result = await sendMail({
      to: 'someone@example.com',
      subject: 'Subject',
      text: 'plain body',
      html: '<p>html body</p>',
    });
    expect(result).toBe(false);
  });

  it('renderPasswordResetEmail puts the reset link in the subject, text and html parts', () => {
    const link = 'http://localhost:3000/reset-password?token=abc-123';
    const mail = renderPasswordResetEmail({
      firstName: 'Admin',
      resetLink: link,
      expiresInMinutes: 15,
    });

    expect(mail.subject).toMatch(/password/i);
    expect(mail.text).toContain(link);
    expect(mail.html).toContain(link);
    // Personalised when a first name is available, and it is a real href —
    // the user should be able to click the button, not copy a bare URL.
    expect(mail.text).toContain('Hi Admin,');
    expect(mail.html).toContain(`href="${link}"`);
    expect(mail.text).toContain('15 minutes');
  });

  it('renderPasswordResetEmail falls back to a nameless greeting', () => {
    const mail = renderPasswordResetEmail({
      firstName: null,
      resetLink: 'http://localhost:3000/reset-password?token=x',
      expiresInMinutes: 15,
    });
    expect(mail.text.startsWith('Hi,')).toBe(true);
  });
});
