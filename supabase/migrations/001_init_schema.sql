-- =============================================================================
-- Zuha — 001: initial schema
-- Run this file in the Supabase SQL Editor (Database > SQL Editor > New query).
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.order_status as enum (
  'Order Placed',
  'Order Confirmed',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled'
);

-- ---------------------------------------------------------------------------
-- Updated timestamp helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.categories is 'Top-level product categories.';

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Sub-categories
-- ---------------------------------------------------------------------------

create table public.sub_categories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sub_categories is 'Second-level product categories.';

create index sub_categories_category_id_idx on public.sub_categories (category_id);

create trigger sub_categories_set_updated_at
  before update on public.sub_categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  email text not null,
  full_name text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text,
  is_guest boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.customers is 'One row per shopper. Guest checkout rows have user_id = null.';

create index customers_user_id_idx on public.customers (user_id);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories (id) on delete set null,
  sub_category_id uuid references public.sub_categories (id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  -- Prices are stored as plain numeric amounts (e.g. 1499.00)
  price numeric(12, 2) not null check (price >= 0),
  discount_price numeric(12, 2) check (discount_price is null or discount_price >= 0),
  -- Free-text list of sizes, e.g. 'S, M, L, XL' or 'One Size'
  sizes text,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  images text[] not null default '{}',
  is_active boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_discount_below_price check (
    discount_price is null or discount_price < price
  )
);

comment on table public.products is 'Sellable products. Sizes are free text (comma separated).';
comment on column public.products.images is 'Array of public/storage or external image URLs.';

create index products_category_id_idx on public.products (category_id);
create index products_sub_category_id_idx on public.products (sub_category_id);
create index products_is_active_idx on public.products (is_active);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references public.customers (id) on delete set null,
  -- Authenticated shopper; null for guest checkout
  user_id uuid references auth.users (id) on delete set null,
  -- Guest checkout token, returned to the guest to view their order
  guest_token text,
  status public.order_status not null default 'Order Placed',
  -- Contact + shipping snapshot (kept even if the customer record changes)
  customer_email text not null,
  customer_name text,
  customer_phone text,
  shipping_address text,
  shipping_city text,
  shipping_state text,
  shipping_postal_code text,
  shipping_country text,
  shipping_method text,
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  shipping_fee numeric(12, 2) not null default 0 check (shipping_fee >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),
  payment_method text,
  payment_reference text,
  is_paid boolean not null default false,
  notes text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.orders is 'Customer orders. guest_token is used for guest order tracking.';

create index orders_customer_id_idx on public.orders (customer_id);
create index orders_user_id_idx on public.orders (user_id);
create index orders_status_idx on public.orders (status);
create index orders_created_at_idx on public.orders (created_at desc);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Order items
-- ---------------------------------------------------------------------------

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  -- Product is kept on delete so order history stays intact
  product_id uuid references public.products (id) on delete set null,
  -- Snapshot of the product at purchase time
  product_name text not null,
  product_slug text,
  variant text,
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12, 2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

comment on table public.order_items is 'Line items of an order, snapshotted at purchase time.';

create index order_items_order_id_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  link_url text,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.announcements is 'Site-wide banners and notices.';

create index announcements_is_active_idx on public.announcements (is_active);

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Team members
-- ---------------------------------------------------------------------------

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  bio text,
  image_url text,
  email text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.team_members is 'People shown on the About / Team section.';

create index team_members_is_active_idx on public.team_members (is_active);

create trigger team_members_set_updated_at
  before update on public.team_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Settings (key/value, value is jsonb)
-- ---------------------------------------------------------------------------

create table public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_at timestamptz not null default now()
);

comment on table public.settings is 'Global store settings. Key "admin_emails" is an array of admin emails.';

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helper functions that read tables.
--
-- These MUST come after every table they reference: Postgres parses the body of
-- a sql-language function when it is created, so a reference to a table that
-- does not exist yet fails with 42P01. RLS policies below also call these, so
-- they must be defined before the policies.
-- ---------------------------------------------------------------------------

