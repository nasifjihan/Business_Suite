import type { Request } from "express";
import { prisma } from "@/lib/prisma";
import type { CreateEmployeeDto, ListEmployeesQuery, UpdateEmployeeDto } from "./validators";
import { AuditAction, Prisma } from "@prisma/client";
import {
  applyPagination,
  buildPaginationMeta,
} from "@/utils/pagination";
import {
  NotFoundError,
} from "@/lib/errors";
import { omitSensitive, writeAudit, extractMeta } from "@/middleware/audit";
import { hasPermission } from "@/utils/permissions";

export type ListEmployeesResponse = Awaited<ReturnType<typeof EmployeeService["list"]>>;

const SALARY_FIELD = "basicSalary";

function canSeeSalary(req: Request): boolean {
  const codes: string[] = req.permissionCodes ?? [];
  return hasPermission(codes, "hrm.employees.update");
}

function redactSalary<T extends Record<string, unknown>>(obj: T): Omit<T, typeof SALARY_FIELD> & { [SALARY_FIELD]?: never } {
  const { [SALARY_FIELD]: _omit, ...rest } = obj;
  return rest as unknown as Omit<T, typeof SALARY_FIELD> & { [SALARY_FIELD]?: never };
}

export const EmployeeService = {
  async list(q: ListEmployeesQuery, req: Request) {
    const where: Record<string, unknown> = {};
    if (q.search) {
      where.OR = [
        { firstName: { contains: q.search, mode: "insensitive" } },
        { lastName: { contains: q.search, mode: "insensitive" } },
        { employeeCode: { contains: q.search, mode: "insensitive" } },
        { email: { contains: q.search, mode: "insensitive" } },
      ];
    }
    if (q.departmentId) where.departmentId = q.departmentId;
    if (q.designationId) where.designationId = q.designationId;
    if (q.status) where.status = q.status;
    if (q.employmentType) where.employmentType = q.employmentType;

    const orderBy: Record<string, unknown> = q.sortBy
      ? { [q.sortBy]: q.sortOrder }
      : { createdAt: q.sortOrder };

    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const includeSalary = canSeeSalary(req);

    const [totalItems, rawItems] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          department: { select: { id: true, name: true, code: true } },
          designation: { select: { id: true, name: true, code: true } },
          manager: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    const items = includeSalary
      ? rawItems
      : rawItems.map((emp) => redactSalary(emp as unknown as Record<string, unknown>) as unknown as typeof rawItems[number]);

    return { items, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },

  async generateEmployeeCode() {
    const last = await prisma.employee.findFirst({
      orderBy: { createdAt: "desc" },
      select: { employeeCode: true },
    });
    if (!last) return "EMP-0001";
    const numPart = last.employeeCode.replace("EMP-", "");
    const n = parseInt(numPart, 10) || 0;
    return `EMP-${String(n + 1).padStart(4, "0")}`;
  },

  async findUserIdByEmail(email?: string | null): Promise<string | null> {
    if (!email) return null;
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return user?.id ?? null;
  },

  async create(dto: CreateEmployeeDto, req: Request) {
    const meta = extractMeta(req);

    const created = await prisma.$transaction(async (tx) => {
      const employeeCode = await EmployeeService.generateEmployeeCode();
      const userId = await EmployeeService.findUserIdByEmail(dto.email || null);

      const data: Prisma.EmployeeCreateInput = {
        employeeCode,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email || null,
        phone: dto.phone || null,
        mobile: dto.mobile || null,
        dateOfBirth: dto.dateOfBirth ?? undefined,
        joiningDate: dto.joiningDate,
        resignationDate: dto.resignationDate ?? undefined,
        employmentType: dto.employmentType,
        status: dto.status,
        basicSalary: dto.basicSalary,
        address: dto.address || null,
        city: dto.city || null,
        country: dto.country || null,
        emergencyName: dto.emergencyName || null,
        emergencyPhone: dto.emergencyPhone || null,
        emergencyRelation: dto.emergencyRelation || null,
        imageUrl: dto.imageUrl || null,
        notes: dto.notes || null,
      };

      if (dto.departmentId) {
        data.department = { connect: { id: dto.departmentId } };
      }
      if (dto.designationId) {
        data.designation = { connect: { id: dto.designationId } };
      }
      if (dto.managerId) {
        data.manager = { connect: { id: dto.managerId } };
      }
      if (userId) {
        data.userAccount = { connect: { id: userId } };
      }

      const employee = await tx.employee.create({ data });

      if (userId) {
        await tx.user.update({
          where: { id: userId },
          data: { employeeId: employee.id },
        });
      }

      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.CREATE,
        entityType: "Employee",
        entityId: employee.id,
        afterData: omitSensitive(redactSalary(employee as unknown as Record<string, unknown>)),
        ip: meta.ip,
        ua: meta.ua,
      });
      return employee;
    });

    return { employee: created };
  },

  async getById(id: string, req: Request) {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true, code: true } },
        designation: { select: { id: true, name: true, code: true } },
        manager: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
        userAccount: { select: { id: true, email: true } },
      },
    });
    if (!employee) throw new NotFoundError("Employee not found.");

    const includeSalary = canSeeSalary(req);
    return includeSalary ? employee : redactSalary(employee as unknown as Record<string, unknown>);
  },

  async update(id: string, dto: UpdateEmployeeDto, req: Request) {
    const meta = extractMeta(req);

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.employee.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Employee not found.");

      const data: Prisma.EmployeeUpdateInput = {};
      for (const k of [
        "firstName",
        "lastName",
        "email",
        "phone",
        "mobile",
        "dateOfBirth",
        "joiningDate",
        "resignationDate",
        "employmentType",
        "status",
        "basicSalary",
        "address",
        "city",
        "country",
        "emergencyName",
        "emergencyPhone",
        "emergencyRelation",
        "imageUrl",
        "notes",
      ] as const) {
        if ((dto as Record<string, unknown>)[k] !== undefined) {
          const v = (dto as Record<string, unknown>)[k];
          (data as Record<string, unknown>)[k] = v === "" ? null : v;
        }
      }
      if (dto.departmentId !== undefined) {
        data.department = dto.departmentId ? { connect: { id: dto.departmentId } } : { disconnect: true };
      }
      if (dto.designationId !== undefined) {
        data.designation = dto.designationId ? { connect: { id: dto.designationId } } : { disconnect: true };
      }
      if (dto.managerId !== undefined) {
        data.manager = dto.managerId ? { connect: { id: dto.managerId } } : { disconnect: true };
      }

      let newUserId: string | null = null;
      if (dto.email !== undefined) {
        newUserId = await EmployeeService.findUserIdByEmail(dto.email || null);
        if (newUserId) {
          data.userAccount = { connect: { id: newUserId } };
        } else if (before.email && dto.email !== before.email) {
          data.userAccount = { disconnect: true };
        }
      }

      if (Object.keys(data).length === 0) {
        return before;
      }

      const after = await tx.employee.update({
        where: { id },
        data,
      });

      if (newUserId) {
        await tx.user.update({
          where: { id: newUserId },
          data: { employeeId: after.id },
        });
      }
      if (before.email && dto.email !== undefined && dto.email !== before.email) {
        const oldUser = await tx.user.findUnique({ where: { email: before.email } });
        if (oldUser && oldUser.employeeId === after.id) {
          await tx.user.update({
            where: { id: oldUser.id },
            data: { employeeId: null },
          });
        }
      }

      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "Employee",
        entityId: after.id,
        beforeData: omitSensitive(redactSalary(before as unknown as Record<string, unknown>)),
        afterData: omitSensitive(redactSalary(after as unknown as Record<string, unknown>)),
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
      const before = await tx.employee.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Employee not found.");

      if (before.email) {
        const linkedUser = await tx.user.findUnique({ where: { email: before.email } });
        if (linkedUser && linkedUser.employeeId === id) {
          await tx.user.update({
            where: { id: linkedUser.id },
            data: { employeeId: null },
          });
        }
      }

      await tx.employee.delete({ where: { id } });
      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.DELETE,
        entityType: "Employee",
        entityId: id,
        beforeData: omitSensitive(redactSalary(before as unknown as Record<string, unknown>)),
        ip: meta.ip,
        ua: meta.ua,
      });
    });
  },
};
