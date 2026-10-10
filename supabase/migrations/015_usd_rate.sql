-- =============================================================================
-- Zuha — 015: USD conversion rate
-- Storefront currency switcher (PKR / USD).
--
-- Run this file in the Supabase SQL Editor AFTER 014_store_policies.sql.
-- Every statement is idempotent, so it is safe to run more than once.
--
-- WHY: the storefront can show prices in USD as a display-only convenience.
-- All stored data stays in PKR (products, cart, orders, analytics); USD is only
-- ever a live conversion of the PKR amount. The admin sets "1 USD = X PKR" on
-- the Settings screen.
--
-- The value lives on the existing single-row `public.store_details` table, so
-- it inherits that table's public-read / service-role-write model exactly:
-- `anon` / `authenticated` may SELECT it (the switcher needs the rate for an
-- anonymous visitor) and only `service_role` may write it. No new table, so no
-- new grants or RLS policies are needed — the existing table-level grants cover
-- the new column, and 010's RLS stays untouched.
--
-- NULL means "no rate yet": the storefront hides the USD option entirely until
-- the admin sets one.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. The column.
--
--    Nullable on purpose: NULL is "not set", which is what hides USD. The
--    `numeric(12,2)` type enforces at most two decimals. The positive, <= 10000
--    rules are enforced by the admin form and the server action
--    (`readOptionalUsdRate` in src/lib/admin/validation.ts); this column only
--    has to be able to hold the value.
-- -----------------------------------------------------------------------------

alter table public.store_details
  add column if not exists usd_rate numeric(12,2);

comment on column public.store_details.usd_rate is
  '1 USD = X PKR. NULL (the default) hides the USD option on the storefront. Base currency of all stored data stays PKR; USD is display-only.';

commit;
