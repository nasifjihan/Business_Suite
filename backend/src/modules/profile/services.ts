import type { Request } from "express";
import { prisma } from "@/lib/prisma";
import type { UpdateOwnProfileDto } from "./validators";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { AuditAction } from "@prisma/client";
import { extractMeta, omitSensitive, writeAudit } from "@/middleware/audit";

const SENSITIVE_OMIT = { passwordHash: true } as const;

export const ProfileService = {
  async get(userId: string) {
    const profile = await prisma.user.findUnique({
      where: { id: userId },
      omit: SENSITIVE_OMIT,
      include: {
        role: { select: { id: true, name: true, displayName: true } },
      },
    });
    if (!profile) throw new NotFoundError("User not found.");
    return profile;
  },

  async update(userId: string, dto: UpdateOwnProfileDto, req: Request) {
    const meta = extractMeta(req);
    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({
        where: { id: userId },
        omit: SENSITIVE_OMIT,
        include: {
          role: { select: { id: true, name: true, displayName: true } },
        },
      });
      if (!before) throw new NotFoundError("User not found.");

      const data: Record<string, unknown> = {};
      if (dto.firstName !== undefined) data.firstName = dto.firstName;
      if (dto.lastName !== undefined) data.lastName = dto.lastName;
      if (dto.phone !== undefined) data.phone = dto.phone || null;
      if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl || null;

      if (Object.keys(data).length === 0) return before;

      const after = await tx.user.update({
        where: { id: userId },
        data,
        omit: SENSITIVE_OMIT,
        include: {
          role: { select: { id: true, name: true, displayName: true } },
        },
      });
      await writeAudit(tx, {
        userId,
        action: AuditAction.UPDATE,
        entityType: "Profile",
        entityId: userId,
        beforeData: omitSensitive(before),
        afterData: omitSensitive(after),
        ip: meta.ip,
        ua: meta.ua,
      });
      return after;
    });
    return updated;
  },
};
