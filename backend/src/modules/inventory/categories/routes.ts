import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { CategoriesController } from "./controllers";
import {
  CreateCategorySchema,
  ListCategoriesSchema,
  UpdateCategorySchema,
} from "./validators";

const categoriesRouter = Router();

categoriesRouter.use(authenticate());

categoriesRouter
  .route("/")
  .get(
    validate({ query: ListCategoriesSchema }),
    authorize("inventory.categories.read"),
    CategoriesController.list,
  )
  .post(
    validate({ body: CreateCategorySchema }),
    authorize("inventory.categories.create"),
    CategoriesController.create,
  );

categoriesRouter
  .route("/:id")
  .get(authorize("inventory.categories.read"), CategoriesController.getById)
  .patch(
    validate({ body: UpdateCategorySchema }),
    authorize("inventory.categories.update"),
    CategoriesController.update,
  )
  .delete(
    authorize("inventory.categories.delete"),
    CategoriesController.remove,
  );

export { categoriesRouter };
