-- =============================================================================
-- Zuha — 014: store policies
-- Run this file in the Supabase SQL Editor AFTER 013_contact_messages.sql.
-- Every statement is idempotent, so it is safe to run more than once.
--
-- WHY: the storefront gains four policy pages (/policies/[slug]: Privacy Policy,
-- Refund Policy, Terms of Service, Shipping Policy). Their text is edited by the
-- admin from the dashboard's Settings screen, so it has to live in the database
-- rather than in code.
--
-- ACCESS: a policy page is public content, so `anon` and `authenticated` may
-- SELECT it — and only select. There is deliberately no insert / update / delete
-- policy for the browser roles: the only writer is service_role, which the
-- dashboard reaches behind `requireAdmin()` (see 008).
--
-- service_role gets select / insert / update / delete in step 4, which is the
-- AGENTS.md rule for every new public table: RLS bypass does not bypass GRANT.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. The table.
--
--    `slug` is the primary key: the four routes are fixed and named here, so a
--    policy is identified by its URL rather than by a surrogate id.
-- -----------------------------------------------------------------------------

create table if not exists public.store_policies (
  slug       text primary key,
  title      text not null,
  content    text not null default '',
  updated_at timestamptz not null default now()
);

comment on table public.store_policies is
  'Public store policy pages (migration 014). Read by the storefront, written by the dashboard Settings screen through the service role.';

-- Dropped first so this file is genuinely re-runnable (CREATE TRIGGER alone
-- would fail the second time).
drop trigger if exists store_policies_set_updated_at on public.store_policies;

create trigger store_policies_set_updated_at
  before update on public.store_policies
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Row Level Security: public read, no browser writes.
--
--    RLS denies everything without a policy, so there is deliberately no
--    insert / update / delete policy for anon or authenticated here.
-- -----------------------------------------------------------------------------

alter table public.store_policies enable row level security;

drop policy if exists "store policies are publicly readable" on public.store_policies;

create policy "store policies are publicly readable"
  on public.store_policies for select
  using (true);

-- -----------------------------------------------------------------------------
-- 3. Grants.
--
--    Supabase's "automatically expose new tables to new roles" default is OFF
--    (see 008), so both sides are stated explicitly: SELECT for the browser
--    roles — and only select — and the full set for service_role.
-- -----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

revoke all on table public.store_policies from anon, authenticated;
grant select on public.store_policies to anon, authenticated;

grant select, insert, update, delete on public.store_policies to service_role;

-- -----------------------------------------------------------------------------
-- 4. Seed the four pages, so every route has a row and the storefront always
--    has a title to show. Content starts empty ("This page has not been updated
--    yet." on the storefront) until the admin writes it.
-- -----------------------------------------------------------------------------

insert into public.store_policies (slug, title)
values
  ('privacy-policy',  'Privacy Policy'),
  ('refund-policy',   'Refund Policy'),
  ('terms-of-service', 'Terms of Service'),
  ('shipping-policy', 'Shipping Policy')
on conflict (slug) do nothing;

commit;
