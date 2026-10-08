-- =============================================================================
-- Zuha — 013: contact messages
-- Run this file in the Supabase SQL Editor AFTER 012_order_confirmation_token.sql.
-- Every statement is idempotent, so it is safe to run more than once.
--
-- WHY: /contact gains a message form, and the dashboard's new "Messages"
-- section is where those messages land.
--
-- ACCESS: a visitor's message is private correspondence, not public content, so
-- RLS is enabled with NO policy at all — anon and authenticated can neither
-- select nor insert a row. The form itself never touches the browser's key: the
-- `sendContactMessage` server action writes with the service-role key, and the
-- dashboard reads with the same key behind `requireAdmin()`. RLS alone would
-- already deny the browser roles (no policy = no rows), the explicit REVOKE in
-- step 3 states it at the GRANT gate as well, because the two are separate
-- checks (see 008).
--
-- service_role gets select / insert / update / delete in step 4, which is the
-- AGENTS.md rule for every new public table: RLS bypass does not bypass GRANT.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. The table.
-- -----------------------------------------------------------------------------

create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  phone      text,
  email      text not null,
  message    text not null,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.contact_messages is
  'Messages sent from the /contact form. Private: no RLS policy at all, written and read through the service role only.';

-- The Messages screen always lists newest first.
create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

-- The sidebar unread badge counts these.
create index if not exists contact_messages_unread_idx
  on public.contact_messages (created_at desc)
  where is_read = false;

-- -----------------------------------------------------------------------------
-- 2. Row Level Security: on, with deliberately no policy.
--
--    RLS denies everything without a policy, so this table is closed to the
--    browser roles entirely — they get no rows and can insert nothing.
-- -----------------------------------------------------------------------------

alter table public.contact_messages enable row level security;

-- -----------------------------------------------------------------------------
-- 3. Nothing for the browser roles.
--
--    Repeated for clarity and idempotence: it is a no-op if they were never
--    granted anything, and removes the privilege if a later grant ever added it.
-- -----------------------------------------------------------------------------

revoke all on table public.contact_messages from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. service_role: the writer and the reader (AGENTS.md rule for new tables).
-- -----------------------------------------------------------------------------

grant usage on schema public to service_role;

grant select, insert, update, delete on public.contact_messages to service_role;

commit;
