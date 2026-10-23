import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { uploadSingleImage } from "@/lib/uploads";
import { ProductsController } from "./controllers";
import {
  CreateProductSchema,
  ListLowStockSchema,
  ListProductsSchema,
  UpdateProductSchema,
} from "./validators";

const productsRouter = Router();

productsRouter.use(authenticate());

productsRouter
  .route("/")
  .get(
    validate({ query: ListProductsSchema }),
    authorize("inventory.products.read"),
    ProductsController.list,
  )
  .post(
    validate({ body: CreateProductSchema }),
    authorize("inventory.products.create"),
    ProductsController.create,
  );

productsRouter
  .route("/low-stock")
  .get(
    validate({ query: ListLowStockSchema }),
    authorize("inventory.products.read"),
    ProductsController.listLowStock,
  );

productsRouter
  .route("/:id")
  .get(authorize("inventory.products.read"), ProductsController.getById)
  .patch(
    validate({ body: UpdateProductSchema }),
    authorize("inventory.products.update"),
    ProductsController.update,
  )
  .delete(
    authorize("inventory.products.delete"),
    ProductsController.remove,
  );

productsRouter
  .route("/:id/stock-summary")
  .get(authorize("inventory.products.read"), ProductsController.stockSummary);

// Reuses inventory.products.update rather than introducing a new permission
// code: replacing a product's image IS a product update. Avoids touching the
// 143-code RBAC matrix and the role grants that go with it.
//
// authorize() runs BEFORE multer on purpose — an unauthenticated or
// unauthorised caller should be rejected before we buffer their bytes.
productsRouter
  .route("/:id/image")
  .post(
    authorize("inventory.products.update"),
    uploadSingleImage("file"),
    ProductsController.uploadImage,
  );

export { productsRouter };
