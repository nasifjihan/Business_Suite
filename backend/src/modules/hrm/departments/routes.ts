import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { DepartmentsController } from "./controllers";
import {
  CreateDepartmentSchema,
  ListDepartmentsSchema,
  UpdateDepartmentSchema,
} from "./validators";

const departmentsRouter = Router();

departmentsRouter.use(authenticate());

departmentsRouter
  .route("/")
  .get(
    validate({ query: ListDepartmentsSchema }),
    authorize("hrm.departments.read"),
    DepartmentsController.list,
  )
  .post(
    validate({ body: CreateDepartmentSchema }),
    authorize("hrm.departments.create"),
    DepartmentsController.create,
  );

departmentsRouter
  .route("/:id")
  .get(authorize("hrm.departments.read"), DepartmentsController.getById)
  .patch(
    validate({ body: UpdateDepartmentSchema }),
    authorize("hrm.departments.update"),
    DepartmentsController.update,
  )
  .delete(
    authorize("hrm.departments.delete"),
    DepartmentsController.remove,
  );

export { departmentsRouter };
