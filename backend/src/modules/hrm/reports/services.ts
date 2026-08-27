import { prisma } from "../../../lib/prisma";
import type { Request } from "express";
import type { AttendanceStatus } from "@prisma/client";

const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "PRESENT",
  "LATE",
  "ABSENT",
  "HALF_DAY",
  "LEAVE",
];

export class ReportService {
  static async summary(req: Request) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString().slice(0, 10);
    const dept = (req.query.departmentId as string) || undefined;

    const whereEmp: any = { employmentStatus: { not: "TERMINATED" } };
    if (dept) whereEmp.departmentId = dept;

    const headcount = await prisma.employee.count({ where: whereEmp });

    const onLeaveToday = await prisma.attendance.count({
      where: { attendanceDate: todayIso, status: "LEAVE", employee: whereEmp ? { departmentId: dept } : undefined },
    });

    const presentToday = await prisma.attendance.count({
      where: {
        attendanceDate: todayIso,
        status: { in: ["PRESENT", "LATE", "HALF_DAY"] },
        employee: whereEmp ? { departmentId: dept } : undefined,
      },
    });
    const totalTodayTracked = await prisma.attendance.count({
      where: {
        attendanceDate: todayIso,
        employee: whereEmp ? { departmentId: dept } : undefined,
      },
    });
    const attendancePct = totalTodayTracked > 0 ? Math.round((presentToday / totalTodayTracked) * 1000) / 10 : 0;

    const pendingLeaves = await prisma.leaveRequest.count({
      where: { status: "PENDING", employee: whereEmp ? { departmentId: dept } : undefined },
    });

    const todayByStatusRaw = await prisma.attendance.groupBy({
      by: ["status"],
      where: {
        attendanceDate: todayIso,
        employee: whereEmp ? { departmentId: dept } : undefined,
      },
      _count: { status: true },
    });
    const todayByStatus = ATTENDANCE_STATUSES.map((s) => ({
      status: s,
      count: todayByStatusRaw.find((r: any) => r.status === s)?._count?.status ?? 0,
    }));

    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const monthNow = today.getMonth();
    const upcomingAnniversaries = (
      await prisma.employee.findMany({
        where: {
          ...whereEmp,
          joiningDate: { gte: startOfYear.toISOString() },
        },
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          joiningDate: true,
        },
        take: 8,
        orderBy: [{ joiningDate: "asc" }],
      })
    )
      .filter((e) => {
        const j = new Date(e.joiningDate);
        return j.getMonth() === monthNow || j.getMonth() === (monthNow + 1) % 12;
      })
      .map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        code: e.employeeCode,
        joiningDate: typeof e.joiningDate === "string" ? e.joiningDate : e.joiningDate.toISOString().slice(0, 10),
        yearsService: Math.max(0, today.getFullYear() - new Date(e.joiningDate).getFullYear()),
      }));

    const recentJoiners = await prisma.employee.findMany({
      where: whereEmp,
      take: 5,
      orderBy: [{ joiningDate: "desc" }],
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        joiningDate: true,
        department: { select: { name: true } },
      },
    });

    return {
      headcount,
      onLeaveToday,
      attendanceTodayPct: attendancePct,
      pendingLeaves,
      todayByStatus,
      upcomingAnniversaries,
      recentJoiners: recentJoiners.map((e: any) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        code: e.employeeCode,
        joiningDate: typeof e.joiningDate === "string" ? e.joiningDate : e.joiningDate.toISOString().slice(0, 10),
        departmentName: e.department?.name,
      })),
    };
  }
}
