-- =============================================================================
-- Zuha — 007: admin image storage
-- Phase 9B (Categories, Products, Inventory + the image upload mechanism).
--
-- Run this file in the Supabase SQL Editor AFTER 006_checkout_policies.sql.
-- Every statement is idempotent, so it is safe to run more than once.
--
-- WHY: the dashboard never sends an image through a server action. Next.js caps a
-- server action body well below a 5 MB photo, so `requestImageUpload` (a server
-- action in `src/lib/admin/uploads.ts`) signs a short-lived upload URL with the
-- service role and the browser PUTs the file straight to Storage. The bucket is
-- therefore the only thing that has to exist here — no table changes, and no
-- privileges for the browser: every write arrives on a signed URL that the server
-- issued after `requireAdmin()`.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. One public bucket for everything the dashboard uploads.
--
-- "Folders" are path prefixes inside the bucket, not separate buckets:
--   categories/<uuid>.jpg   category desktop/mobile images + sub-category images
--   products/<uuid>.jpg     product gallery images
-- A single bucket keeps one set of read policies and one place to look.
--
-- The limits are enforced here as well as in the upload action, so a file that
-- somehow bypasses the browser check is still rejected by the bucket.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-images',
  'store-images',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- store-images: public-read bucket for dashboard uploads (5 MB, jpeg/png/webp).
-- Written only through server-issued signed upload URLs; the dashboard stores
-- these public URLs on categories and products.

-- -----------------------------------------------------------------------------
-- 2. Public read.
--
-- The storefront serves these URLs directly (homepage slides, product galleries),
-- so they have to be readable without a session. This is the only policy the
-- bucket gets.
-- -----------------------------------------------------------------------------

drop policy if exists "store images are publicly readable" on storage.objects;

create policy "store images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'store-images');

-- -----------------------------------------------------------------------------
-- 3. No write access for anon or authenticated.
--
-- There is deliberately no insert / update / delete policy on this bucket for the
-- browser roles: RLS denies by default, and the only writer is `service_role`,
-- which bypasses RLS and is used exclusively by server code that has already
-- called `requireAdmin()`.

-- The dashboard also deletes files (an image removed from a form, or an item
-- deleted). Those deletes go through the service role too, so its privileges are
-- stated here rather than left to the platform's default grants.
grant usage on schema storage to service_role;
grant insert, update, delete on table storage.objects to service_role;

commit;