-- is_admin(): true for users whose email matches the admin allowlist.
-- settings.value is jsonb (a JSON array of emails), so use jsonb containment
-- instead of `= any (...)`, which requires a real Postgres array. Emails are
-- compared lowercase on both sides. The '?' operator is avoided because SQL
-- clients turn it into a bind parameter.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.settings s
    where s.key = 'admin_emails'
      and s.value @> to_jsonb(lower(auth.jwt() ->> 'email'))
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.sub_categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.customers enable row level security;
alter table public.announcements enable row level security;
alter table public.team_members enable row level security;
alter table public.settings enable row level security;

-- Public catalog: anyone (including anon visitors) can read
create policy "categories are publicly readable"
  on public.categories for select
  using (true);

create policy "sub_categories are publicly readable"
  on public.sub_categories for select
  using (true);

create policy "products are publicly readable"
  on public.products for select
  using (true);

create policy "announcements are publicly readable"
  on public.announcements for select
  using (true);

create policy "team_members are publicly readable"
  on public.team_members for select
  using (true);

-- Customers: a signed-in user reads only their own row.
create policy "users can read own customer"
  on public.customers for select
  using (auth.uid() = user_id);

-- Guest checkout: the shopper is not signed in yet, so allow creating a
-- customer row from their own submitted email. Updates still require login
-- or an admin, so nobody can edit someone else's profile.
create policy "anyone can create own guest customer"
  on public.customers for insert
  with check (auth.uid() is null or auth.uid() = user_id);

create policy "users can update own customer"
  on public.customers for update
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

create policy "users can delete own customer"
  on public.customers for delete
  using (auth.uid() = user_id or public.is_admin());

-- Orders: signed-in users see only their own orders.
create policy "users can read own orders"
  on public.orders for select
  using (auth.uid() = user_id or public.is_admin());

-- Guest checkout: the order is placed before sign-in, so inserts are allowed
-- for everyone. Reads still require the matching user or guest_token, which is
-- checked server-side with the service role key (never from the browser).
create policy "anyone can place an order"
  on public.orders for insert
  with check (true);

create policy "users can update own orders"
  on public.orders for update
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

create policy "admins can delete orders"
  on public.orders for delete
  using (public.is_admin());

-- Order items: visible to the order owner (or admin), and insertable as part of
-- placing an order.
create policy "users can read own order items"
  on public.order_items for select
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
        and (o.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "anyone can create order items for a new order"
  on public.order_items for insert
  with check (
    exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
        and (o.user_id is null or o.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "admins can update order items"
  on public.order_items for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins can delete order items"
  on public.order_items for delete
  using (public.is_admin());

-- Settings: public read is limited to non-sensitive keys. Admins manage them.
create policy "admins can read settings"
  on public.settings for select
  using (public.is_admin());

create policy "admins can insert settings"
  on public.settings for insert
  with check (public.is_admin());

create policy "admins can update settings"
  on public.settings for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins can delete settings"
  on public.settings for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Management writes: admin-only for catalog and content tables
-- ---------------------------------------------------------------------------

create policy "admins can manage categories"
  on public.categories for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins can manage sub_categories"
  on public.sub_categories for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins can manage products"
  on public.products for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins can manage announcements"
  on public.announcements for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins can manage team members"
  on public.team_members for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- is_admin() is SECURITY DEFINER on purpose: RLS policies need to evaluate it
-- as anon/authenticated, and it only ever reveals a single boolean.
-- Do NOT revoke execute from anon/authenticated — that breaks every policy above.
-- ---------------------------------------------------------------------------

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Seed data (last: runs against the fully created schema, with RLS in place)
-- ---------------------------------------------------------------------------

-- Seed the admin allowlist. Your own email is set below.
insert into public.settings (key, value, description)
values (
  'admin_emails',
  '["dinsbydaniyal@gmail.com"]'::jsonb,
  'Emails allowed to perform management (admin) writes.'
)
on conflict (key) do nothing;
