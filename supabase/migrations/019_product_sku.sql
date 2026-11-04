-- =============================================================================
-- Zuha - 019: generated product SKUs and order-item snapshots
-- Run this file in the Supabase SQL Editor AFTER 018_sale_slide.sql.
-- =============================================================================

begin;

create sequence if not exists public.products_sku_seq;

create or replace function public.generate_product_sku()
returns text
language plpgsql
volatile
as $$
declare
  sku_number bigint;
begin
  sku_number := nextval('public.products_sku_seq');
  return 'ZUH-' || lpad(sku_number::text, greatest(3, length(sku_number::text)), '0');
end;
$$;

revoke all on function public.generate_product_sku() from public, anon, authenticated;
grant execute on function public.generate_product_sku() to service_role;

alter table public.products
  add column if not exists sku text;

with numbered_products as (
  select
    id,
    row_number() over (order by created_at asc, id asc) as sku_number
  from public.products
  where sku is null
)
update public.products as product
set sku = 'ZUH-' || lpad(numbered_products.sku_number::text, greatest(3, length(numbered_products.sku_number::text)), '0')
from numbered_products
where product.id = numbered_products.id;

select setval(
  'public.products_sku_seq',
  greatest(
    coalesce(
      (select max(substring(sku from 5)::bigint) + 1 from public.products),
      1
    ),
    (
      select last_value + case when is_called then 1 else 0 end
      from public.products_sku_seq
    )
  ),
  false
);

alter table public.products
  alter column sku set default public.generate_product_sku(),
  alter column sku set not null;

create unique index if not exists products_sku_key
  on public.products (sku);

comment on column public.products.sku is
  'Immutable, database-generated product identifier. Its sequence is never reset or reused.';

create or replace function public.prevent_product_sku_update()
returns trigger
language plpgsql
as $$
begin
  if new.sku is distinct from old.sku then
    raise exception 'Product SKUs cannot be changed.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists products_sku_immutable on public.products;
create trigger products_sku_immutable
  before update of sku on public.products
  for each row execute function public.prevent_product_sku_update();

revoke all on function public.prevent_product_sku_update() from public, anon, authenticated;

alter table public.order_items
  add column if not exists sku text;

update public.order_items as order_item
set sku = product.sku
from public.products as product
where order_item.product_id = product.id
  and order_item.sku is null;

comment on column public.order_items.sku is
  'Product SKU snapshotted when the order item was created; null for deleted products or pre-migration history.';

grant usage, select on sequence public.products_sku_seq to service_role;

commit;
