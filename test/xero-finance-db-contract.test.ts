import { expect, it, vi } from 'vitest';
import { runXeroFinanceContracts } from '../scripts/xero-finance-db-contract.mjs';
it('applies finance prerequisites before their real-job contracts and retains transaction boundaries', () => {
  const applySql = vi.fn(); const executeSql = vi.fn();
  runXeroFinanceContracts({ repositoryRoot: process.cwd(), migrationsDirectory: 'supabase/migrations', applySql, executeSql });
  const files = applySql.mock.calls.map(([file]) => String(file));
  expect(files[0]).toBe('supabase/tests/xero_invoice_bootstrap.sql');
  expect(files.indexOf('supabase/migrations/20260914000021_xero_unused_invoice_resume.sql'))
    .toBeLessThan(files.indexOf('supabase/tests/xero_unused_invoice_resume.sql'));
  expect(files.indexOf('supabase/migrations/20260914000020_xero_invoice_recovery.sql'))
    .toBeLessThan(files.indexOf('supabase/tests/xero_finance_workflow.sql'));
  expect(files.at(-1)).toBe('supabase/tests/xero_unused_invoice_resume.sql');
  expect(executeSql.mock.calls[0][0]).toContain('create function public.xero_require_payment_approver');
  expect(executeSql.mock.calls[0][0]).not.toContain('create function public.xero_approve_deposit_match');
  for (const [file, options] of applySql.mock.calls) {
    if (String(file).includes('/migrations/')) expect(options).toEqual({ singleTransaction: true });
  }
});
