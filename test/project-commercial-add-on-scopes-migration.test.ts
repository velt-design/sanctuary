// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

let sql = '';

describe('project commercial add-on scopes migration', () => {
  beforeAll(async () => {
    sql = await readFile(
      resolve(process.cwd(), 'supabase/migrations/20260811000002_project_commercial_add_on_scopes.sql'),
      'utf8',
    );
  });

  it('allows one base quote family and independent add-on families per project', () => {
    expect(sql).toContain('add column if not exists commercial_scope_id uuid');
    expect(sql).toContain('drop constraint if exists quotes_project_id_key');
    expect(sql).toContain('quotes_one_base_family_per_project');
    expect(sql).toContain('quotes_one_family_per_commercial_scope');
  });

  it('calculates invoice availability within the selected accepted quote', () => {
    expect(sql).toMatch(/project_payment_allocations allocation[\s\S]*?allocation\.quote_version_id = v_version\.id/);
    expect(sql).toMatch(/deposit_invoices invoice[\s\S]*?invoice\.quote_version_id = v_version\.id and invoice\.status = 'OPEN'/);
    expect(sql).toContain('Invoice amount exceeds the remaining quote balance');
  });
});
