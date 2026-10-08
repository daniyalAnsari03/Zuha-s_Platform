-- =============================================================================
-- Zuha — 002: storage buckets
-- Run this file in the Supabase SQL Editor AFTER 001_init_schema.sql.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images',  'product-images',  true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']),
  ('team-images',     'team-images',     true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']),
  ('category-images', 'category-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read: anyone can fetch an image by its public URL
create policy "product images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "team images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'team-images');

create policy "category images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'category-images');

-- Writes are admin-only. Uploading goes through the service role key on the
-- server (or a signed upload), never straight from the browser with the anon key.
create policy "admins can upload product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "admins can update product images"
  on storage.objects for update
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "admins can delete product images"
  on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());

create policy "admins can upload team images"
  on storage.objects for insert
  with check (bucket_id = 'team-images' and public.is_admin());

create policy "admins can update team images"
  on storage.objects for update
  using (bucket_id = 'team-images' and public.is_admin())
  with check (bucket_id = 'team-images' and public.is_admin());

create policy "admins can delete team images"
  on storage.objects for delete
  using (bucket_id = 'team-images' and public.is_admin());

create policy "admins can upload category images"
  on storage.objects for insert
  with check (bucket_id = 'category-images' and public.is_admin());

create policy "admins can update category images"
  on storage.objects for update
  using (bucket_id = 'category-images' and public.is_admin())
  with check (bucket_id = 'category-images' and public.is_admin());

create policy "admins can delete category images"
  on storage.objects for delete
  using (bucket_id = 'category-images' and public.is_admin());
