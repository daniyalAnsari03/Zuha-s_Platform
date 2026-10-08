-- =============================================================================
-- Zuha — 006: Checkout policies and service-role-only order creation
-- Phase 7 (Checkout, Orders & Account).
--
-- Run this file in the Supabase SQL Editor (Database > SQL Editor > New query).
-- Every statement is idempotent, so it is safe to run more than once.
--
-- WHY: orders are created ONLY on the server, from the Next.js server action in
-- `src/lib/orders.ts`, using the service-role key. The browser never writes to
-- `orders`, `order_items` or `customers`, and it never sends a price: the server
-- re-reads each product and calculates the total itself. This migration takes
-- away the Phase 1 policies that let any visitor insert or edit those rows, and
-- leaves the service role as the only writer.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Drop the client-side write policies created in 001.
-- -----------------------------------------------------------------------------

drop policy if exists "anyone can place an order" on public.orders;
drop policy if exists "users can update own orders" on public.orders;
drop policy if exists "anyone can create order items for a new order" on public.order_items;
drop policy if exists "anyone can create own guest customer" on public.customers;

-- -----------------------------------------------------------------------------
-- 2. Order status and order detail edits are admin-only from here on.
--    The customer can still READ their own orders (the "users can read own
--    orders" select policy from 001 is left untouched), but no longer updates
--    them, and an admin does so with the service role through the dashboard.
-- -----------------------------------------------------------------------------

drop policy if exists "admins can update orders" on public.orders;

create policy "admins can update orders"
  on public.orders for update
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- 3. Write access to the checkout tables belongs to service_role alone.
--    `revoke` first so re-running this can never leave an earlier `grant` behind,
--    and so the intent survives if these privileges were ever widened by hand.
-- -----------------------------------------------------------------------------

revoke insert, update, delete on table public.orders      from anon, authenticated;
revoke insert, update, delete on table public.order_items from anon, authenticated;
revoke insert, update, delete on table public.customers   from anon, authenticated;

grant insert, update on table public.orders      to service_role;
grant insert, update on table public.order_items to service_role;
grant insert, update on table public.customers   to service_role;

-- `delete` is granted to service_role only because the server action needs it to
-- undo its own work: if the order row goes in but its items fail, the action
-- removes the empty order so the dashboard never shows a paid-for order with
-- nothing in it. Nothing in the browser can reach this, and no dashboard screen
-- deletes an order -- cancelling is a status, not a deletion.
grant delete on table public.orders to service_role;

-- -----------------------------------------------------------------------------
-- 4. Order numbers.
--
-- `orders.order_number` is `not null unique`, but nothing generated a value, so
-- the server had to invent one. A sequence behind a function gives two things
-- that a random string does not: values that are obviously sequential to a human
-- reading an email ("ZH-100004") and a hard uniqueness guarantee, because
-- `nextval` never repeats even under concurrent inserts. The unique constraint
-- stays as a backstop.
--
-- `create sequence if not exists` keeps whatever value the sequence has already
-- reached, so running this twice cannot hand out a number that was issued before.
-- -----------------------------------------------------------------------------

create sequence if not exists public.order_number_seq start with 100000;

create or replace function public.generate_order_number()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  next_value bigint;
begin
  select nextval('public.order_number_seq') into next_value;
  return 'ZH-' || lpad(next_value::text, 6, '0');
end;
$fn$;

comment on function public.generate_order_number() is
  'Returns the next unique order number, e.g. ZH-100001. Service role only.';

-- Callable by the server action and nothing else: an anon key that could call
-- this could burn through the sequence at will.
-- Supabase grants execute on new functions to anon and authenticated by default,
-- so they are revoked explicitly (revoking from PUBLIC alone does not remove them).
revoke all on function public.generate_order_number() from public;
revoke execute on function public.generate_order_number() from anon, authenticated;
grant execute on function public.generate_order_number() to service_role;

-- -----------------------------------------------------------------------------
-- 5. Signed-up shoppers get their `customers` row on the server.
--
-- 001 already models this: `customers.user_id` is unique and nullable, the
-- comment says guest rows carry `user_id = null`, and `public.is_admin()` plus
-- the "users can update own customer" policy already read that row. Nothing to
-- add — the server action upserts the row on checkout with the service role, so
-- the "anyone can create own guest customer" insert policy dropped in step 1 is
-- no longer needed.
-- -----------------------------------------------------------------------------

commit;