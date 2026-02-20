alter table if exists public.quote_send_logs
  add column if not exists accept_token_hash text;

create index if not exists quote_send_logs_accept_token_hash_idx
  on public.quote_send_logs (accept_token_hash);

select pg_notify('pgrst', 'reload schema');
