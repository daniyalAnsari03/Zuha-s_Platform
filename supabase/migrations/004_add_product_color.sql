-- =============================================================================
-- Zuha - 004: product color
-- Run this file in the Supabase SQL Editor AFTER 001_init_schema.sql and
-- 003_category_mobile_image.sql.
-- =============================================================================

-- Phase 4 (product listing) filters products by color, the same way it filters
-- the existing free-text `sizes` column: the admin types a comma separated
-- list such as 'Black, Red' and the storefront splits it into unique options.
-- Nothing is dropped or renamed, and existing product rows default to NULL
-- (no colour), which the listing simply treats as "not filterable".
alter table public.products
  add column if not exists color text;

comment on column public.products.color is
  'Free-text list of colours, comma separated (e.g. ''Black, Red''). Split into unique filter options on the product listing page.';