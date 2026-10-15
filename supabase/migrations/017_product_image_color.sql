-- =============================================================================
-- Zuha - 017: per-image colour tag
-- Run this file in the Supabase SQL Editor AFTER 016_currency_rates.sql.
-- =============================================================================

-- WHY: on mobile and tablet the product page / quick view shows one swipeable
-- slide at a time. Tagging an image with a colour lets a tap on the existing
-- "Color" options jump the slider straight to the first picture of that
-- colour. Desktop (1024px+) keeps its two-column grid, unchanged.
--
-- LEAST INVASIVE SHAPE: `products.images` is a text[] column (001), so the
-- tag rides alongside it in a second text[] of the same length:
--   image_colors[i] is the colour of images[i], '' meaning "no tag".
-- No new table, therefore no new grants: products already has
-- select/insert/update/delete for service_role (008) and select for
-- anon/authenticated (005). RLS is untouched, so catalog tables stay
-- anon-select only.
--
-- OLD PRODUCTS: the column starts NULL and no backfill is needed — a reader
-- that finds NULL simply treats every image as untagged, and the storefront
-- behaviour is exactly what it is today.

alter table public.products
  add column if not exists image_colors text[] default null;

comment on column public.products.image_colors is
  'Optional colour tag per gallery image, index-aligned with images; '' = no tag. NULL = none set.';
