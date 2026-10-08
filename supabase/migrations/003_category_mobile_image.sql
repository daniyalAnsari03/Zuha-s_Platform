-- =============================================================================
-- Zuha - 003: category mobile image
-- Run this file in the Supabase SQL Editor AFTER 001_init_schema.sql.
-- =============================================================================

-- Top-level categories carry two slide images: `image_url` (desktop, already in
-- 001) and this optional mobile-only one. Nothing is dropped or renamed.
alter table public.categories
  add column if not exists mobile_image_url text;

comment on column public.categories.image_url is
  'Desktop slide image for a top-level category, shown on tablet and desktop.';

comment on column public.categories.mobile_image_url is
  'Optional mobile slide image for a top-level category, shown below the tablet breakpoint. Falls back to image_url when null.';

-- Sub-categories keep a single `image_url` and are unaffected.