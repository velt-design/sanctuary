import { readFileSync } from 'node:fs';
import path from 'node:path';

// The legacy migration also installs pg_cron cleanup and upload RPCs. The isolated
// jobs image doesn't promise pg_cron. Select the exact table and intake function
// text, without changing their bodies or replacing intake with a mock.
export function marketingEnquiryTestIntakeSql(root) {
  const source = readFileSync(path.join(root, 'supabase/migrations/20260723_000001_marketing_enquiry_intake_security.sql'), 'utf8');
  const table = source.match(/create table if not exists public\.marketing_enquiry_upload_sessions \([\s\S]*?\n\);/);
  const intake = source.match(/create or replace function public\.marketing_enquiry_intake\([\s\S]*?\n\$\$;/);
  if (!table || !intake) throw new Error('Exact marketing intake prerequisites were not found; update the isolated harness.');
  return `alter table public.enquiry_requests add column submission_id uuid not null unique default gen_random_uuid();
${table[0]}
${intake[0]}
revoke all on function public.marketing_enquiry_intake(uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.marketing_enquiry_intake(uuid,text,jsonb) to service_role;`;
}
