-- =============================================================================
-- Zuha — 010: public store details
-- Phase 9C (Settings).
--
-- Run this file in the Supabase SQL Editor AFTER 009_order_item_color.sql.
-- Every statement is idempotent, so it is safe to run more than once.
--
-- WHY: the dashboard's Settings screen edits the store's public contact details
-- (name, email, phone, address and the four social links), and the footer and
-- the /contact page have to read them on the server for an anonymous visitor.
--
-- `public.settings` cannot be that table: its only RLS policy is
-- `public.is_admin()`, so a shopper's read returns nothing — which is exactly
-- what protects `settings.admin_emails`. This migration therefore adds a
-- separate single-row table that is readable by everyone and writable by
-- service_role alone. Nothing in it is secret, and `admin_emails` is never
-- copied into it.
--
-- Single row: the `check (id = 1)` constraint is what makes "the store's
-- details" one row rather than a table that can quietly grow a second one.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. The table.
--
--    Every column is `not null default ''` rather than nullable: the storefront
--    treats an empty string as "not set yet" and falls back to
--    `src/lib/site-config.ts`, so empty and null never have to be told apart.
-- -----------------------------------------------------------------------------

create table if not exists public.store_details (
  id            integer primary key default 1,
  store_name    text not null default '',
  contact_email text not null default '',
  phone         text not null default '',
  address       text not null default '',
  instagram_url text not null default '',
  facebook_url  text not null default '',
  tiktok_url    text not null default '',
  whatsapp_url  text not null default '',
  updated_at    timestamptz not null default now(),
  constraint store_details_single_row check (id = 1)
);

comment on table public.store_details is
  'Public store contact details shown in the footer and on /contact. Single row (id = 1). Never holds admin_emails.';

create trigger store_details_set_updated_at
  before update on public.store_details
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Row Level Security: public read, no browser writes.
--
--    RLS denies everything without a policy, so there is deliberately no
--    insert / update / delete policy here for anon or authenticated. The only
--    writer is service_role (which bypasses RLS, and gets its GRANT in step 3).
-- -----------------------------------------------------------------------------

alter table public.store_details enable row level security;

drop policy if exists "store details are publicly readable" on public.store_details;

create policy "store details are publicly readable"
  on public.store_details for select
  using (true);

-- -----------------------------------------------------------------------------
-- 3. Grants.
--
--    Supabase's "automatically expose new tables to new roles" default is OFF
--    (see 008), so both sides are stated explicitly: SELECT for the browser
--    roles — and only select — and the full set for service_role.
-- -----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

revoke all on table public.store_details from anon, authenticated;
grant select on public.store_details to anon, authenticated;

grant select, insert, update, delete on public.store_details to service_role;

-- -----------------------------------------------------------------------------
-- 4. Seed the single row, so the dashboard's Settings screen opens with
--    something to edit and the storefront always has a row to read.
-- -----------------------------------------------------------------------------

insert into public.store_details (id)
values (1)
on conflict (id) do nothing;

commit;
