import type { Request } from "express";
import { prisma } from "@/lib/prisma";
import type {
  ConvertLeadDto,
  CreateLeadDto,
  ListLeadsQuery,
  UpdateLeadDto,
} from "./validators";
import {
  AuditAction,
  LeadStatus,
  LeadSource,
  OpportunityStage,
} from "@prisma/client";
import {
  applyPagination,
  buildPaginationMeta,
} from "@/utils/pagination";
import {
  BadRequestError,
  NotFoundError,
} from "@/lib/errors";
import { omitSensitive, writeAudit, extractMeta } from "@/middleware/audit";
import { CustomerService } from "../customers/services";

export type ListLeadsResponse = Awaited<ReturnType<typeof LeadService["list"]>>;

const ASSIGNED_TO_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

const UNIFIED_ACTIVITIES_INCLUDE = {
  user: {
    select: {
      firstName: true,
      lastName: true,
      email: true,
    },
  },
} as const;

async function generateOpportunityCode() {
  const last = await prisma.opportunity.findFirst({
    where: { opportunityCode: { startsWith: "OPP-" } },
    orderBy: { opportunityCode: "desc" },
    select: { opportunityCode: true },
  });
  if (!last) return "OPP-0001";
  const numPart = last.opportunityCode.replace("OPP-", "");
  const n = parseInt(numPart, 10) || 0;
  return `OPP-${String(n + 1).padStart(4, "0")}`;
}

