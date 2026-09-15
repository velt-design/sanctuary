import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('preserves the verified SQL binding body when sharing the worker and finance owner', () => {
  const original = readFileSync('supabase/migrations/20260914000008_xero_invoice_dispatch.sql', 'utf8').replace(/\r/g, '');
  const forward = readFileSync('supabase/migrations/20260914000020_xero_invoice_recovery.sql', 'utf8').replace(/\r/g, '');
  function body(source: string, signature: string) {
    const start = source.indexOf(signature); if (start < 0) throw new Error('Missing SQL owner');
    const begin = source.indexOf('$$', start) + 2; return source.slice(begin, source.indexOf('$$;', begin));
  }
  expect(body(forward, 'create function private.xero_invoice_finalise_verified(')).toBe(
    body(original, 'create function public.xero_invoice_finalise(')
      .replace('v_invoice := private.xero_invoice_lock_context(p_job_id,p_lease_token);', 'v_invoice := p_invoice;'));
  expect(body(forward, 'create or replace function public.xero_invoice_finalise(')).toContain('private.xero_invoice_lock_context(p_job_id,p_lease_token)');
});
