import type { Request } from "express";
import { prisma } from "@/lib/prisma";
import type {
  ApproveLeaveDto,
  CancelLeaveDto,
  CreateLeaveDto,
  ListLeavesQuery,
  RejectLeaveDto,
  UpdateLeaveDto,
} from "./validators";
import {
  applyPagination,
  buildPaginationMeta,
} from "@/utils/pagination";
import {
  AuditAction,
  AttendanceStatus,
  LeaveStatus,
  Prisma,
} from "@prisma/client";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import { omitSensitive, writeAudit, extractMeta } from "@/middleware/audit";
import { hasPermission } from "@/utils/permissions";

export type ListLeavesResponse = Awaited<ReturnType<typeof LeaveService["list"]>>;

function canReadAll(req: Request): boolean {
  const codes: string[] = req.permissionCodes ?? [];
  return hasPermission(codes, "hrm.leave.read_all");
}

async function resolveEmployeeIdForSelf(req: Request): Promise<string> {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError("User not authenticated.");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { employeeId: true },
  });
  if (!user?.employeeId) {
    throw new BadRequestError("Your account is not linked to an employee record.");
  }
  return user.employeeId;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function countWeekdays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    if (!isWeekend(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

function getWeekdaysInRange(start: Date, end: Date): Date[] {
  const weekdays: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    if (!isWeekend(current)) {
      weekdays.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return weekdays;
}

async function checkOverlap(
  tx: Prisma.TransactionClient,
  employeeId: string,
  startDate: Date,
  endDate: Date,
  excludeLeaveId?: string,
): Promise<void> {
  const where: Prisma.LeaveRequestWhereInput = {
    employeeId,
    status: {
      in: [LeaveStatus.PENDING, LeaveStatus.APPROVED],
    },
    AND: [
      { startDate: { lte: endDate } },
      { endDate: { gte: startDate } },
    ],
  };

  if (excludeLeaveId) {
    where.NOT = { id: excludeLeaveId };
  }

  const overlapping = await tx.leaveRequest.findFirst({
    where,
    select: { id: true, startDate: true, endDate: true },
  });

  if (overlapping) {
    throw new ConflictError(
      `Leave request overlaps with an existing leave (${overlapping.startDate.toISOString().slice(0, 10)} to ${overlapping.endDate.toISOString().slice(0, 10)}).`,
    );
  }
}

export const LeaveService = {
  async list(q: ListLeavesQuery, req: Request) {
    const canSeeAll = canReadAll(req);
    let employeeIdFilter = q.employeeId;

    if (!canSeeAll) {
      const selfEmployeeId = await resolveEmployeeIdForSelf(req);
      if (employeeIdFilter && employeeIdFilter !== selfEmployeeId) {
        throw new ForbiddenError("You can only view your own leave records.");
      }
      employeeIdFilter = selfEmployeeId;
    }

    const where: Prisma.LeaveRequestWhereInput = {};
    if (employeeIdFilter) where.employeeId = employeeIdFilter;
    if (q.leaveTypeId) where.leaveTypeId = q.leaveTypeId;
    if (q.status) where.status = q.status;
    if (q.startDateFrom || q.startDateTo) {
      where.startDate = {} as Prisma.DateTimeFilter;
      if (q.startDateFrom) (where.startDate as Prisma.DateTimeFilter).gte = startOfDay(q.startDateFrom);
      if (q.startDateTo) (where.startDate as Prisma.DateTimeFilter).lte = startOfDay(q.startDateTo);
    }
    if (q.endDateFrom || q.endDateTo) {
      where.endDate = {} as Prisma.DateTimeFilter;
      if (q.endDateFrom) (where.endDate as Prisma.DateTimeFilter).gte = startOfDay(q.endDateFrom);
      if (q.endDateTo) (where.endDate as Prisma.DateTimeFilter).lte = startOfDay(q.endDateTo);
    }
    if (q.search) {
      where.OR = [
        { employee: { firstName: { contains: q.search, mode: "insensitive" } } },
        { employee: { lastName: { contains: q.search, mode: "insensitive" } } },
        { employee: { employeeCode: { contains: q.search, mode: "insensitive" } } },
        { leaveType: { name: { contains: q.search, mode: "insensitive" } } },
        { leaveType: { code: { contains: q.search, mode: "insensitive" } } },
        { reason: { contains: q.search, mode: "insensitive" } },
      ];
    }

    const orderBy: Prisma.LeaveRequestOrderByWithRelationInput = q.sortBy
      ? { [q.sortBy]: q.sortOrder } as unknown as Prisma.LeaveRequestOrderByWithRelationInput
      : { createdAt: q.sortOrder } as Prisma.LeaveRequestOrderByWithRelationInput;

    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const [totalItems, items] = await Promise.all([
      prisma.leaveRequest.count({ where }),
      prisma.leaveRequest.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              department: { select: { id: true, name: true } },
              designation: { select: { id: true, name: true } },
            },
          },
          leaveType: {
            select: {
              id: true,
              code: true,
              name: true,
              defaultDays: true,
            },
          },
          approver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);

    return { items, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },

  async getById(id: string, req: Request) {
    const canSeeAll = canReadAll(req);

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, name: true } },
          },
        },
        leaveType: true,
        approver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!leave) throw new NotFoundError("Leave request not found.");

    if (!canSeeAll) {
      const selfEmployeeId = await resolveEmployeeIdForSelf(req);
      if (leave.employeeId !== selfEmployeeId) {
        throw new ForbiddenError("You can only view your own leave records.");
      }
    }

    return leave;
  },

  async create(dto: CreateLeaveDto, req: Request) {
    const meta = extractMeta(req);
    const userId = req.user?.id;

    const created = await prisma.$transaction(async (tx) => {
      const employeeExists = await tx.employee.findUnique({
        where: { id: dto.employeeId },
        select: { id: true },
      });
      if (!employeeExists) throw new BadRequestError("Employee not found.");

      const leaveTypeExists = await tx.leaveType.findUnique({
        where: { id: dto.leaveTypeId },
        select: { id: true, status: true },
      });
      if (!leaveTypeExists) throw new BadRequestError("Leave type not found.");
      if (leaveTypeExists.status !== "ACTIVE") {
        throw new BadRequestError("Leave type is not active.");
      }

      const startOnly = startOfDay(dto.startDate);
      const endOnly = startOfDay(dto.endDate);

      if (startOnly > endOnly) {
        throw new BadRequestError("Start date cannot be after end date.");
      }

      await checkOverlap(tx, dto.employeeId, startOnly, endOnly);

      const totalDays = dto.halfDay ? 1 : countWeekdays(startOnly, endOnly);
      if (totalDays <= 0) {
        throw new BadRequestError("Leave must cover at least one weekday.");
      }

      const leave = await tx.leaveRequest.create({
        data: {
          employeeId: dto.employeeId,
          leaveTypeId: dto.leaveTypeId,
          startDate: startOnly,
          endDate: endOnly,
          totalDays,
          halfDay: dto.halfDay,
          reason: dto.reason,
          supportingDoc: dto.supportingDoc ?? null,
          status: LeaveStatus.PENDING,
        },
      });

      await writeAudit(tx, {
        userId,
        action: AuditAction.CREATE,
        entityType: "LeaveRequest",
        entityId: leave.id,
        afterData: omitSensitive(leave),
        metadata: { employeeId: dto.employeeId, leaveTypeId: dto.leaveTypeId },
        ip: meta.ip,
        ua: meta.ua,
      });

      return leave;
    });

    return { leave: created };
  },

  async update(id: string, dto: UpdateLeaveDto, req: Request) {
    const meta = extractMeta(req);

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.leaveRequest.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Leave request not found.");

      if (before.status !== LeaveStatus.PENDING) {
        throw new BadRequestError("Only PENDING leave requests can be updated.");
      }

      const canSeeAll = canReadAll(req);
      if (!canSeeAll) {
        const selfEmployeeId = await resolveEmployeeIdForSelf(req);
        if (before.employeeId !== selfEmployeeId) {
          throw new ForbiddenError("You can only update your own leave requests.");
        }
      }

      let newStartDate = before.startDate;
      let newEndDate = before.endDate;
      if (dto.startDate !== undefined) newStartDate = startOfDay(dto.startDate);
      if (dto.endDate !== undefined) newEndDate = startOfDay(dto.endDate);

      if (newStartDate > newEndDate) {
        throw new BadRequestError("Start date cannot be after end date.");
      }

      if (dto.startDate !== undefined || dto.endDate !== undefined) {
        await checkOverlap(tx, before.employeeId, newStartDate, newEndDate, id);
      }

      if (dto.leaveTypeId !== undefined) {
        const leaveTypeExists = await tx.leaveType.findUnique({
          where: { id: dto.leaveTypeId },
          select: { id: true, status: true },
        });
        if (!leaveTypeExists) throw new BadRequestError("Leave type not found.");
        if (leaveTypeExists.status !== "ACTIVE") {
          throw new BadRequestError("Leave type is not active.");
        }
      }

      const newHalfDay = dto.halfDay !== undefined ? dto.halfDay : before.halfDay;
      const totalDays = newHalfDay ? 1 : countWeekdays(newStartDate, newEndDate);
      if (totalDays <= 0) {
        throw new BadRequestError("Leave must cover at least one weekday.");
      }

      const data: Prisma.LeaveRequestUpdateInput = {};
      if (dto.leaveTypeId !== undefined) data.leaveType = { connect: { id: dto.leaveTypeId } };
      if (dto.startDate !== undefined) data.startDate = newStartDate;
      if (dto.endDate !== undefined) data.endDate = newEndDate;
      if (dto.halfDay !== undefined) data.halfDay = dto.halfDay;
      if (dto.reason !== undefined) data.reason = dto.reason;
      if (dto.supportingDoc !== undefined) data.supportingDoc = dto.supportingDoc ?? null;
      data.totalDays = totalDays;

      if (Object.keys(data).length === 0) {
        return before;
      }

      const after = await tx.leaveRequest.update({
        where: { id },
        data,
      });

      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "LeaveRequest",
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

  async approve(id: string, _dto: ApproveLeaveDto, req: Request) {
    const meta = extractMeta(req);
    const approverId = req.user?.id;

    const approved = await prisma.$transaction(async (tx) => {
      const before = await tx.leaveRequest.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Leave request not found.");

      if (before.status !== LeaveStatus.PENDING) {
        throw new BadRequestError("Only PENDING leave requests can be approved.");
      }

      const afterLeave = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: LeaveStatus.APPROVED,
          approvedById: approverId,
          approvedAt: new Date(),
        },
      });

      const weekdays = getWeekdaysInRange(before.startDate, before.endDate);

      for (const weekday of weekdays) {
        const dateOnly = startOfDay(weekday);
        await tx.attendance.upsert({
          where: {
            employeeId_attendanceDate: {
              employeeId: before.employeeId,
              attendanceDate: dateOnly,
            },
          },
          create: {
            employeeId: before.employeeId,
            attendanceDate: dateOnly,
            status: AttendanceStatus.LEAVE,
            workHours: before.halfDay ? 4 : 0,
          },
          update: {
            status: AttendanceStatus.LEAVE,
            workHours: before.halfDay ? 4 : 0,
          },
        });
      }

      await writeAudit(tx, {
        userId: approverId,
        action: AuditAction.UPDATE,
        entityType: "LeaveRequest",
        entityId: afterLeave.id,
        beforeData: omitSensitive(before),
        afterData: omitSensitive(afterLeave),
        metadata: {
          action: "approve",
          approverId,
          attendanceUpserts: weekdays.length,
        },
        ip: meta.ip,
        ua: meta.ua,
      });

      await writeAudit(tx, {
        userId: approverId,
        entityType: "Attendance",
        action: AuditAction.UPDATE,
        metadata: {
          leaveId: afterLeave.id,
          employeeId: before.employeeId,
          leaveTypeId: before.leaveTypeId,
          dateRange: {
            start: before.startDate.toISOString().slice(0, 10),
            end: before.endDate.toISOString().slice(0, 10),
          },
          weekdays: weekdays.map((d) => d.toISOString().slice(0, 10)),
        },
        ip: meta.ip,
        ua: meta.ua,
      });

      return afterLeave;
    });

    return approved;
  },

  async reject(id: string, dto: RejectLeaveDto, req: Request) {
    const meta = extractMeta(req);
    const approverId = req.user?.id;

    const rejected = await prisma.$transaction(async (tx) => {
      const before = await tx.leaveRequest.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Leave request not found.");

      if (before.status !== LeaveStatus.PENDING) {
        throw new BadRequestError("Only PENDING leave requests can be rejected.");
      }

      const after = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: LeaveStatus.REJECTED,
          rejectReason: dto.rejectReason,
          approvedById: approverId,
          approvedAt: new Date(),
        },
      });

      await writeAudit(tx, {
        userId: approverId,
        action: AuditAction.UPDATE,
        entityType: "LeaveRequest",
        entityId: after.id,
        beforeData: omitSensitive(before),
        afterData: omitSensitive(after),
        metadata: {
          action: "reject",
          approverId,
          rejectReason: dto.rejectReason,
        },
        ip: meta.ip,
        ua: meta.ua,
      });

      return after;
    });

    return rejected;
  },

  async cancel(id: string, _dto: CancelLeaveDto, req: Request) {
    const meta = extractMeta(req);

    const cancelled = await prisma.$transaction(async (tx) => {
      const before = await tx.leaveRequest.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Leave request not found.");

      if (before.status !== LeaveStatus.PENDING) {
        throw new BadRequestError("Only PENDING leave requests can be cancelled.");
      }

      const selfEmployeeId = await resolveEmployeeIdForSelf(req);
      if (before.employeeId !== selfEmployeeId) {
        throw new ForbiddenError("You can only cancel your own leave requests.");
      }

      const after = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: LeaveStatus.CANCELLED,
        },
      });

      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "LeaveRequest",
        entityId: after.id,
        beforeData: omitSensitive(before),
        afterData: omitSensitive(after),
        metadata: { action: "cancel" },
        ip: meta.ip,
        ua: meta.ua,
      });

      return after;
    });

    return cancelled;
  },

  async remove(id: string, req: Request) {
    const meta = extractMeta(req);

    await prisma.$transaction(async (tx) => {
      const before = await tx.leaveRequest.findUnique({ where: { id } });
      if (!before) throw new NotFoundError("Leave request not found.");

      if (
        before.status !== LeaveStatus.PENDING &&
        before.status !== LeaveStatus.CANCELLED &&
        before.status !== LeaveStatus.REJECTED
      ) {
        throw new BadRequestError("Only PENDING, CANCELLED, or REJECTED leave requests can be deleted.");
      }

      await tx.leaveRequest.delete({ where: { id } });

      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.DELETE,
        entityType: "LeaveRequest",
        entityId: id,
        beforeData: omitSensitive(before),
        ip: meta.ip,
        ua: meta.ua,
      });
    });
  },
};
