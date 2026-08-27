/**
 * HRM module aggregate router.
 * URL surface under /api/v1/hrm/*:
 *   /api/v1/hrm/employees
 *   /api/v1/hrm/attendance
 *   /api/v1/hrm/leave-types
 *   /api/v1/hrm/leaves
 */
import { Router } from "express";
import { departmentsRouter } from "./departments/routes";
import { designationsRouter } from "./designations/routes";
import { employeesRouter } from "./employees/routes";
import { attendanceRouter } from "./attendance/routes";
import { leaveTypesRouter } from "./leaveTypes/routes";
import { leavesRouter } from "./leaves/routes";
import { reportsRouter } from "./reports/routes";

const hrmRouter = Router();

hrmRouter.use("/departments", departmentsRouter);
hrmRouter.use("/designations", designationsRouter);
hrmRouter.use("/employees", employeesRouter);
hrmRouter.use("/attendance", attendanceRouter);
hrmRouter.use("/leave-types", leaveTypesRouter);
hrmRouter.use("/leaves", leavesRouter);
hrmRouter.use("/reports", reportsRouter);

export { hrmRouter };
