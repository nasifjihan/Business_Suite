import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { RolesController } from "./controllers";
import { CreateRoleSchema, UpdateRoleSchema } from "./validators";

const rolesRouter = Router();

rolesRouter.use(authenticate());

rolesRouter
  .route("/")
  .get(authorize("roles.read"), RolesController.list)
  .post(
    validate({ body: CreateRoleSchema }),
    authorize("roles.create"),
    RolesController.create,
  );

rolesRouter
  .route("/:id")
  .get(authorize("roles.read"), RolesController.getById)
  .patch(
    validate({ body: UpdateRoleSchema }),
    authorize("roles.update"),
    RolesController.update,
  )
  .delete(authorize("roles.delete"), RolesController.remove);

export { rolesRouter };
