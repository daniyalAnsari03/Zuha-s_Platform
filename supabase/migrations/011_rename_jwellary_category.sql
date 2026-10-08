-- =============================================================================
-- Zuha - 011: fix the "Jwellary" category spelling
-- Run this file in the Supabase SQL Editor AFTER 010_store_details.sql.
-- Every statement is idempotent, so it is safe to run more than once.
--
-- WHY: the fifth top-level category was created as "Jwellary" (slug
-- `jwellary`). The footer's Shop column, the hamburger menu, the breadcrumbs
-- and the homepage slider all read category names from the `categories` table,
-- so the misspelling showed up on every surface and could not be fixed in the
-- code -- the data is the source of truth and it stays dynamic.
--
-- This renames the row to "Jewellery" (slug `jewellery`). Nothing is hardcoded
-- anywhere: every link is built from the row itself, so they all follow the new
-- slug on the next render. Only an old bookmarked /category/jwellary URL would
-- break; add a redirect only if that actually matters.
--
-- The `not exists` guard makes the slug move a no-op on a store that already
-- has a `jewellery` row, so the unique constraint can never fail here.
-- =============================================================================

begin;

update public.categories
set name = 'Jewellery',
    slug = 'jewellery',
    updated_at = now()
where (slug = 'jwellary' or lower(name) = 'jwellary')
  and not exists (
    select 1
    from public.categories existing
    where existing.slug = 'jewellery'
      and existing.id <> public.categories.id
  );

commit;
