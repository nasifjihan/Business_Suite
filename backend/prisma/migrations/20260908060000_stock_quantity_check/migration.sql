-- Defense in depth: let PostgreSQL itself reject negative stock, so an
-- application bug cannot persist an impossible quantity. The POS checkout
-- already guards this in a transaction; this is the backstop underneath it.
--
-- Previously lived in prisma/add_stock_checks.ts, a script you had to remember
-- to run by hand. That script also still referenced "reservedQuantity", a
-- column created in 20260825093328_init_core_tables and dropped again in
-- 20260826095337_phase6_inventory - so it failed with 42703 on every database
-- and the constraint below was the only part that ever applied.
--
-- As a migration it now applies automatically wherever `prisma migrate deploy`
-- runs: local, container, CI and production.

-- DROP first so this is safe on databases where the old script already added it.
ALTER TABLE "Stock" DROP CONSTRAINT IF EXISTS "stock_quantity_nonnegative";
ALTER TABLE "Stock" DROP CONSTRAINT IF EXISTS "stock_reserved_nonnegative";

ALTER TABLE "Stock"
  ADD CONSTRAINT "stock_quantity_nonnegative" CHECK ("quantity" >= 0);
