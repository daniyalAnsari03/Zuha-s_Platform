-- =============================================================================
-- Zuha - 021: configurable flat delivery charge and order snapshot
-- Run this file in the Supabase SQL Editor AFTER 020_transactional_stock.sql.
-- =============================================================================

begin;

alter table public.store_details
  add column delivery_charge numeric(12, 2) not null default 0
    check (delivery_charge >= 0 and delivery_charge <= 100000),
  add column show_delivery boolean not null default false;

comment on column public.store_details.delivery_charge is
  'Flat PKR delivery charge used when show_delivery is enabled.';
comment on column public.store_details.show_delivery is
  'Whether checkout shows and charges the flat delivery fee.';

alter table public.orders
  add column show_delivery boolean not null default false;

comment on column public.orders.show_delivery is
  'Whether the delivery line was enabled when this order was placed.';

drop function public.create_order_with_stock(
  text, uuid, uuid, text, text, text, text, text, text, text, numeric, numeric, text, jsonb
);

create function public.create_order_with_stock(
  p_order_number text,
  p_customer_id uuid,
  p_user_id uuid,
  p_confirmation_token text,
  p_customer_email text,
  p_customer_name text,
  p_customer_phone text,
  p_shipping_address text,
  p_shipping_city text,
  p_shipping_method text,
  p_subtotal numeric,
  p_total numeric,
  p_payment_method text,
  p_order_items jsonb,
  p_shipping_fee numeric,
  p_show_delivery boolean
)
returns uuid
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order_id uuid;
  v_product record;
begin
  if p_order_items is null or jsonb_typeof(p_order_items) <> 'array' then
    raise exception using message = 'INVALID_ORDER_ITEMS';
  end if;

  if jsonb_array_length(p_order_items) = 0 then
    raise exception using message = 'INVALID_ORDER_ITEMS';
  end if;

  if exists (
    select 1
    from (
      select (entry.value ->> 'product_id')::uuid as product_id
      from jsonb_array_elements(p_order_items) as entry(value)
      group by (entry.value ->> 'product_id')::uuid
    ) as requested
    left join public.products as product on product.id = requested.product_id
    where product.id is null
  ) then
    raise exception using message = 'STOCK_PRODUCT_UNAVAILABLE';
  end if;

  -- The RPC caller also computes this total; derive it here from the trusted
  -- server-supplied subtotal and delivery snapshot before inserting the order.
  p_total := p_subtotal + p_shipping_fee;

  -- Acquire every product lock in a stable order before changing any stock.
  for v_product in
    select
      product.id,
      product.name,
      coalesce(product.stock_quantity, 0) as available,
      requested.quantity
    from public.products as product
    join (
      select
        (entry.value ->> 'product_id')::uuid as product_id,
        sum((entry.value ->> 'quantity')::integer)::integer as quantity
      from jsonb_array_elements(p_order_items) as entry(value)
      group by (entry.value ->> 'product_id')::uuid
    ) as requested on requested.product_id = product.id
    order by product.id
    for update of product
  loop
    if v_product.available <= 0 then
      raise exception using
        message = 'STOCK_OUT:' || v_product.id::text;
    end if;

    if v_product.available < v_product.quantity then
      raise exception using
        message = 'STOCK_SHORT:' || v_product.id::text || ':' || v_product.available::text;
    end if;
  end loop;

  update public.products as product
  set stock_quantity = coalesce(product.stock_quantity, 0) - requested.quantity
  from (
    select
      (entry.value ->> 'product_id')::uuid as product_id,
      sum((entry.value ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_order_items) as entry(value)
    group by (entry.value ->> 'product_id')::uuid
  ) as requested
  where product.id = requested.product_id;

  insert into public.orders (
    order_number,
    customer_id,
    user_id,
    guest_token,
    confirmation_token,
    status,
    stock_deducted,
    show_delivery,
    customer_email,
    customer_name,
    customer_phone,
    shipping_address,
    shipping_city,
    shipping_state,
    shipping_postal_code,
    shipping_country,
    shipping_method,
    subtotal,
    shipping_fee,
    discount,
    total,
    payment_method,
    payment_reference,
    is_paid,
    notes,
    admin_notes
  )
  values (
    p_order_number,
    p_customer_id,
    p_user_id,
    null,
    p_confirmation_token,
    'Order Placed',
    true,
    p_show_delivery,
    p_customer_email,
    p_customer_name,
    p_customer_phone,
    p_shipping_address,
    p_shipping_city,
    null,
    null,
    null,
    p_shipping_method,
    p_subtotal,
    p_shipping_fee,
    0,
    p_total,
    p_payment_method,
    null,
    false,
    null,
    null
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id,
    product_id,
    product_name,
    product_slug,
    sku,
    variant,
    color,
    unit_price,
    quantity,
    line_total
  )
  select
    v_order_id,
    item.product_id,
    item.product_name,
    item.product_slug,
    item.sku,
    item.variant,
    item.color,
    item.unit_price,
    item.quantity,
    item.line_total
  from jsonb_to_recordset(p_order_items) as item(
    product_id uuid,
    product_name text,
    product_slug text,
    sku text,
    variant text,
    color text,
    unit_price numeric,
    quantity integer,
    line_total numeric
  );

  return v_order_id;
end;
$$;

revoke all on function public.create_order_with_stock(
  text, uuid, uuid, text, text, text, text, text, text, text, numeric, numeric, text, jsonb, numeric, boolean
) from public, anon, authenticated;
grant execute on function public.create_order_with_stock(
  text, uuid, uuid, text, text, text, text, text, text, text, numeric, numeric, text, jsonb, numeric, boolean
) to service_role;

commit;
