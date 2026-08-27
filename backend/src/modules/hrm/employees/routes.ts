import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { EmployeesController } from "./controllers";
import {
  CreateEmployeeSchema,
  ListEmployeesSchema,
  UpdateEmployeeSchema,
} from "./validators";

const employeesRouter = Router();

employeesRouter.use(authenticate());

employeesRouter
  .route("/")
  .get(
    validate({ query: ListEmployeesSchema }),
    authorize("hrm.employees.read"),
    EmployeesController.list,
  )
  .post(
    validate({ body: CreateEmployeeSchema }),
    authorize("hrm.employees.create"),
    EmployeesController.create,
  );

employeesRouter
  .route("/:id")
  .get(authorize("hrm.employees.read"), EmployeesController.getById)
  .patch(
    validate({ body: UpdateEmployeeSchema }),
    authorize("hrm.employees.update"),
    EmployeesController.update,
  )
  .delete(
    authorize("hrm.employees.delete"),
    EmployeesController.remove,
  );

export { employeesRouter };
