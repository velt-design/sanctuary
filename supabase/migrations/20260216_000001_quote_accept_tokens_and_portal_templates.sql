alter table if exists public.quote_versions
  add column if not exists accept_token_hash text,
  add column if not exists accept_token_expires_at timestamptz,
  add column if not exists accepted_at timestamptz;

create index if not exists quote_versions_accept_token_hash_idx
  on public.quote_versions (accept_token_hash);

insert into public.email_templates (id, subject, body_html, body_text, variables)
values
  ('EMAIL_DESIGN_CONSULTATION_BOOKED_V1', 'Design consultation booked', '<p>(Rendered in app code)</p>', null, '[]'::jsonb),
  ('EMAIL_QUOTE_READY_V1', 'Quote ready', '<p>(Rendered in app code)</p>', null, '[]'::jsonb),
  ('EMAIL_PROJECT_SCHEDULED_V1', 'Your project is scheduled', '<p>(Rendered in app code)</p>', null, '[]'::jsonb),
  ('EMAIL_PROJECT_COMPLETED_V1', 'Your pergola is complete', '<p>(Rendered in app code)</p>', null, '[]'::jsonb)
on conflict (id) do update
set
  subject = excluded.subject,
  body_html = excluded.body_html,
  body_text = excluded.body_text,
  variables = excluded.variables,
  updated_at = now();

select pg_notify('pgrst', 'reload schema');
