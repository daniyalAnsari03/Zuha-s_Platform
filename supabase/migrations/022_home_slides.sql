-- =============================================================================
-- Zuha — 022: home slides
-- Run this file in the Supabase SQL Editor AFTER 021_delivery_charge.sql.
-- Every statement is idempotent, so it is safe to run more than once.
--
-- WHY: the homepage slider gains informational slides the admin fills in —
-- full-bleed images with no text, no link and no click behaviour ("Sale Coming
-- Soon", "New Product Coming Soon", …). Each slide has a Desktop image, an
-- optional Mobile image (mobile falls back to desktop), a placement that puts
-- it before the Sale slide, between the Sale slide and the categories, or
-- after the categories (always before the footer), an Admin-controlled order
-- inside its placement group, and an Active on/off switch.
--
-- ACCESS: a home slide is public content, so `anon` and `authenticated` may
-- SELECT the active rows only. There is deliberately no insert / update /
-- delete policy for the browser roles: the only writer is service_role, which
-- the dashboard reaches behind `requireAdmin()` (see 008).
--
-- service_role gets select / insert / update / delete in step 3, which is the
-- AGENTS.md rule for every new public table: RLS bypass does not bypass GRANT.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. The table.
--
--    `placement` is one of three fixed values, and `sort_order` is ordered
--    INSIDE its placement group only (the dashboard's Move up / Move down
--    swaps it between two slides of the same group).
-- -----------------------------------------------------------------------------

create table if not exists public.home_slides (
  id uuid primary key default gen_random_uuid(),
  desktop_image_url text not null,
  mobile_image_url  text,
  placement text not null default 'first'
    check (placement in ('first', 'after_sale', 'after_categories')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.home_slides is
  'Non-clickable informational slides for the homepage category slider (migration 022). Read by the storefront, written by the dashboard Home Slides screen through the service role.';

comment on column public.home_slides.desktop_image_url is
  'Desktop image, shown on tablet and desktop screens. Required.';

comment on column public.home_slides.mobile_image_url is
  'Optional mobile image; mobile screens fall back to desktop_image_url when it is empty.';

comment on column public.home_slides.placement is
  'Where the slide sits: first (before the Sale slide), after_sale (between the Sale slide and the categories) or after_categories (after the categories, before the footer).';

comment on column public.home_slides.sort_order is
  'Order inside the placement group; smaller rises earlier.';

-- -----------------------------------------------------------------------------
-- 2. Row Level Security: public read of active rows, no browser writes.
--
--    RLS denies everything without a policy, so there is deliberately no
--    insert / update / delete policy for anon or authenticated here.
-- -----------------------------------------------------------------------------

alter table public.home_slides enable row level security;

drop policy if exists "active home slides are publicly readable" on public.home_slides;

create policy "active home slides are publicly readable"
  on public.home_slides for select
  to anon, authenticated
  using (is_active = true);

-- -----------------------------------------------------------------------------
-- 3. Grants.
--
--    Supabase's "automatically expose new tables to new roles" default is OFF
--    (see 008), so both sides are stated explicitly: SELECT only for the
--    browser roles, and the full set for service_role.
-- -----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

revoke all on table public.home_slides from anon, authenticated;
grant select on public.home_slides to anon, authenticated;

grant select, insert, update, delete on public.home_slides to service_role;

commit;
