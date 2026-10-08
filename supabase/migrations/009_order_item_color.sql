-- =============================================================================
-- Zuha - 009: order_items colour snapshot
-- Run this file in the Supabase SQL Editor AFTER 008_service_role_table_grants.sql.
-- Every statement is idempotent, so it is safe to run more than once.
--
-- WHY: checkout carries the shopper's chosen colour (the free-text `colors`
-- field the admin typed on the product) all the way through: cart line, cart
-- popup, checkout summary and the order line sent to `placeOrder`. For the saved
-- order to record it, `order_items` needs its own column. It is nullable, so
-- orders placed before this migration keep working, and a product with no
-- colours simply stores NULL -- exactly how `variant` already behaves for
-- products without sizes.
--
-- The service-role table grant from 008 (select, insert, update, delete on
-- public.order_items) applies to the whole row, so a new column is covered by
-- it automatically. The grant is re-asserted below anyway, so this migration
-- also stands on a database where 008's line was ever edited away -- and
-- re-granting an existing privilege is a no-op. anon / authenticated are not
-- touched: their orders INSERT is already revoked in 006.
-- =============================================================================

begin;

alter table public.order_items
  add column if not exists color text;

comment on column public.order_items.color is
  'The colour chosen at checkout, free text exactly as the admin typed it on the product. NULL when the product had no colours.';

grant select, insert, update, delete on public.order_items to service_role;

commit;