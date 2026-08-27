import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { LeaveTypesController } from "./controllers";
import {
  CreateLeaveTypeSchema,
  ListLeaveTypesSchema,
  UpdateLeaveTypeSchema,
} from "./validators";
export * as validators from "./validators";
export * as services from "./services";
export * as controllers from "./controllers";

const leaveTypesRouter = Router();

leaveTypesRouter.use(authenticate());

leaveTypesRouter
  .route("/")
  .get(
    validate({ query: ListLeaveTypesSchema }),
    authorize("hrm.leave_types.read"),
    LeaveTypesController.list,
  )
  .post(
    validate({ body: CreateLeaveTypeSchema }),
    authorize("hrm.leave_types.create"),
    LeaveTypesController.create,
  );

leaveTypesRouter
  .route("/:id")
  .get(
    authorize("hrm.leave_types.read"),
    LeaveTypesController.getById,
  )
  .patch(
    validate({ body: UpdateLeaveTypeSchema }),
    authorize("hrm.leave_types.update"),
    LeaveTypesController.update,
  )
  .delete(
    authorize("hrm.leave_types.delete"),
    LeaveTypesController.remove,
  );

export { leaveTypesRouter };
export const routes = leaveTypesRouter;
export default leaveTypesRouter;
