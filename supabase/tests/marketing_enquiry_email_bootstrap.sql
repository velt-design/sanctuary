-- Disposable synthetic fixture only. Never apply to a shared database.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create table public.enquiry_requests (id uuid primary key, submission_id uuid not null unique);
insert into public.enquiry_requests values
  ('11111111-1111-4111-8111-111111111111', '21111111-1111-4111-8111-111111111111'),
  ('12222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222'),
  ('13333333-3333-4333-8333-333333333333', '23333333-3333-4333-8333-333333333333');
