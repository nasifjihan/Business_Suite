import type { Request } from "express";
import { prisma } from "@/lib/prisma";
import type {
  CreateOpportunityDto,
  ListOppsQuery,
  PatchStageDto,
  UpdateOpportunityDto,
} from "./validators";
import {
  AuditAction,
  OpportunityStage,
} from "@prisma/client";
import {
  applyPagination,
  buildPaginationMeta,
} from "@/utils/pagination";
import {
  NotFoundError,
} from "@/lib/errors";
import { omitSensitive, writeAudit, extractMeta } from "@/middleware/audit";

export type ListOpportunitiesResponse = Awaited<ReturnType<typeof OpportunityService["list"]>>;

const ASSIGNED_TO_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

const CUSTOMER_SELECT = {
  id: true,
  name: true,
  customerCode: true,
} as const;

const LEAD_SELECT = {
  id: true,
  leadCode: true,
  name: true,
} as const;

const ACTIVITIES_INCLUDE = {
  user: {
    select: {
      firstName: true,
      lastName: true,
      email: true,
    },
  },
} as const;

export const OpportunityService = {
  async list(q: ListOppsQuery) {
    const where: Record<string, unknown> = {};
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: "insensitive" } },
      ];
    }
    if (q.stage) where.stage = q.stage;
    if (q.customerId) where.customerId = q.customerId;
    if (q.leadId) where.leadId = q.leadId;
    if (q.assignedToId) where.assignedToId = q.assignedToId;

    if (q.expectedCloseDateFrom || q.expectedCloseDateTo) {
      const dateRange: Record<string, unknown> = {};
      if (q.expectedCloseDateFrom) dateRange.gte = q.expectedCloseDateFrom;
      if (q.expectedCloseDateTo) dateRange.lte = q.expectedCloseDateTo;
      where.expectedCloseDate = dateRange;
    }

    const orderBy: Record<string, unknown> = q.sortBy
      ? { [q.sortBy]: q.sortOrder }
      : { createdAt: q.sortOrder };

    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const [totalItems, items] = await Promise.all([
      prisma.opportunity.count({ where }),
      prisma.opportunity.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          customer: { select: CUSTOMER_SELECT },
          lead: { select: LEAD_SELECT },
          assignedTo: { select: ASSIGNED_TO_SELECT },
        },
      }),
    ]);

    return { items, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },

  async generateOppCode() {
    const last = await prisma.opportunity.findFirst({
      where: { opportunityCode: { startsWith: "OPP-" } },
      orderBy: { opportunityCode: "desc" },
      select: { opportunityCode: true },
    });
    if (!last) return "OPP-0001";
    const numPart = last.opportunityCode.replace("OPP-", "");
    const n = parseInt(numPart, 10) || 0;
    return `OPP-${String(n + 1).padStart(4, "0")}`;
  },

  async create(dto: CreateOpportunityDto, req: Request) {
    const meta = extractMeta(req);
    const opportunityCode = await OpportunityService.generateOppCode();

    const created = await prisma.$transaction(async (tx) => {
      const opportunity = await tx.opportunity.create({
        data: {
          opportunityCode,
          name: dto.name,
          customerId: dto.customerId || null,
          leadId: dto.leadId || null,
          stage: dto.stage ?? OpportunityStage.PROSPECTING,
          amount: dto.amount,
          currency: dto.currency,
          probabilityPercent: dto.probabilityPercent ?? null,
          expectedCloseDate: dto.expectedCloseDate || null,
          assignedToId: dto.assignedToId || null,
          notes: dto.notes || null,
          createdById: req.user?.id,
        },
        include: {
          customer: { select: CUSTOMER_SELECT },
          lead: { select: LEAD_SELECT },
          assignedTo: { select: ASSIGNED_TO_SELECT },
        },
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.CREATE,
        entityType: "Opportunity",
        entityId: opportunity.id,
        afterData: omitSensitive(opportunity),
        ip: meta.ip,
        ua: meta.ua,
      });
      return opportunity;
    });

    return created;
  },

  async getById(id: string, includeActivities = true) {
    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      include: {
        customer: { select: CUSTOMER_SELECT },
        lead: { select: LEAD_SELECT },
        assignedTo: { select: ASSIGNED_TO_SELECT },
        activities: includeActivities
          ? {
              include: ACTIVITIES_INCLUDE,
              orderBy: { activityAt: "desc" },
            }
          : undefined,
      },
    });
    if (!opportunity) throw new NotFoundError("Opportunity not found.");
    return opportunity;
  },

  async update(id: string, dto: UpdateOpportunityDto, req: Request) {
    const meta = extractMeta(req);

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.opportunity.findUnique({
        where: { id },
        include: {
          customer: { select: CUSTOMER_SELECT },
          lead: { select: LEAD_SELECT },
          assignedTo: { select: ASSIGNED_TO_SELECT },
        },
      });
      if (!before) throw new NotFoundError("Opportunity not found.");

      const data: Record<string, unknown> = {};
      for (const k of [
        "name",
        "customerId",
        "leadId",
        "stage",
        "amount",
        "currency",
        "probabilityPercent",
        "expectedCloseDate",
        "assignedToId",
        "notes",
      ] as const) {
        if ((dto as Record<string, unknown>)[k] !== undefined) {
          const v = (dto as Record<string, unknown>)[k];
          data[k] = v === "" ? null : v;
        }
      }

      if (Object.keys(data).length === 0) {
        return before;
      }

      const after = await tx.opportunity.update({
        where: { id },
        data,
        include: {
          customer: { select: CUSTOMER_SELECT },
          lead: { select: LEAD_SELECT },
          assignedTo: { select: ASSIGNED_TO_SELECT },
        },
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "Opportunity",
        entityId: after.id,
        beforeData: omitSensitive(before),
        afterData: omitSensitive(after),
        ip: meta.ip,
        ua: meta.ua,
      });
      return after;
    });

    return updated;
  },

  async patchStage(id: string, stage: OpportunityStage, note: string | undefined, req: Request) {
    const meta = extractMeta(req);

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.opportunity.findUnique({
        where: { id },
        include: {
          customer: { select: CUSTOMER_SELECT },
          lead: { select: LEAD_SELECT },
          assignedTo: { select: ASSIGNED_TO_SELECT },
        },
      });
      if (!before) throw new NotFoundError("Opportunity not found.");

      const after = await tx.opportunity.update({
        where: { id },
        data: { stage },
        include: {
          customer: { select: CUSTOMER_SELECT },
          lead: { select: LEAD_SELECT },
          assignedTo: { select: ASSIGNED_TO_SELECT },
        },
      });

      const afterData = note
        ? { ...omitSensitive(after), note }
        : omitSensitive(after);

      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "Opportunity",
        entityId: after.id,
        beforeData: omitSensitive(before),
        afterData,
        ip: meta.ip,
        ua: meta.ua,
      });
      return after;
    });

    return updated;
  },

  async remove(id: string, req: Request) {
    const meta = extractMeta(req);

    await prisma.$transaction(async (tx) => {
      const before = await tx.opportunity.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Opportunity not found.");

      await tx.opportunity.delete({ where: { id } });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.DELETE,
        entityType: "Opportunity",
        entityId: id,
        beforeData: omitSensitive(before),
        ip: meta.ip,
        ua: meta.ua,
      });
    });
  },
};
