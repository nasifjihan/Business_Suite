/**
 * Outbound email — thin wrapper over Nodemailer.
 * ------------------------------------------------------------------
 * Two rules this module exists to enforce:
 *
 *  1. `sendMail()` NEVER throws. Sending is best-effort, exactly like
 *     `writeAudit()` in middleware/audit.ts. A dead SMTP host must not turn a
 *     failed password-reset email into a 500 on an endpoint whose entire job is
 *     to answer `{ ok: true }` for every input. Callers get a boolean.
 *
 *  2. Configuration is read from CONFIG.mail only. No process.env here — see
 *     config/env.ts for why (Phase 14 bug #5).
 *
 * When MAIL_ENABLED=false the transport is never built and sendMail() returns
 * false immediately, which is what lets `forgotPassword` keep its
 * print-to-terminal fallback for local development.
 */
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { CONFIG } from "@/config/env";

/**
 * Lazily built, then cached. Building it at import time would run on every
 * test and every CLI script, and Nodemailer's createTransport() does
 * real work (it resolves the pool/connection options).
 */
let cachedTransport: Transporter | null = null;

function getTransport(): Transporter | null {
  if (!CONFIG.mail.enabled) return null;
  if (!CONFIG.mail.host) {
    // Enabled but nothing to talk to — a configuration mistake, not a crash.
    console.error("[MAIL] MAIL_ENABLED=true but SMTP_HOST is empty; not sending.");
    return null;
  }
  if (cachedTransport) return cachedTransport;

  cachedTransport = nodemailer.createTransport({
    host: CONFIG.mail.host,
    port: CONFIG.mail.port,
    secure: CONFIG.mail.secure,
    auth: CONFIG.mail.user
      ? { user: CONFIG.mail.user, pass: CONFIG.mail.pass }
      : undefined,
  });
  return cachedTransport;
}

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/**
 * @returns true only when the message was handed to an SMTP server
 *          successfully. false means "not configured", "not enabled" or
 *          "the send failed" — callers that have a fallback should use it.
 */
export async function sendMail(message: MailMessage): Promise<boolean> {
  const transport = getTransport();
  if (!transport) return false;

  try {
    await transport.sendMail({ from: CONFIG.mail.from, ...message });
    return true;
  } catch (e) {
    // Same policy as writeAudit(): log server-side, swallow, carry on.
    console.error("[MAIL SEND FAILED]", e);
    return false;
  }
}

/** Test hook — lets a suite drop a cached (mock) transport between cases. */
export function __resetMailerForTests(): void {
  cachedTransport = null;
}

/**
 * Password-reset email, in both parts. Written by hand rather than with a
 * template engine: one message does not justify a dependency, and inlining the
 * CSS is required anyway — Gmail strips <style> blocks.
 *
 * The HTML deliberately carries no tracking pixel, no images and no external
 * stylesheet: those all hurt deliverability for transactional mail.
 */
export function renderPasswordResetEmail(opts: {
  firstName?: string | null;
  resetLink: string;
  expiresInMinutes: number;
}): Omit<MailMessage, "to"> {
  const { firstName, resetLink, expiresInMinutes } = opts;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const subject = "Reset your Business Suite password";

  const text = [
    greeting,
    "",
    "We received a request to reset the password for your Business Suite account.",
    `Open this link to choose a new one (valid for ${expiresInMinutes} minutes):`,
    "",
    resetLink,
    "",
    "If you did not request this, you can ignore this email — your password",
    "will not change unless the link above is opened.",
    "",
    "— Business Suite",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;">
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:18px;line-height:1.4;">Reset your password</h1>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">${greeting}</p>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.6;">
                  We received a request to reset the password for your Business Suite account.
                  This link is valid for <strong>${expiresInMinutes} minutes</strong>.
                </p>
                <p style="margin:0 0 24px;">
                  <a href="${resetLink}"
                     style="display:inline-block;padding:12px 20px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;">
                    Choose a new password
                  </a>
                </p>
                <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#71717a;">
                  If the button does not work, copy this address into your browser:
                </p>
                <p style="margin:0 0 24px;font-size:12px;line-height:1.6;word-break:break-all;color:#71717a;">
                  ${resetLink}
                </p>
                <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">
                  If you did not request this, you can ignore this email — your password
                  will not change unless the link above is opened.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
