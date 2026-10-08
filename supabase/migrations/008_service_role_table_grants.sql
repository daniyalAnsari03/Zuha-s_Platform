-- =============================================================================
-- Zuha — 008: explicit table grants for service_role
-- Run this file in the Supabase SQL Editor AFTER 007_store_images_bucket.sql.
-- Every statement is idempotent, so it is safe to run more than once.
--
-- WHY: the dashboard failed to save with
--   "permission denied for table categories"
-- even though it writes with the service-role client.
--
-- RLS and GRANT are two separate gates in Postgres:
--   * RLS   decides WHICH ROWS a query may touch. service_role bypasses it.
--   * GRANT decides WHETHER the role may run the statement at all. It is
--     checked BEFORE RLS, and bypassing RLS does not bypass it.
--
-- 005 granted the browser roles their (deliberately narrow) privileges, and
-- Supabase's "automatically expose new tables to new roles" default is OFF, so
-- service_role was never granted anything on the public tables itself. Every
-- dashboard write therefore died at the GRANT gate.
--
-- This migration gives service_role select, insert, update and delete on every
-- table in the public schema, plus usage/selection on the order-number sequence.
-- It touches anon and authenticated not at all: their grants stay exactly as
-- 005 / 006 left them, and no RLS policy, table, column or row is changed.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Schema usage.
--    Already present from 005 for all three roles; repeated here so this
--    migration also works on a database where 005's line was edited away.
--    Granting an existing privilege is a no-op, so this stays idempotent.
-- -----------------------------------------------------------------------------

grant usage on schema public to service_role;

-- -----------------------------------------------------------------------------
-- 2. The nine public tables.
--
--    List taken from the migrations, not from memory:
--      001: categories, sub_categories, customers, products,
--           orders, order_items, announcements, team_members, settings
--      003: adds a column to categories (no new table)
--      004: adds a column to products   (no new table)
--
--    There is no separate product-images / gallery table: the gallery lives in
--    the `products.images text[]` column, and the files live in Storage
--    (granted separately in 002 and 007).
--
--    service_role still sits behind every RLS policy it does not bypass and
--    behind `requireAdmin()` in the app — this grant only removes the
--    statement-level denial. It adds no privilege for anon or authenticated.
-- -----------------------------------------------------------------------------

grant select, insert, update, delete on public.categories     to service_role;
grant select, insert, update, delete on public.sub_categories to service_role;
grant select, insert, update, delete on public.products       to service_role;
grant select, insert, update, delete on public.orders         to service_role;
grant select, insert, update, delete on public.order_items    to service_role;
grant select, insert, update, delete on public.customers      to service_role;
grant select, insert, update, delete on public.announcements  to service_role;
grant select, insert, update, delete on public.team_members   to service_role;
grant select, insert, update, delete on public.settings       to service_role;

-- -----------------------------------------------------------------------------
-- 3. The order-number sequence (006).
--
--    `public.generate_order_number()` is SECURITY DEFINER, so its owner already
--    reaches the sequence when the function runs. The explicit grant is here so
--    the privilege does not depend on which role happened to create the
--    sequence, and so any future direct `nextval` by the service role works too.
--    USAGE is the permission that actually gates nextval; SELECT reads current
--    value. Re-running is a no-op.
-- -----------------------------------------------------------------------------

grant usage, select on sequence public.order_number_seq to service_role;

commit;
