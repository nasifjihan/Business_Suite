import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import { ProfileController } from "./controllers";
import { UpdateOwnProfileSchema } from "./validators";
import { ChangeOwnPasswordSchema } from "@/modules/users/validators";

const profileRouter = Router();

profileRouter.use(authenticate());

profileRouter
  .route("/")
  .get(ProfileController.get)
  .patch(validate({ body: UpdateOwnProfileSchema }), ProfileController.update);

profileRouter.post(
  "/change-password",
  validate({ body: ChangeOwnPasswordSchema }),
  ProfileController.changePassword,
);

export { profileRouter };
