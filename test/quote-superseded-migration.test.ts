// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

let sql = '';

describe('manual quote superseded migration', () => {
  beforeAll(async () => {
    sql = await readFile(
      resolve(process.cwd(), 'supabase/migrations/20260810000003_manual_quote_superseded_status.sql'),
      'utf8',
    );
  });

  it('adds an auditable superseded quote state', () => {
    expect(sql).toContain('superseded_at timestamptz');
    expect(sql).toContain('superseded_by text');
    expect(sql).toContain("'SUPERSEDED'");
    expect(sql).toContain('quote_versions_status_check');
  });

  it('does not automatically mutate invoices or other quote versions', () => {
    expect(sql).not.toContain('deposit_invoices');
    expect(sql).not.toContain('update public.quote_versions');
  });
});
