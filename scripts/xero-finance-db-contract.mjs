import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// Minimal commercial prerequisites with real canonical jobs/PGMQ owners.
// Full historical payment-ledger validation is a separate release requirement.
export function runXeroFinanceContracts({ repositoryRoot, migrationsDirectory, applySql, executeSql }) {
  applySql('supabase/tests/xero_invoice_bootstrap.sql', { singleTransaction: true });
  for (const migration of readdirSync(path.join(repositoryRoot, migrationsDirectory)).filter(name => /^2026091400000[5-8]_xero_invoice_.*\.sql$/.test(name)).sort()) {
    applySql(path.posix.join(migrationsDirectory, migration), { singleTransaction: true });
  }
  applySql('supabase/tests/xero_invoice.sql');
  applySql('supabase/migrations/20260914000009_xero_finance_access_audit.sql', { singleTransaction: true });
  applySql('supabase/tests/xero_finance_access.sql');
  applySql('supabase/tests/xero_finance_bootstrap.sql', { singleTransaction: true });
  const financeCommands = readFileSync(path.join(repositoryRoot, 'supabase/migrations/20260914000003_xero_deposit_commands.sql'), 'utf8');
  executeSql(financeCommands.slice(financeCommands.indexOf('create function public.xero_require_payment_approver'),
    financeCommands.indexOf('create function public.xero_approve_deposit_match')), 'Existing finance grant owner');
  for (const migration of ['20260914000010_xero_finance_review.sql', '20260914000011_xero_finance_mapping_commands.sql', '20260914000012_xero_finance_resume.sql']) {
    applySql(path.posix.join(migrationsDirectory, migration), { singleTransaction: true });
  }
  applySql('supabase/migrations/20260914000013_xero_invoice_observations.sql', { singleTransaction: true });
  applySql('supabase/migrations/20260914000018_xero_finance_queue.sql', { singleTransaction: true });
  applySql('supabase/migrations/20260914000020_xero_invoice_recovery.sql', { singleTransaction: true });
  applySql('supabase/migrations/20260914000021_xero_unused_invoice_resume.sql', { singleTransaction: true });
  applySql('supabase/migrations/20260915000002_xero_finance_views.sql', { singleTransaction: true });
  applySql('supabase/migrations/20260915000003_xero_mapping_status.sql', { singleTransaction: true });
  applySql('supabase/tests/xero_mapping_status.sql');
  applySql('supabase/tests/xero_finance_views.sql');
  applySql('supabase/tests/xero_finance_workflow.sql');
  applySql('supabase/tests/xero_invoice_recovery.sql');
  applySql('supabase/tests/xero_unused_invoice_resume.sql');
}
