import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { ReportsController } from "./controllers";

const reportsRouter = Router();

reportsRouter.use(authenticate());

reportsRouter.get(
  "/summary",
  authorize({ any: ["hrm.employees.read", "hrm.departments.read", "hrm.attendance.read", "hrm.leave.read"] }),
  ReportsController.summary
);

export { reportsRouter };
