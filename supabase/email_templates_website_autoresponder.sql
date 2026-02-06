insert into public.email_templates (id, subject, body_html, body_text, variables)
values
  ('EMAIL_WEBSITE_AUTORESPONDER_RES_V1', 'Your pergola enquiry - estimate and next steps', '<p>(Rendered in app code)</p>', null, '[]'::jsonb),
  ('EMAIL_WEBSITE_AUTORESPONDER_COM_V1', 'Commercial enquiry received - estimate and next steps', '<p>(Rendered in app code)</p>', null, '[]'::jsonb),
  ('EMAIL_WEBSITE_AUTORESPONDER_PRO_V1', 'Professional enquiry received - next steps', '<p>(Rendered in app code)</p>', null, '[]'::jsonb)
on conflict (id) do nothing;

select pg_notify('pgrst', 'reload schema');
