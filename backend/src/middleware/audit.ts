/**
 * Audit logger helper — transaction-safe, called from inside service methods
 * (NOT global Express middleware — global middleware has no access to
 * beforeData snapshot before a PATCH runs).
 *
 * Usage inside a Prisma $transaction:
 *
 *   const result = await prisma.$transaction(async tx => {
 *     const before = await tx.user.findUnique({ where: { id } });
 *     const after  = await tx.user.update({ where: { id }, data: patch });
 *     await writeAudit(tx, {
 *       userId: req.user.id,
 *       action: AuditAction.UPDATE,
 *       entityType: "User",
 *       entityId: after.id,
 *       beforeData: omitSensitive(before),
 *       afterData:  omitSensitive(after),
 *       ip: extractMeta(req).ip,
 *       ua: extractMeta(req).ua,
 *     });
 *     return after;
 *   });
 */
import type { PrismaClient } from "@prisma/client";
import { AuditAction } from "@prisma/client";

const SENSITIVE_FIELDS = new Set([
  "passwordHash",
  "tokenHash",
  "accessToken",
  "refreshToken",
  "jti",
  "familyId",
  "beforeData",
  "afterData",
]);

/**
 * Recursively strip sensitive fields from any object (before/after snapshots).
 * Never put passwordHash / token hashes into audit log JSON columns.
 */
export function omitSensitive<T = unknown>(value: T | null | undefined): T | null | undefined {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((v) => omitSensitive(v)) as unknown as T;
  if (typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.has(k)) continue;
    out[k] = omitSensitive(v);
  }
  return out as T;
}

export type AuditWriteArgs = {
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: Record<string, unknown>;
  ip?: string;
  ua?: string;
};

/**
 * Write an audit log row. Accepts either a transactional client
 * (recommended — commit atomically with data change) or the global prisma.
 */
export async function writeAudit(
  tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$transaction" | "$on" | "$use"> | PrismaClient,
  args: AuditWriteArgs,
) {
  // Caller already passed through omitSensitive if they wanted — but double-guard.
  const before = omitSensitive(args.beforeData);
  const after = omitSensitive(args.afterData);
  try {
    await (tx.auditLog as PrismaClient["auditLog"]).create({
      data: {
        userId: args.userId ?? null,
        action: args.action,
        entityType: args.entityType,
        entityId: args.entityId ?? null,
        beforeData: (before as unknown as Prisma.JsonValue) ?? null,
        afterData: (after as unknown as Prisma.JsonValue) ?? null,
        metadata: (args.metadata as unknown as Prisma.JsonValue) ?? null,
        ipAddress: args.ip ?? null,
        userAgent: args.ua ?? null,
      },
    });
  } catch (e) {
    // Audit is BEST-EFFORT — never let a failing audit write abort the
    // primary business transaction. Log the error server-side only.
    // eslint-disable-next-line no-console
    console.error("[AUDIT WRITE FAILED]", e);
  }
}

// Helper so controllers can extract IP/UA once and pass to service layer.
export function extractMeta(req: {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}) {
  const xff = req.headers["x-forwarded-for"];
  const ip =
    (Array.isArray(xff) ? xff[0] : xff) ??
    req.ip ??
    null;
  const ua =
    Array.isArray(req.headers["user-agent"])
      ? req.headers["user-agent"][0]
      : req.headers["user-agent"] ?? null;
  return { ip: ip ?? undefined, ua: ua ?? undefined };
}
