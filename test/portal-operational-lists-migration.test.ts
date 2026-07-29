import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260729_000001_portal_operational_lists.sql'),
  'utf8',
);

describe('portal operational list migration', () => {
  it.each([
    'staff_find_contact_duplicates_v1',
    'staff_contacts_index_v1',
    'staff_projects_index_v1',
  ])('keeps %s authenticated, invoker-owned, and non-public', (functionName) => {
    expect(source).toMatch(new RegExp(`create or replace function public\\.${functionName}\\(`));
    expect(source).toMatch(/security invoker/g);
    expect(source).toContain(`revoke all on function public.${functionName}`);
    expect(source).toContain(`grant execute on function public.${functionName}`);
  });

  it('bounds pages, returns exact counts, and uses stable row ordering', () => {
    expect(source).toContain('greatest(10, least(coalesce(p_page_size, 50), 100))');
    expect(source).toMatch(/'totalCount', \(select count\(\*\) from filtered\)/g);
    expect(source).toMatch(/ordered\.id asc/g);
    expect(source).toMatch(/jsonb_agg\([\s\S]*?order by/g);
  });

  it('keeps portal access checks as scalar init plans and duplicate checks normalized', () => {
    expect(source).not.toContain('where public.has_portal_access()');
    expect(source).toContain('where (select public.has_portal_access())');
    expect(source).toContain("lower(btrim(coalesce(p_email, '')))");
    expect(source).toContain("regexp_replace(coalesce(p_phone, ''), '[^0-9]+'");
    expect(source).toContain('length(input.normalized_phone) >= 7');
  });
});
