-- Projects and Contacts use one portal-membership result for the statement.
-- The authorization decision is unchanged; wrapping the stable helper in a
-- scalar SELECT lets PostgreSQL cache it as an init-plan instead of invoking it
-- once for every candidate row.

drop policy if exists portal_access_all on public.projects;
create policy portal_access_all on public.projects
  for all
  to authenticated
  using ((select public.has_portal_access()))
  with check ((select public.has_portal_access()));

drop policy if exists portal_access_all on public.contacts;
create policy portal_access_all on public.contacts
  for all
  to authenticated
  using ((select public.has_portal_access()))
  with check ((select public.has_portal_access()));

comment on policy portal_access_all on public.projects is
  'Authenticated portal membership for all project operations, evaluated once per statement.';

comment on policy portal_access_all on public.contacts is
  'Authenticated portal membership for all contact operations, evaluated once per statement.';

notify pgrst, 'reload schema';
