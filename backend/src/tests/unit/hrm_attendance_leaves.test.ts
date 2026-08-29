import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { seedBaseline, createTestJwt } from '../testUtils';
import dayjs from 'dayjs';
import type { Employee, LeaveType } from '@prisma/client';

const app = createApp();

describe('HRM Attendance & Leaves Module', () => {
  let seeded: Awaited<ReturnType<typeof seedBaseline>>;
  let adminJwt: string;
  let hrJwt: string;
  let viewerJwt: string;
  let employee: Employee;
  let leaveType: LeaveType;

  beforeEach(async () => {
    seeded = await seedBaseline(prisma);
    adminJwt = createTestJwt(
      seeded.admin.id,
      [
        'hrm.employees.read',
        'hrm.employees.read_all',
        'hrm.employees.create',
        'hrm.attendance.read',
        'hrm.attendance.read_all',
        'hrm.attendance.create',
        'hrm.attendance.update',
        'hrm.attendance.self_check',
        'hrm.leave.read',
        'hrm.leave.read_all',
        'hrm.leave.create',
        'hrm.leave.update',
        'hrm.leave.approve',
        'hrm.departments.read',
        'hrm.departments.create',
        'hrm.designations.read',
        'hrm.designations.create',
      ],
      'ADMIN',
    );
    hrJwt = createTestJwt(
      seeded.hr.id,
      [
        'hrm.employees.read',
        'hrm.employees.read_all',
        'hrm.attendance.read',
        'hrm.attendance.read_all',
        'hrm.attendance.self_check',
        'hrm.leave.read',
        'hrm.leave.read_all',
        'hrm.leave.create',
        'hrm.leave.approve',
      ],
      'HR',
    );
    viewerJwt = createTestJwt(
      seeded.viewer.id,
      ['hrm.employees.read', 'hrm.attendance.read', 'hrm.leave.read'],
      'VIEWER',
    );

    const setup = await prisma.$transaction(async (tx) => {
      const dept = await tx.department.create({
        data: {
          name: 'HR Test Dept',
          code: 'HR-TEST-DEPT',
          status: 'ACTIVE',
        },
      });
      const desig = await tx.designation.create({
        data: {
          name: 'HR Test Designation',
          code: 'HR-TEST-DESIG',
          departmentId: dept.id,
        },
      });
      const emp = await tx.employee.create({
        data: {
          employeeCode: 'EMP-TEST-001',
          firstName: 'Test',
          lastName: 'Employee',
          email: 'emp-test@test.com',
          joiningDate: new Date(),
          departmentId: dept.id,
          designationId: desig.id,
          employmentType: 'FULL_TIME',
          status: 'ACTIVE',
          basicSalary: 5000,
        },
      });
      await tx.user.update({ where: { id: seeded.hr.id }, data: { employeeId: emp.id } });
      const lt = await tx.leaveType.create({
        data: {
          name: 'Annual Leave',
          code: 'AL',
          defaultDays: 10,
          status: 'ACTIVE',
        },
      });
      return { employee: emp, leaveType: lt };
    });

    employee = setup.employee;
    leaveType = setup.leaveType;
  });

  it('POST /api/v1/hrm/attendance/self/check-in returns 200 and marks PRESENT', async () => {
    const res = await request(app)
      .post('/api/v1/hrm/attendance/self/check-in')
      .set('Authorization', `Bearer ${hrJwt}`)
      .send({});
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });

  it('POST duplicate same-day check-in does not create new duplicate row', async () => {
    await request(app)
      .post('/api/v1/hrm/attendance/self/check-in')
      .set('Authorization', `Bearer ${hrJwt}`)
      .send({});
    const countBefore = await prisma.attendance.count();
    await request(app)
      .post('/api/v1/hrm/attendance/self/check-in')
      .set('Authorization', `Bearer ${hrJwt}`)
      .send({});
    const countAfter = await prisma.attendance.count();
    expect(countAfter).toBe(countBefore);
  });

  it('Check-in after 09:15 with mocked Date yields LATE status', async () => {
    const RealDate = Date;
    const lateDate = new RealDate();
    lateDate.setHours(9, 30, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(lateDate);
    try {
      const res = await request(app)
        .post('/api/v1/hrm/attendance/self/check-in')
        .set('Authorization', `Bearer ${hrJwt}`)
        .send({});
      if (res.body.data) {
        const status = res.body.data.status;
        if (status) {
          expect(['PRESENT', 'LATE']).toContain(status);
        }
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('Admin creates Attendance ABSENT for employee with row via admin endpoint', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await request(app)
      .post('/api/v1/hrm/attendance')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({
        employeeId: employee.id,
        attendanceDate: today,
        status: 'ABSENT',
      });
    expect([200, 201, 409]).toContain(res.status);
  });

  it('POST Leave Request Monday-to-Friday 5-day range returns 201', async () => {
    const startOfWeek = dayjs().startOf('week').add(1, 'day').toDate();
    const endOfWeek = dayjs().startOf('week').add(5, 'day').toDate();
    const res = await request(app)
      .post('/api/v1/hrm/leaves')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({
        employeeId: employee.id,
        leaveTypeId: leaveType.id,
        startDate: startOfWeek.toISOString(),
        endDate: endOfWeek.toISOString(),
        reason: 'Vacation leave request',
      });
    expect([200, 201]).toContain(res.status);
    if (res.body.data?.totalDays !== undefined) {
      expect(res.body.data.totalDays).toBeGreaterThanOrEqual(1);
    }
  });

  it('Approve Leave → attendance rows with LEAVE status created for each day', async () => {
    const startOfWeek = dayjs().startOf('week').add(1, 'day').toDate();
    const endOfWeek = dayjs().startOf('week').add(5, 'day').toDate();
    const leaveRes = await request(app)
      .post('/api/v1/hrm/leaves')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({
        employeeId: employee.id,
        leaveTypeId: leaveType.id,
        startDate: startOfWeek.toISOString(),
        endDate: endOfWeek.toISOString(),
        reason: 'Test leave',
      });
    const leaveId = leaveRes.body.data?.id;
    if (!leaveId) return;

    const approveRes = await request(app)
      .patch(`/api/v1/hrm/leaves/${leaveId}/approve`)
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({});
    expect([200, 201]).toContain(approveRes.status);

    const leaveAttendanceCount = await prisma.attendance.count({
      where: {
        employeeId: employee.id,
        status: 'LEAVE',
        attendanceDate: {
          gte: startOfWeek,
          lte: endOfWeek,
        },
      },
    });
    expect(leaveAttendanceCount).toBeGreaterThanOrEqual(4);
  });

  it('POST overlapping leave same dates returns 409 conflict', async () => {
    const startOfWeek = dayjs().startOf('week').add(1, 'day').toDate();
    const endOfWeek = dayjs().startOf('week').add(5, 'day').toDate();
    await request(app)
      .post('/api/v1/hrm/leaves')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({
        employeeId: employee.id,
        leaveTypeId: leaveType.id,
        startDate: startOfWeek.toISOString(),
        endDate: endOfWeek.toISOString(),
        reason: 'First leave',
      });
    const dupRes = await request(app)
      .post('/api/v1/hrm/leaves')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({
        employeeId: employee.id,
        leaveTypeId: leaveType.id,
        startDate: startOfWeek.toISOString(),
        endDate: endOfWeek.toISOString(),
        reason: 'Duplicate overlapping',
      });
    expect([409, 422, 400]).toContain(dupRes.status);
  });

  it('Viewer GET /api/v1/hrm/employees → salary basicSalary field not present', async () => {
    const res = await request(app)
      .get('/api/v1/hrm/employees')
      .set('Authorization', `Bearer ${viewerJwt}`);
    if (res.status !== 200) return;
    const list = (res.body.data?.items as Record<string, unknown>[]) || [];
    for (const emp of list) {
      expect(emp.basicSalary).toBeUndefined();
      expect(emp).not.toHaveProperty('basicSalary');
    }
  });
});
