grant usage on schema public to anon, authenticated, service_role;

-- Public catalog: browser (guest + logged-in) and server
grant select on public.categories     to anon, authenticated, service_role;
grant select on public.sub_categories to anon, authenticated, service_role;
grant select on public.products       to anon, authenticated, service_role;
grant select on public.announcements  to anon, authenticated, service_role;
grant select on public.team_members   to anon, authenticated, service_role;

-- Private tables: no anon access. RLS still limits rows per user / admin.
grant select on public.customers   to authenticated, service_role;
grant select on public.orders      to authenticated, service_role;
grant select on public.order_items to authenticated, service_role;
grant select on public.settings    to authenticated, service_role;