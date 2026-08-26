import type { Request } from "express";
import { prisma } from "@/lib/prisma";
import type { CreateCustomerDto, ListCustomersQuery, UpdateCustomerDto } from "./validators";
import { AuditAction, CustomerStatus, LeadSource } from "@prisma/client";
import {
  applyPagination,
  buildPaginationMeta,
} from "@/utils/pagination";
import {
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import { omitSensitive, writeAudit, extractMeta } from "@/middleware/audit";

export type ListCustomersResponse = Awaited<ReturnType<typeof CustomerService["list"]>>;

export const CustomerService = {
  async list(q: ListCustomersQuery) {
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

    const orderBy: Record<string, unknown> = q.sortBy
      ? { [q.sortBy]: q.sortOrder }
      : { createdAt: q.sortOrder };

    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const [totalItems, items] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        skip,
        take,
        orderBy,
      }),
    ]);

    return { items, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },

  async generateCustomerCode() {
    const last = await prisma.customer.findFirst({
      where: { customerCode: { startsWith: "CUST-" } },
      orderBy: { customerCode: "desc" },
      select: { customerCode: true },
    });
    if (!last) return "CUST-0001";
    const numPart = last.customerCode.replace("CUST-", "");
    const n = parseInt(numPart, 10) || 0;
    return `CUST-${String(n + 1).padStart(4, "0")}`;
  },

  async create(dto: CreateCustomerDto, req: Request) {
    if (dto.email && dto.email.toLowerCase() !== dto.email) dto.email = dto.email.toLowerCase();

    const meta = extractMeta(req);

    const customerCode = await CustomerService.generateCustomerCode();

    const created = await prisma.$transaction(async (tx) => {
      if (dto.email) {
        const existing = await tx.customer.findUnique({ where: { email: dto.email } });
        if (existing) throw new ConflictError("A customer with this email already exists.");
      }

      const customer = await tx.customer.create({
        data: {
          customerCode,
          name: dto.name,
          companyName: dto.companyName || null,
          email: dto.email || null,
          phone: dto.phone || null,
          address: dto.address || null,
          city: dto.city || null,
          state: dto.state || null,
          country: dto.country || null,
          postalCode: dto.postalCode || null,
          notes: dto.notes || null,
          source: dto.source ?? LeadSource.OTHER,
          status: dto.status ?? CustomerStatus.ACTIVE,
          createdBy: req.user?.id,
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
      return customer;
    });

    return { customer: created };
  },

  async getById(id: string, includeContacts = false, includeOpps = false) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        contacts: includeContacts,
        opportunities: includeOpps
          ? { orderBy: { createdAt: "desc" }, take: 10 }
          : undefined,
      },
    });
    if (!customer) throw new NotFoundError("Customer not found.");
    return customer;
  },

  async update(id: string, dto: UpdateCustomerDto, req: Request) {
    if (dto.email && dto.email.toLowerCase() !== dto.email) dto.email = dto.email.toLowerCase();

    const meta = extractMeta(req);

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.customer.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Customer not found.");

      if (dto.email && dto.email !== before.email) {
        const dup = await tx.customer.findUnique({ where: { email: dto.email } });
        if (dup) throw new ConflictError("A customer with this email already exists.");
      }

      const data: Record<string, unknown> = {};
      for (const k of ["name", "companyName", "email", "phone", "address", "city", "state", "country", "postalCode", "notes", "source", "status"] as const) {
        if ((dto as Record<string, unknown>)[k] !== undefined) {
          const v = (dto as Record<string, unknown>)[k];
          data[k] = v === "" ? null : v;
        }
      }
      if (Object.keys(data).length === 0) {
        return before;
      }

      const after = await tx.customer.update({
        where: { id },
        data,
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "Customer",
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
      const before = await tx.customer.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Customer not found.");

      await tx.customer.delete({ where: { id } });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.DELETE,
        entityType: "Customer",
        entityId: id,
        beforeData: omitSensitive(before),
        ip: meta.ip,
        ua: meta.ua,
      });
    });
  },
};
