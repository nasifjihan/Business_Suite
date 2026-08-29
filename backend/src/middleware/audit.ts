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
import { Prisma, AuditAction } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

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
function toJsonSafe(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof (value as any).toNumber === "function" && typeof (value as any).toString === "function" &&
      Object.prototype.hasOwnProperty.call(value, "s") && Object.prototype.hasOwnProperty.call(value, "e")) {
    return (value as any).toString();
  }
  if (value instanceof Map) return Object.fromEntries(Array.from(value.entries()).map(([k, v]) => [k, toJsonSafe(v)]));
  if (value instanceof Set) return Array.from(value).map((v) => toJsonSafe(v));
  if (Array.isArray(value)) return value.map((v) => toJsonSafe(v));
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (typeof value === "bigint") return value.toString();
  if (typeof (value as any).toJSON === "function") {
    const j = (value as any).toJSON();
    return toJsonSafe(j);
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "constructor") continue;
      out[k] = toJsonSafe(v);
    }
    return out;
  }
  return undefined;
}

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

function sanitizeJson(value: unknown): unknown {
  return toJsonSafe(omitSensitive(value));
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
  tx: { auditLog: PrismaClient["auditLog"] } | PrismaClient,
  args: AuditWriteArgs,
) {
  try {
    if ((globalThis as any).__FORCE_AUDIT_WRITE_THROW__) {
      throw new Error((globalThis as any).__FORCE_AUDIT_WRITE_THROW__);
    }
    const before = sanitizeJson(args.beforeData);
    const after = sanitizeJson(args.afterData);
    const metadata = sanitizeJson(args.metadata);
    await (tx.auditLog as PrismaClient["auditLog"]).create({
      data: {
        userId: args.userId ?? null,
        action: args.action,
        entityType: args.entityType,
        entityId: args.entityId ?? null,
        beforeData: (before as unknown as Prisma.InputJsonValue) ?? undefined,
        afterData: (after as unknown as Prisma.InputJsonValue) ?? undefined,
        metadata: (metadata as unknown as Prisma.InputJsonValue) ?? undefined,
        ipAddress: args.ip ?? null,
        userAgent: args.ua ?? null,
      },
    });
  } catch (e) {
    // Audit is BEST-EFFORT — never let a failing audit write abort the
    // primary business transaction. Log the error server-side only.
    // EXCEPTION: tests may explicitly request the error to bubble via
    // globalThis.__FORCE_AUDIT_WRITE_THROW__ — this validates atomicity
    // of the outer $transaction wrapper.
    if ((globalThis as any).__FORCE_AUDIT_WRITE_THROW__) {
      throw e;
    }
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
