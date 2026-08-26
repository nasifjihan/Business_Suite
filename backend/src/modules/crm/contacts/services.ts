import type { Request } from "express";
import { prisma } from "@/lib/prisma";
import type { CreateContactDto, ListContactsQuery, UpdateContactDto } from "./validators";
import { AuditAction } from "@prisma/client";
import {
  applyPagination,
  buildPaginationMeta,
} from "@/utils/pagination";
import {
  NotFoundError,
} from "@/lib/errors";
import { omitSensitive, writeAudit, extractMeta } from "@/middleware/audit";

export type ListContactsResponse = Awaited<ReturnType<typeof ContactService["listByCustomer"]>>;

export const ContactService = {
  async listByCustomer(customerId: string, q: ListContactsQuery) {
    const where: Record<string, unknown> = { customerId };
    if (q.search) {
      where.OR = [
        { firstName: { contains: q.search, mode: "insensitive" } },
        { lastName: { contains: q.search, mode: "insensitive" } },
        { email: { contains: q.search, mode: "insensitive" } },
      ];
    }

    const orderBy: Record<string, unknown> = q.sortBy
      ? { [q.sortBy]: q.sortOrder }
      : { isPrimary: "desc", createdAt: q.sortOrder };

    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const [totalItems, items] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        skip,
        take,
        orderBy,
      }),
    ]);

    return { items, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },

  async createForCustomer(customerId: string, dto: CreateContactDto, req: Request) {
    const meta = extractMeta(req);

    const created = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (!customer) throw new NotFoundError("Customer not found.");

      if (dto.isPrimary === true) {
        await tx.contact.updateMany({
          where: { customerId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const contact = await tx.contact.create({
        data: {
          customerId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email || null,
          phone: dto.phone || null,
          mobile: dto.mobile || null,
          designation: dto.designation || null,
          department: dto.department || null,
          isPrimary: dto.isPrimary ?? false,
          notes: dto.notes || null,
        },
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.CREATE,
        entityType: "Contact",
        entityId: contact.id,
        afterData: omitSensitive(contact),
        ip: meta.ip,
        ua: meta.ua,
      });
      return contact;
    });

    return created;
  },

  async getById(id: string) {
    const contact = await prisma.contact.findUnique({ where: { id } });
    if (!contact) throw new NotFoundError("Contact not found.");
    return contact;
  },

  async update(id: string, dto: UpdateContactDto, req: Request) {
    const meta = extractMeta(req);

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.contact.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Contact not found.");

      if (dto.isPrimary === true && before.isPrimary !== true) {
        await tx.contact.updateMany({
          where: { customerId: before.customerId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const data: Record<string, unknown> = {};
      for (const k of ["firstName", "lastName", "email", "phone", "mobile", "designation", "department", "isPrimary", "notes"] as const) {
        if ((dto as Record<string, unknown>)[k] !== undefined) {
          const v = (dto as Record<string, unknown>)[k];
          data[k] = v === "" ? null : v;
        }
      }
      if (Object.keys(data).length === 0) {
        return before;
      }

      const after = await tx.contact.update({
        where: { id },
        data,
      });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "Contact",
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
      const before = await tx.contact.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Contact not found.");

      await tx.contact.delete({ where: { id } });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.DELETE,
        entityType: "Contact",
        entityId: id,
        beforeData: omitSensitive(before),
        ip: meta.ip,
        ua: meta.ua,
      });
    });
  },
};
