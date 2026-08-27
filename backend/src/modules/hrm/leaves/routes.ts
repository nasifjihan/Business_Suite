import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { LeavesController } from "./controllers";
import {
  ApproveLeaveSchema,
  CancelLeaveSchema,
  CreateLeaveSchema,
  ListLeavesSchema,
  RejectLeaveSchema,
  UpdateLeaveSchema,
} from "./validators";
export * as validators from "./validators";
export * as services from "./services";
export * as controllers from "./controllers";

const leavesRouter = Router();

leavesRouter.use(authenticate());

leavesRouter
  .route("/")
  .get(
    validate({ query: ListLeavesSchema }),
    authorize({ any: ["hrm.leave.read", "hrm.leave.read_all"] }),
    LeavesController.list,
  )
  .post(
    validate({ body: CreateLeaveSchema }),
    authorize("hrm.leave.create"),
    LeavesController.create,
  );

leavesRouter
  .route("/:id")
  .get(
    authorize({ any: ["hrm.leave.read", "hrm.leave.read_all"] }),
    LeavesController.getById,
  )
  .patch(
    validate({ body: UpdateLeaveSchema }),
    authorize("hrm.leave.update"),
    LeavesController.update,
  )
  .delete(
    authorize("hrm.leave.delete"),
    LeavesController.remove,
  );

leavesRouter
  .route("/:id/approve")
  .patch(
    validate({ body: ApproveLeaveSchema }),
    authorize("hrm.leave.approve"),
    LeavesController.approve,
  );

leavesRouter
  .route("/:id/reject")
  .patch(
    validate({ body: RejectLeaveSchema }),
    authorize("hrm.leave.approve"),
    LeavesController.reject,
  );

leavesRouter
  .route("/:id/cancel")
  .patch(
    validate({ body: CancelLeaveSchema }),
    authorize("hrm.leave.create"),
    LeavesController.cancel,
  );

export { leavesRouter };
export const routes = leavesRouter;
export default leavesRouter;
