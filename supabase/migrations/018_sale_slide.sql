-- =============================================================================
-- Zuha - 018: homepage Sale slide images
-- Run in the Supabase SQL Editor after 017_product_image_color.sql.
-- =============================================================================

-- These nullable URLs live on the existing public store_details row. The
-- existing public-read / service-role-write grants and RLS policies apply.
alter table public.store_details
  add column if not exists sale_image_url text,
  add column if not exists sale_mobile_image_url text;

comment on column public.store_details.sale_image_url is
  'Desktop image for the optional homepage Sale slide.';

comment on column public.store_details.sale_mobile_image_url is
  'Optional mobile image for the homepage Sale slide; falls back to sale_image_url.';
