/**
 * CRM module aggregate router.
 * URL surface under /api/v1/crm/*:
 *   /api/v1/crm/customers
 *   /api/v1/crm/customers/:customerId/contacts
 *   /api/v1/crm/contacts/:id
 *   /api/v1/crm/leads, /leads/:id/convert, /leads/:id/stage
 *   /api/v1/crm/opportunities, /opps/:id/stage
 *   /api/v1/crm/activities
 *   /api/v1/crm/contracts
 */
import { Router } from "express";
import { customersRouter } from "./customers/routes";
import { contactsRouter } from "./contacts/routes";
import { leadsRouter } from "./leads/routes";
import { opportunitiesRouter } from "./opportunities/routes";
import { activitiesRouter } from "./activities/routes";
import { contractsRouter } from "./contracts/routes";

const crmRouter = Router();

crmRouter.use("/customers", customersRouter);
crmRouter.use("/customers/:customerId/contacts", contactsRouter);
crmRouter.use("/contacts", contactsRouter);
crmRouter.use("/leads", leadsRouter);
crmRouter.use("/opportunities", opportunitiesRouter);
crmRouter.use("/activities", activitiesRouter);
crmRouter.use("/contracts", contractsRouter);

export { crmRouter };
