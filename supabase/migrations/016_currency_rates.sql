-- =============================================================================
-- Zuha — 016: multi-currency conversion rates
-- Storefront currency switcher (PKR / USD / EUR / GBP / AED / CAD).
--
-- Run this file in the Supabase SQL Editor AFTER 015_usd_rate.sql.
-- Every statement is idempotent, so it is safe to run more than once.
--
-- WHY: the storefront can show prices in more than one currency as a
-- display-only convenience. All stored data stays in PKR (products, cart,
-- orders, analytics); every foreign currency is only a live conversion of the
-- PKR amount. The admin sets "1 <CUR> = X PKR" per currency on the Settings
-- screen. PKR itself needs no rate — it is the base and is always available.
--
-- The values live on the existing single-row `public.store_details` table, so
-- they inherit that table's public-read / service-role-write model exactly:
-- `anon` / `authenticated` may SELECT them (the switcher needs the rates for an
-- anonymous visitor) and only `service_role` may write them. No new table, so
-- no new grants or RLS policies are needed — the existing table-level grants
-- cover the new columns, and 010's RLS stays untouched.
--
-- NULL means "no rate yet": the storefront hides that currency from the
-- switcher until the admin sets one. The same 1-column-per-currency model
-- 015 established for `usd_rate`; the check constraints mirror the admin form's
-- "empty or a number greater than zero" rule.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. The four new columns, each nullable on purpose.
--
--    `numeric(12,2)` holds at most two decimals. The positive rule is enforced
--    both here (check) and by the admin form / server action
--    (`readOptionalCurrencyRate` in src/lib/admin/validation.ts).
-- -----------------------------------------------------------------------------

alter table public.store_details
  add column if not exists eur_rate numeric(12,2);

alter table public.store_details
  add column if not exists gbp_rate numeric(12,2);

alter table public.store_details
  add column if not exists aed_rate numeric(12,2);

alter table public.store_details
  add column if not exists cad_rate numeric(12,2);

comment on column public.store_details.eur_rate is
  '1 EUR = X PKR. NULL (the default) hides EUR on the storefront. Base currency of all stored data stays PKR; EUR is display-only.';

comment on column public.store_details.gbp_rate is
  '1 GBP = X PKR. NULL (the default) hides GBP on the storefront. Base currency of all stored data stays PKR; GBP is display-only.';

comment on column public.store_details.aed_rate is
  '1 AED = X PKR. NULL (the default) hides AED on the storefront. Base currency of all stored data stays PKR; AED is display-only.';

comment on column public.store_details.cad_rate is
  '1 CAD = X PKR. NULL (the default) hides CAD on the storefront. Base currency of all stored data stays PKR; CAD is display-only.';

-- -----------------------------------------------------------------------------
-- 2. The check constraints, added idempotently.
--
--    Each column is allowed to be NULL (no rate) or a positive number. The
--    constraint name is derived from the column so re-running is a no-op.
-- -----------------------------------------------------------------------------

do $$
declare
  col text;
begin
  foreach col in array array['eur_rate', 'gbp_rate', 'aed_rate', 'cad_rate']
  loop
    if not exists (
      select 1
      from pg_constraint
      where conname = format('store_details_%s_positive', col)
        and conrelid = 'public.store_details'::regclass
    ) then
      execute format(
        'alter table public.store_details add constraint %I check (%I is null or %I > 0)',
        format('store_details_%s_positive', col), col, col
      );
    end if;
  end loop;
end $$;

commit;
