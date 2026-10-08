-- =============================================================================
-- Zuha — 012: order confirmation token
-- Run this file in the Supabase SQL Editor AFTER 011_rename_jwellary_category.sql.
-- Every statement is idempotent, so it is safe to run more than once.
--
-- WHY: the confirmation page is reachable by order number alone, and order
-- numbers are short and sequential ("ZH-100001"), so anyone could guess one and
-- read the page behind it. This migration adds a per-order secret that the
-- server generates when the order is placed. The confirmation page now requires
-- both the number and the token, so guessing a number is no longer enough.
--
-- The column is nullable on purpose: orders placed before this migration have no
-- token and must keep working for the signed-in "My Orders" area, which matches
-- on `user_id` and never uses the token. A null token simply never matches, so
-- such an order is not reachable through the confirmation link.
--
-- The service-role table grant from 008 (select, insert, update, delete on
-- public.orders) applies to the whole row, so the new column is covered by it
-- automatically. The grant is re-asserted below anyway, so this migration also
-- stands on a database where 008's line was ever edited away — and re-granting
-- an existing privilege is a no-op. Grants and RLS for anon / authenticated are
-- left exactly as 005 / 006 set them: this migration changes no policy.
-- =============================================================================

begin;

alter table public.orders
  add column if not exists confirmation_token text;

comment on column public.orders.confirmation_token is
  'Random, URL-safe secret minted by the server when the order is placed. The confirmation page requires this token in addition to the order number. NULL for orders placed before migration 012; such orders are reachable only through the signed-in account area.';

grant select, insert, update, delete on public.orders to service_role;

commit;