export const LeadService = {
  async list(q: ListLeadsQuery) {
    const where: Record<string, unknown> = {};
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: "insensitive" } },
        { companyName: { contains: q.search, mode: "insensitive" } },
        { email: { contains: q.search, mode: "insensitive" } },
      ];
    }
    if (q.status) where.status = q.status;
    if (q.source) where.source = q.source;
    if (q.assignedToId) where.assignedToId = q.assignedToId;

    const orderBy: Record<string, unknown> = q.sortBy
      ? { [q.sortBy]: q.sortOrder }
      : { createdAt: q.sortOrder };

    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const [totalItems, items] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          assignedTo: { select: ASSIGNED_TO_SELECT },
        },
      }),
    ]);

    return { items, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },

  async generateLeadCode() {
    const last = await prisma.lead.findFirst({
      where: { leadCode: { startsWith: "LEAD-" } },
      orderBy: { leadCode: "desc" },
      select: { leadCode: true },
    });
    if (!last) return "LEAD-0001";
    const numPart = last.leadCode.replace("LEAD-", "");
    const n = parseInt(numPart, 10) || 0;
    return `LEAD-${String(n + 1).padStart(4, "0")}`;
  },

  async create(dto: CreateLeadDto, req: Request) {
    if (dto.email && dto.email.toLowerCase() !== dto.email) dto.email = dto.email.toLowerCase();

    const meta = extractMeta(req);
    const leadCode = await LeadService.generateLeadCode();

    const created = await prisma.$transaction(async (tx) => {
      if (dto.email) {
        const existing = await tx.lead.findFirst({ where: { email: dto.email } });
        if (existing) {
          // Not critical for leads — allow duplicate email, just log
        }
      }

      const lead = await tx.lead.create({
        data: {
          leadCode,
          name: dto.name,
          companyName: dto.companyName || null,
          email: dto.email || null,
          phone: dto.phone || null,
          source: dto.source ?? LeadSource.OTHER,
          status: dto.status ?? LeadStatus.NEW,
          value: dto.value,
          currency: dto.currency,
          probability: dto.probability,
          assignedToId: dto.assignedToId || null,
          createdBy: req.user?.id,
          notes: dto.notes || null,
        },
        include: {
          assignedTo: { select: ASSIGNED_TO_SELECT },
        },
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.CREATE,
        entityType: "Lead",
        entityId: lead.id,
        afterData: omitSensitive(lead),
        ip: meta.ip,
        ua: meta.ua,
      });
      return lead;
    });

    return created;
  },

  async getById(id: string, includeActivities = true) {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        assignedTo: { select: ASSIGNED_TO_SELECT },
        unifiedActivities: includeActivities
          ? {
              include: UNIFIED_ACTIVITIES_INCLUDE,
              orderBy: { activityAt: "desc" },
            }
          : undefined,
      },
    });
    if (!lead) throw new NotFoundError("Lead not found.");
    return lead;
  },

  async update(id: string, dto: UpdateLeadDto, req: Request) {
    if (dto.email && dto.email.toLowerCase() !== dto.email) dto.email = dto.email.toLowerCase();

    const meta = extractMeta(req);

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.lead.findUnique({
        where: { id },
        include: {
          assignedTo: { select: ASSIGNED_TO_SELECT },
        },
      });
      if (!before) throw new NotFoundError("Lead not found.");

      const data: Record<string, unknown> = {};
      for (const k of [
        "name",
        "companyName",
        "email",
        "phone",
        "source",
        "status",
        "value",
        "currency",
        "probability",
        "assignedToId",
        "notes",
      ] as const) {
        if ((dto as Record<string, unknown>)[k] !== undefined) {
          const v = (dto as Record<string, unknown>)[k];
          data[k] = v === "" ? null : v;
        }
      }

      const shouldSetWonLostAt =
        dto.status !== undefined &&
        (dto.status === LeadStatus.WON || dto.status === LeadStatus.LOST) &&
        before.status !== LeadStatus.WON &&
        before.status !== LeadStatus.LOST;
      if (shouldSetWonLostAt) {
        data.wonLostAt = new Date();
      }

      if (Object.keys(data).length === 0) {
        return before;
      }

      const after = await tx.lead.update({
        where: { id },
        data,
        include: {
          assignedTo: { select: ASSIGNED_TO_SELECT },
        },
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "Lead",
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

  async remove(id: string, req: Request) {
    const meta = extractMeta(req);

    await prisma.$transaction(async (tx) => {
      const before = await tx.lead.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Lead not found.");

      await tx.lead.delete({ where: { id } });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.DELETE,
        entityType: "Lead",
        entityId: id,
        beforeData: omitSensitive(before),
        ip: meta.ip,
        ua: meta.ua,
      });
    });
  },

  async convertLead(leadId: string, dto: ConvertLeadDto, req: Request) {
    const meta = extractMeta(req);

    const result = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id: leadId } });
      if (!lead) throw new NotFoundError("Lead not found.");

      if (lead.status === LeadStatus.WON || lead.status === LeadStatus.LOST) {
        throw new BadRequestError("Cannot convert lead that is WON or LOST");
      }

      const customerCode = await CustomerService.generateCustomerCode();

      const customer = await tx.customer.create({
        data: {
          customerCode,
          name: dto.customerName,
          companyName: lead.companyName,
          email: lead.email,
          phone: lead.phone,
          source: lead.source,
          createdBy: req.user?.id,
        },
      });

      let opportunity = null;
      if (dto.createOpportunity) {
        const opportunityCode = await generateOpportunityCode();
        opportunity = await tx.opportunity.create({
          data: {
            opportunityCode,
            name: dto.opportunityName || `Opportunity: ${dto.customerName}`,
            customerId: customer.id,
            leadId: lead.id,
            amount: dto.opportunityAmount || lead.value,
            currency: lead.currency,
            expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : null,
            assignedToId: dto.assignedToId || lead.assignedToId,
            probabilityPercent: lead.probability,
            createdById: req.user?.id,
            stage: OpportunityStage.QUALIFICATION,
          },
        });
      }

      const updatedLead = await tx.lead.update({
        where: { id: leadId },
        data: {
          status: LeadStatus.WON,
          wonLostAt: new Date(),
        },
      });

      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.CREATE,
        entityType: "Customer",
        entityId: customer.id,
        afterData: omitSensitive(customer),
        ip: meta.ip,
        ua: meta.ua,
      });

      if (opportunity) {
        await writeAudit(tx, {
          userId: req.user?.id,
          action: AuditAction.CREATE,
          entityType: "Opportunity",
          entityId: opportunity.id,
          afterData: omitSensitive(opportunity),
          ip: meta.ip,
          ua: meta.ua,
        });
      }

      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "Lead",
        entityId: updatedLead.id,
        beforeData: omitSensitive({ ...lead, status: lead.status }),
        afterData: omitSensitive({ ...updatedLead, status: updatedLead.status }),
        ip: meta.ip,
        ua: meta.ua,
      });

      return { customer, opportunity, lead: updatedLead };
    });

    return result;
  },
};
