import type { Request } from "express";
import { prisma } from "@/lib/prisma";
import type { CreateActivityDto, ListActivitiesQuery } from "./validators";
import { AuditAction } from "@prisma/client";
import {
  applyPagination,
  buildPaginationMeta,
} from "@/utils/pagination";
import {
  NotFoundError,
} from "@/lib/errors";
import { omitSensitive, writeAudit, extractMeta } from "@/middleware/audit";

export type ListActivitiesResponse = Awaited<ReturnType<typeof ActivityService["list"]>>;

const USER_SELECT = {
  firstName: true,
  lastName: true,
  email: true,
} as const;

export const ActivityService = {
  async list(q: ListActivitiesQuery) {
    const where: Record<string, unknown> = {};
    if (q.type) where.type = q.type;
    if (q.userId) where.userId = q.userId;
    if (q.leadId) where.leadId = q.leadId;
    if (q.customerId) where.customerId = q.customerId;
    if (q.opportunityId) where.opportunityId = q.opportunityId;

    if (q.since || q.until) {
      where.activityAt = {} as Record<string, unknown>;
      if (q.since) (where.activityAt as Record<string, unknown>).gte = q.since;
      if (q.until) (where.activityAt as Record<string, unknown>).lte = q.until;
    }

    if (q.search) {
      where.OR = [
        { subject: { contains: q.search, mode: "insensitive" } },
        { description: { contains: q.search, mode: "insensitive" } },
      ];
    }

    const orderBy: Record<string, unknown> = q.sortBy
      ? { [q.sortBy]: q.sortOrder }
      : { activityAt: q.sortOrder };

    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const [totalItems, items] = await Promise.all([
      prisma.activity.count({ where }),
      prisma.activity.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          user: { select: USER_SELECT },
        },
      }),
    ]);

    return { items, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },

  async create(dto: CreateActivityDto, req: Request) {
    const meta = extractMeta(req);

    const created = await prisma.$transaction(async (tx) => {
      if (dto.leadId) {
        const lead = await tx.lead.findUnique({ where: { id: dto.leadId } });
        if (!lead) throw new NotFoundError("Lead not found.");
      }
      if (dto.customerId) {
        const customer = await tx.customer.findUnique({ where: { id: dto.customerId } });
        if (!customer) throw new NotFoundError("Customer not found.");
      }
      if (dto.opportunityId) {
        const opportunity = await tx.opportunity.findUnique({ where: { id: dto.opportunityId } });
        if (!opportunity) throw new NotFoundError("Opportunity not found.");
      }

      const activity = await tx.activity.create({
        data: {
          type: dto.type,
          subject: dto.subject,
          description: dto.description || null,
          activityAt: dto.activityAt,
          outcome: dto.outcome || null,
          userId: dto.userId,
          leadId: dto.leadId || null,
          customerId: dto.customerId || null,
          opportunityId: dto.opportunityId || null,
        },
        include: {
          user: { select: USER_SELECT },
        },
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.CREATE,
        entityType: "Activity",
        entityId: activity.id,
        afterData: omitSensitive(activity),
        ip: meta.ip,
        ua: meta.ua,
      });
      return activity;
    });

    return created;
  },
};
