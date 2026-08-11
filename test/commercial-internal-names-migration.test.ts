import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260811000001_commercial_internal_names.sql'),
  'utf8',
);

describe('commercial internal names migration', () => {
  it('adds bounded staff-only names to estimate records and quote families', () => {
    expect(sql).toMatch(/alter table public\.estimates[\s\S]*add column if not exists internal_name text/i);
    expect(sql).toMatch(/alter table public\.quotes[\s\S]*add column if not exists internal_name text/i);
    expect(sql).toMatch(/estimates_internal_name_length_check[\s\S]*char_length\(internal_name\) <= 120/i);
    expect(sql).toMatch(/quotes_internal_name_length_check[\s\S]*char_length\(internal_name\) <= 120/i);
    expect(sql).toMatch(/Excluded from customer artifacts/i);
  });
});
