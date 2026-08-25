import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { PermissionsController } from "./controllers";

const permissionsRouter = Router();

permissionsRouter.use(authenticate());

permissionsRouter.get(
  "/",
  // Anyone who can update role or update users OR just view roles is allowed to
  // see permission list.
  authorize({ any: ["roles.read", "roles.update", "users.update"] }),
  PermissionsController.listGrouped,
);

permissionsRouter.get(
  "/flat",
  authorize({ any: ["roles.read", "roles.update", "users.update"] }),
  PermissionsController.listFlat,
);

export { permissionsRouter };
