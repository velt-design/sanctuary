// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

let sql = '';

describe('manual quote variation scope repair migration', () => {
  beforeAll(async () => {
    sql = await readFile(
      resolve(process.cwd(), 'supabase/migrations/20260818000001_rehome_sent_manual_variation.sql'),
      'utf8',
    );
  });

  it('repairs only the known sent variation after proving it has no invoice', () => {
    expect(sql).toContain("v_quote_version_id constant uuid := 'ff2c34be-b033-403d-9bb9-8486f6b3cbb8'");
    expect(sql).toContain("v_version.status <> 'SENT'");
    expect(sql).toContain('v_version.accepted_at is not null');
    expect(sql).toContain('invoice.quote_version_id = v_quote_version_id');
    expect(sql).toContain('Target quote variation no longer matches the safe repair preconditions');
  });

  it('serializes with acceptance and gives the variation an independent family', () => {
    expect(sql).toContain("'commercial-project-invoice:' || v_old_quote.project_id::text");
    expect(sql).toContain('commercial_scope_id = v_quote_version_id');
    expect(sql).toContain('version_number = 1');
    expect(sql).toContain("'quote.commercial_scope_repaired'");
    expect(sql).toContain("'quote.commercial_scope_repaired:' || v_quote_version_id::text");
  });
});
