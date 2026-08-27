import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { AttendanceController } from "./controllers";
import {
  CreateAttendanceSchema,
  ListAttendanceSchema,
  SelfCheckInSchema,
  SelfCheckOutSchema,
  UpdateAttendanceSchema,
} from "./validators";

const attendanceRouter = Router();

attendanceRouter.use(authenticate());

attendanceRouter
  .route("/")
  .get(
    validate({ query: ListAttendanceSchema }),
    authorize({ any: ["hrm.attendance.read", "hrm.attendance.read_all"] }),
    AttendanceController.list,
  )
  .post(
    validate({ body: CreateAttendanceSchema }),
    authorize("hrm.attendance.create"),
    AttendanceController.adminCreate,
  );

attendanceRouter
  .route("/self/check-in")
  .post(
    validate({ body: SelfCheckInSchema }),
    authorize("hrm.attendance.self_check"),
    AttendanceController.selfCheckIn,
  );

attendanceRouter
  .route("/self/check-out")
  .post(
    validate({ body: SelfCheckOutSchema }),
    authorize("hrm.attendance.self_check"),
    AttendanceController.selfCheckOut,
  );

attendanceRouter
  .route("/:employeeId/:attendanceDate")
  .get(
    authorize({ any: ["hrm.attendance.read", "hrm.attendance.read_all"] }),
    AttendanceController.getByEmployeeAndDate,
  )
  .patch(
    validate({ body: UpdateAttendanceSchema }),
    authorize("hrm.attendance.update"),
    AttendanceController.adminUpdate,
  )
  .delete(
    authorize("hrm.attendance.delete"),
    AttendanceController.adminDelete,
  );

export { attendanceRouter };
