// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

let sql = '';

describe('manual quote migration', () => {
  beforeAll(async () => {
    sql = await readFile(resolve(process.cwd(), 'supabase/migrations/20260813000001_manual_quotes_without_estimates.sql'), 'utf8');
  });

  it('allows only manual quote versions to omit estimate provenance', () => {
    expect(sql).toContain('alter column source_estimate_version_id drop not null');
    expect(sql).toContain("pricing_source in ('calculator_live', 'workbench_solved', 'manual')");
    expect(sql).toContain("pricing_source = 'manual' and source_estimate_version_id is null");
    expect(sql).toContain("pricing_source is distinct from 'manual' and source_estimate_version_id is not null");
    expect(sql).toContain('create or replace function public.commercial_quote_create_draft');
    expect(sql).toContain('v_existing.source_estimate_version_id is distinct from p_source_estimate_version_id');
  });
});
