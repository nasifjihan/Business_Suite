import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { UsersController } from "./controllers";
import {
  CreateUserSchema,
  ListUsersSchema,
  UpdateUserSchema,
} from "./validators";

const usersRouter = Router();

usersRouter.use(authenticate());

usersRouter
  .route("/")
  .get(
    validate({ query: ListUsersSchema }),
    authorize("users.read"),
    UsersController.list,
  )
  .post(
    validate({ body: CreateUserSchema }),
    authorize("users.create"),
    UsersController.create,
  );

usersRouter
  .route("/:id")
  .get(authorize("users.read"), UsersController.getById)
  .patch(
    validate({ body: UpdateUserSchema }),
    authorize("users.update"),
    UsersController.update,
  );

usersRouter
  .post(
    "/:id/activate",
    authorize("users.update"),
    UsersController.activate,
  )
  .post(
    "/:id/deactivate",
    authorize("users.update"),
    UsersController.deactivate,
  );

export { usersRouter };
