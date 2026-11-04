-- =============================================================================
-- Zuha - 020: transactional stock deduction and order status restoration
-- Run this file in the Supabase SQL Editor AFTER 019_product_sku.sql.
-- =============================================================================

begin;

alter table public.orders
  add column if not exists stock_deducted boolean not null default false;

comment on column public.orders.stock_deducted is
  'Whether stock is currently deducted for this order. Existing orders remain false.';

create or replace function public.create_order_with_stock(
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
  p_order_items jsonb
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
    0,
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
  text, uuid, uuid, text, text, text, text, text, text, text, numeric, numeric, text, jsonb
) from public, anon, authenticated;
grant execute on function public.create_order_with_stock(
  text, uuid, uuid, text, text, text, text, text, text, text, numeric, numeric, text, jsonb
) to service_role;

create or replace function public.update_order_status_with_stock(
  p_order_id uuid,
  p_status public.order_status
)
returns table(order_number text, status public.order_status)
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_product record;
begin
  if p_status is null then
    raise exception using message = 'INVALID_ORDER_STATUS';
  end if;

  select existing_order.*
  into v_order
  from public.orders as existing_order
  where existing_order.id = p_order_id
  for update;

  if not found then
    raise exception using message = 'ORDER_NOT_FOUND';
  end if;

  if v_order.status = p_status then
    return query select v_order.order_number, v_order.status;
    return;
  end if;

  if p_status = 'Cancelled' then
    if v_order.stock_deducted then
      for v_item in
        select item.product_id, sum(item.quantity)::integer as quantity
        from public.order_items as item
        where item.order_id = v_order.id
          and item.product_id is not null
        group by item.product_id
        order by item.product_id
      loop
        perform 1
        from public.products as product
        where product.id = v_item.product_id
        for update;

        if found then
          update public.products as product
          set stock_quantity = coalesce(product.stock_quantity, 0) + v_item.quantity
          where product.id = v_item.product_id;
        end if;
      end loop;

      update public.orders as existing_order
      set status = p_status, stock_deducted = false
      where existing_order.id = v_order.id;
    else
      update public.orders as existing_order
      set status = p_status
      where existing_order.id = v_order.id;
    end if;
  elsif v_order.status = 'Cancelled' and not v_order.stock_deducted then
    for v_item in
      select item.product_id, sum(item.quantity)::integer as quantity
      from public.order_items as item
      where item.order_id = v_order.id
        and item.product_id is not null
      group by item.product_id
      order by item.product_id
    loop
      select
        product.id,
        product.name,
        coalesce(product.stock_quantity, 0) as available
      into v_product
      from public.products as product
      where product.id = v_item.product_id
      for update;

      if not found then
        continue;
      end if;

      if v_product.available < v_item.quantity then
        raise exception using
          message = 'STOCK_REACTIVATE:' || v_product.id::text;
      end if;

      update public.products as product
      set stock_quantity = coalesce(product.stock_quantity, 0) - v_item.quantity
      where product.id = v_item.product_id;
    end loop;

    update public.orders as existing_order
    set status = p_status, stock_deducted = true
    where existing_order.id = v_order.id;
  else
    update public.orders as existing_order
    set status = p_status
    where existing_order.id = v_order.id;
  end if;

  return query
  select updated_order.order_number, updated_order.status
  from public.orders as updated_order
  where updated_order.id = v_order.id;
end;
$$;

revoke all on function public.update_order_status_with_stock(
  uuid, public.order_status
) from public, anon, authenticated;
grant execute on function public.update_order_status_with_stock(
  uuid, public.order_status
) to service_role;

commit;
