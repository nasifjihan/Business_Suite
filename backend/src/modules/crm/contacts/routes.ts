import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { ContactsController } from "./controllers";
import {
  CreateContactSchema,
  ListContactsSchema,
  UpdateContactSchema,
} from "./validators";

const contactsRouter = Router();

contactsRouter.use(authenticate());

contactsRouter
  .route("/customer/:customerId")
  .get(
    validate({ query: ListContactsSchema }),
    authorize("crm.contacts.read"),
    ContactsController.listByCustomer,
  )
  .post(
    validate({ body: CreateContactSchema }),
    authorize("crm.contacts.create"),
    ContactsController.createForCustomer,
  );

contactsRouter
  .route("/:id")
  .get(authorize("crm.contacts.read"), ContactsController.getById)
  .patch(
    validate({ body: UpdateContactSchema }),
    authorize("crm.contacts.update"),
    ContactsController.update,
  )
  .delete(
    authorize("crm.contacts.delete"),
    ContactsController.remove,
  );

export { contactsRouter };
