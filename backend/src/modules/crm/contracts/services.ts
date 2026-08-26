import type { Request } from "express";
import { prisma } from "@/lib/prisma";
import type {
  CreateContractDto,
  ListContractsQuery,
  UpdateContractDto,
} from "./validators";
import {
  AuditAction,
} from "@prisma/client";
import {
  applyPagination,
  buildPaginationMeta,
} from "@/utils/pagination";
import {
  NotFoundError,
} from "@/lib/errors";
import { omitSensitive, writeAudit, extractMeta } from "@/middleware/audit";

export type ListContractsResponse = Awaited<ReturnType<typeof ContractService["list"]>>;

const CUSTOMER_SELECT = {
  id: true,
  customerCode: true,
  name: true,
} as const;

const SIGNED_BY_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

export const ContractService = {
  async list(q: ListContractsQuery) {
    const where: Record<string, unknown> = {};
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: "insensitive" } },
      ];
    }
    if (q.status) where.status = q.status;
    if (q.customerId) where.customerId = q.customerId;
    if (q.signedById) where.signedById = q.signedById;

    if (q.startDateFrom) {
      where.startDate = { gte: q.startDateFrom };
    }
    if (q.endDateTo) {
      where.endDate = { lte: q.endDateTo };
    }

    const orderBy: Record<string, unknown> = q.sortBy
      ? { [q.sortBy]: q.sortOrder }
      : { createdAt: q.sortOrder };

    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const [totalItems, items] = await Promise.all([
      prisma.contract.count({ where }),
      prisma.contract.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          customer: { select: CUSTOMER_SELECT },
        },
      }),
    ]);

    return { items, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },

  async generateContractCode() {
    const last = await prisma.contract.findFirst({
      where: { contractCode: { startsWith: "CON-" } },
      orderBy: { contractCode: "desc" },
      select: { contractCode: true },
    });
    if (!last) return "CON-0001";
    const numPart = last.contractCode.replace("CON-", "");
    const n = parseInt(numPart, 10) || 0;
    return `CON-${String(n + 1).padStart(4, "0")}`;
  },

  async create(dto: CreateContractDto, req: Request) {
    const meta = extractMeta(req);
    const contractCode = await ContractService.generateContractCode();

    const created = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: dto.customerId },
      });
      if (!customer) throw new NotFoundError("Customer not found.");

      const contract = await tx.contract.create({
        data: {
          contractCode,
          title: dto.title,
          customerId: dto.customerId,
          status: dto.status,
          startDate: dto.startDate,
          endDate: dto.endDate,
          value: dto.value,
          signedAt: dto.signedAt || null,
          signedById: dto.signedById || null,
          notes: dto.notes || null,
          createdById: req.user?.id,
        },
        include: {
          customer: { select: CUSTOMER_SELECT },
        },
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.CREATE,
        entityType: "Contract",
        entityId: contract.id,
        afterData: omitSensitive(contract),
        ip: meta.ip,
        ua: meta.ua,
      });
      return contract;
    });

    return created;
  },

  async getById(id: string) {
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        customer: { select: CUSTOMER_SELECT },
        signedBy: { select: SIGNED_BY_SELECT },
      },
    });
    if (!contract) throw new NotFoundError("Contract not found.");
    return contract;
  },

  async update(id: string, dto: UpdateContractDto, req: Request) {
    const meta = extractMeta(req);

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.contract.findUnique({
        where: { id },
        include: {
          customer: { select: CUSTOMER_SELECT },
          signedBy: { select: SIGNED_BY_SELECT },
        },
      });
      if (!before) throw new NotFoundError("Contract not found.");

      const data: Record<string, unknown> = {};
      for (const k of [
        "title",
        "customerId",
        "status",
        "startDate",
        "endDate",
        "value",
        "signedAt",
        "signedById",
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

      const after = await tx.contract.update({
        where: { id },
        data,
        include: {
          customer: { select: CUSTOMER_SELECT },
          signedBy: { select: SIGNED_BY_SELECT },
        },
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "Contract",
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
      const before = await tx.contract.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Contract not found.");

      await tx.contract.delete({ where: { id } });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.DELETE,
        entityType: "Contract",
        entityId: id,
        beforeData: omitSensitive(before),
        ip: meta.ip,
        ua: meta.ua,
      });
    });
  },
};
