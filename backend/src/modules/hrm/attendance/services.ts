import type { Request } from "express";
import { prisma } from "@/lib/prisma";
import type {
  CheckInDto,
  CheckOutDto,
  CreateAttendanceDto,
  ListAttendanceQuery,
  SelfCheckInDto,
  SelfCheckOutDto,
  UpdateAttendanceDto,
} from "./validators";
import { AuditAction, AttendanceStatus, Prisma } from "@prisma/client";
import {
  applyPagination,
  buildPaginationMeta,
} from "@/utils/pagination";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import { omitSensitive, writeAudit, extractMeta } from "@/middleware/audit";
import { hasPermission } from "@/utils/permissions";

export type ListAttendanceResponse = Awaited<ReturnType<typeof AttendanceService["list"]>>;

function canReadAll(req: Request): boolean {
  const codes: string[] = req.permissionCodes ?? [];
  return hasPermission(codes, "hrm.attendance.read_all");
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

function calculateWorkHours(checkInAt: Date, checkOutAt: Date): number {
  const diffMs = checkOutAt.getTime() - checkInAt.getTime();
  if (diffMs <= 0) return 0;
  const hours = diffMs / (1000 * 60 * 60);
  return Math.round(hours * 100) / 100;
}

function determineStatus(checkInAt: Date | null, checkOutAt: Date | null, workHours: number | null): AttendanceStatus {
  if (!checkInAt && !checkOutAt) return AttendanceStatus.ABSENT;
  if (workHours !== null) {
    if (workHours >= 7) return AttendanceStatus.PRESENT;
    if (workHours >= 4) return AttendanceStatus.HALF_DAY;
  }
  return AttendanceStatus.PRESENT;
}

export const AttendanceService = {
  async list(q: ListAttendanceQuery, req: Request) {
    const canSeeAll = canReadAll(req);
    let employeeIdFilter = q.employeeId;

    if (!canSeeAll) {
      const selfEmployeeId = await resolveEmployeeIdForSelf(req);
      if (employeeIdFilter && employeeIdFilter !== selfEmployeeId) {
        throw new ForbiddenError("You can only view your own attendance records.");
      }
      employeeIdFilter = selfEmployeeId;
    }

    const where: Record<string, unknown> = {};
    if (employeeIdFilter) where.employeeId = employeeIdFilter;
    if (q.status) where.status = q.status;
    if (q.fromDate || q.toDate) {
      where.attendanceDate = {} as Record<string, unknown>;
      if (q.fromDate) (where.attendanceDate as Record<string, unknown>).gte = startOfDay(q.fromDate);
      if (q.toDate) (where.attendanceDate as Record<string, unknown>).lte = startOfDay(q.toDate);
    }
    if (q.search) {
      where.employee = {
        OR: [
          { firstName: { contains: q.search, mode: "insensitive" } },
          { lastName: { contains: q.search, mode: "insensitive" } },
          { employeeCode: { contains: q.search, mode: "insensitive" } },
        ],
      };
    }

    const orderBy: Record<string, unknown> = q.sortBy
      ? { [q.sortBy]: q.sortOrder }
      : { attendanceDate: q.sortOrder };

    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const [totalItems, items] = await Promise.all([
      prisma.attendance.count({ where }),
      prisma.attendance.findMany({
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
        },
      }),
    ]);

    return { items, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },

  async getByEmployeeAndDate(employeeId: string, attendanceDate: Date, req: Request) {
    const canSeeAll = canReadAll(req);
    if (!canSeeAll) {
      const selfEmployeeId = await resolveEmployeeIdForSelf(req);
      if (employeeId !== selfEmployeeId) {
        throw new ForbiddenError("You can only view your own attendance records.");
      }
    }

    const record = await prisma.attendance.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId,
          attendanceDate: startOfDay(attendanceDate),
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    if (!record) throw new NotFoundError("Attendance record not found.");
    return record;
  },

  async adminCreate(dto: CreateAttendanceDto, req: Request) {
    const meta = extractMeta(req);

    const created = await prisma.$transaction(async (tx) => {
      const employeeExists = await tx.employee.findUnique({
        where: { id: dto.employeeId },
        select: { id: true },
      });
      if (!employeeExists) throw new BadRequestError("Employee not found.");

      const dateOnly = startOfDay(dto.attendanceDate);

      const existing = await tx.attendance.findUnique({
        where: {
          employeeId_attendanceDate: {
            employeeId: dto.employeeId,
            attendanceDate: dateOnly,
          },
        },
      });
      if (existing) {
        throw new BadRequestError("Attendance record already exists for this employee and date.");
      }

      const workHours =
        dto.workHours !== undefined
          ? dto.workHours
          : dto.checkInAt && dto.checkOutAt
            ? calculateWorkHours(dto.checkInAt, dto.checkOutAt)
            : null;

      const status = dto.status !== undefined
        ? dto.status
        : determineStatus(dto.checkInAt ?? null, dto.checkOutAt ?? null, workHours);

      const attendance = await tx.attendance.create({
        data: {
          employeeId: dto.employeeId,
          attendanceDate: dateOnly,
          checkInAt: dto.checkInAt ?? null,
          checkOutAt: dto.checkOutAt ?? null,
          status,
          workHours: workHours !== null ? workHours : undefined,
          checkInNote: dto.checkInNote || null,
          checkOutNote: dto.checkOutNote || null,
        },
      });

      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.CREATE,
        entityType: "Attendance",
        entityId: attendance.id,
        afterData: omitSensitive(attendance),
        ip: meta.ip,
        ua: meta.ua,
      });
      return attendance;
    });

    return { attendance: created };
  },

  async adminUpdate(employeeId: string, attendanceDate: Date, dto: UpdateAttendanceDto, req: Request) {
    const meta = extractMeta(req);

    const updated = await prisma.$transaction(async (tx) => {
      const dateOnly = startOfDay(attendanceDate);
      const before = await tx.attendance.findUnique({
        where: {
          employeeId_attendanceDate: { employeeId, attendanceDate: dateOnly },
        },
      });
      if (!before) throw new NotFoundError("Attendance record not found.");

      const data: Prisma.AttendanceUpdateInput = {};

      let newCheckIn = before.checkInAt;
      let newCheckOut = before.checkOutAt;
      if (dto.checkInAt !== undefined) {
        newCheckIn = dto.checkInAt;
        data.checkInAt = dto.checkInAt;
      }
      if (dto.checkOutAt !== undefined) {
        newCheckOut = dto.checkOutAt;
        data.checkOutAt = dto.checkOutAt;
      }
      if (dto.status !== undefined) data.status = dto.status;
      if (dto.checkInNote !== undefined) data.checkInNote = dto.checkInNote || null;
      if (dto.checkOutNote !== undefined) data.checkOutNote = dto.checkOutNote || null;

      if (dto.workHours !== undefined) {
        data.workHours = dto.workHours;
      } else if (newCheckIn && newCheckOut) {
        data.workHours = calculateWorkHours(newCheckIn, newCheckOut);
      }

      if (dto.status === undefined) {
        const currentWorkHours =
          (dto.workHours !== undefined ? dto.workHours : null) ??
          (newCheckIn && newCheckOut ? calculateWorkHours(newCheckIn, newCheckOut) : before.workHours?.toNumber() ?? null);
        data.status = determineStatus(newCheckIn, newCheckOut, currentWorkHours);
      }

      if (Object.keys(data).length === 0) return before;

      const after = await tx.attendance.update({
        where: {
          employeeId_attendanceDate: { employeeId, attendanceDate: dateOnly },
        },
        data,
      });

      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "Attendance",
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

  async adminDelete(employeeId: string, attendanceDate: Date, req: Request) {
    const meta = extractMeta(req);

    await prisma.$transaction(async (tx) => {
      const dateOnly = startOfDay(attendanceDate);
      const before = await tx.attendance.findUnique({
        where: {
          employeeId_attendanceDate: { employeeId, attendanceDate: dateOnly },
        },
      });
      if (!before) throw new NotFoundError("Attendance record not found.");

      await tx.attendance.delete({
        where: {
          employeeId_attendanceDate: { employeeId, attendanceDate: dateOnly },
        },
      });

      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.DELETE,
        entityType: "Attendance",
        entityId: before.id,
        beforeData: omitSensitive(before),
        ip: meta.ip,
        ua: meta.ua,
      });
    });
  },

  async selfCheckIn(dto: SelfCheckInDto, req: Request) {
    const meta = extractMeta(req);
    const employeeId = await resolveEmployeeIdForSelf(req);

    const result = await prisma.$transaction(async (tx) => {
      const dateOnly = startOfDay(dto.attendanceDate ?? new Date());
      const now = new Date();

      const existing = await tx.attendance.findUnique({
        where: {
          employeeId_attendanceDate: { employeeId, attendanceDate: dateOnly },
        },
      });

      let attendance;
      if (existing) {
        if (existing.checkInAt) {
          throw new BadRequestError("You have already checked in for this date.");
        }
        attendance = await tx.attendance.update({
          where: {
            employeeId_attendanceDate: { employeeId, attendanceDate: dateOnly },
          },
          data: {
            checkInAt: now,
            checkInNote: dto.checkInNote || null,
            status: AttendanceStatus.PRESENT,
          },
        });
      } else {
        attendance = await tx.attendance.create({
          data: {
            employeeId,
            attendanceDate: dateOnly,
            checkInAt: now,
            checkInNote: dto.checkInNote || null,
            status: AttendanceStatus.PRESENT,
          },
        });
      }

      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "Attendance",
        entityId: attendance.id,
        afterData: omitSensitive(attendance),
        metadata: { action: "self_check_in" },
        ip: meta.ip,
        ua: meta.ua,
      });
      return attendance;
    });

    return { attendance: result };
  },

  async selfCheckOut(dto: SelfCheckOutDto, req: Request) {
    const meta = extractMeta(req);
    const employeeId = await resolveEmployeeIdForSelf(req);

    const result = await prisma.$transaction(async (tx) => {
      const dateOnly = startOfDay(dto.attendanceDate ?? new Date());
      const now = new Date();

      const existing = await tx.attendance.findUnique({
        where: {
          employeeId_attendanceDate: { employeeId, attendanceDate: dateOnly },
        },
      });

      if (!existing) {
        throw new BadRequestError("No check-in record found for this date. Please check in first.");
      }
      if (!existing.checkInAt) {
        throw new BadRequestError("Check-in time is missing for this date.");
      }
      if (existing.checkOutAt) {
        throw new BadRequestError("You have already checked out for this date.");
      }

      const workHours = calculateWorkHours(existing.checkInAt, now);
      const status = determineStatus(existing.checkInAt, now, workHours);

      const attendance = await tx.attendance.update({
        where: {
          employeeId_attendanceDate: { employeeId, attendanceDate: dateOnly },
        },
        data: {
          checkOutAt: now,
          checkOutNote: dto.checkOutNote || null,
          workHours,
          status,
        },
      });

      await writeAudit(tx, {
        userId: req.user?.id,
        action: AuditAction.UPDATE,
        entityType: "Attendance",
        entityId: attendance.id,
        beforeData: omitSensitive(existing),
        afterData: omitSensitive(attendance),
        metadata: { action: "self_check_out" },
        ip: meta.ip,
        ua: meta.ua,
      });
      return attendance;
    });

    return { attendance: result };
  },
};
