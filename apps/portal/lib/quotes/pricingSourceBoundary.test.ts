import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('quote pricing source output boundaries', () => {
  it('keeps public routes and generated customer outputs away from raw commercial payloads', () => {
    const outputBoundaryFiles = [
      'apps/marketing/lib/quotes/publicQuote.ts',
      'apps/marketing/lib/invoices/publicInvoice.ts',
      'apps/portal/lib/quotes/pdf.ts',
      'apps/portal/lib/quotes/renderArtifacts.ts',
      'apps/portal/lib/quotes/serverEmail.ts',
      'apps/portal/lib/emails/quote.ts',
      'apps/portal/lib/emails/invoice.ts',
      'apps/portal/lib/invoices/pdf.ts',
      'apps/portal/lib/invoices/server.ts',
      'apps/portal/lib/jobPacks/server.ts',
      'apps/portal/lib/jobPacks/workbook.ts',
      'apps/portal/lib/jobPacks/pdf.ts',
    ];

    for (const file of outputBoundaryFiles) {
      const source = readRepoFile(file);
      expect(source, file).not.toContain('commercial_design_input');
      expect(source, file).not.toContain('pricing_source_metadata');
      expect(source, file).not.toContain('oversizedCommercialPayload');
    }
  });

  it('loads estimate source metadata explicitly without selecting raw commercial design input', () => {
    const source = readRepoFile('apps/portal/lib/quotes/serverLoaders.ts');

    expect(source).toContain(
      ".select('id, project_id, commercial_scope_id, created_at, updated_at, status, inputs, outputs, warnings, pricing_source, pricing_source_metadata')",
    );
    expect(source).not.toContain('commercial_design_input');
  });

  it('keeps public quote and invoice token helpers on explicit safe select lists', () => {
    const publicQuote = readRepoFile('apps/marketing/lib/quotes/publicQuote.ts');
    const publicInvoice = readRepoFile('apps/marketing/lib/invoices/publicInvoice.ts');

    expect(publicQuote).toContain(
      'id, quote_id, status, version_number, created_at, sent_at, expires_at, accept_token_expires_at, pdf_file_id, customer_name, intro_text, terms_text, total_inc_gst_cents, total_ex_gst_cents, gst_cents',
    );
    expect(publicQuote).not.toContain('pricing_source');
    expect(publicInvoice).toContain(
      'id, status, invoice_ref, quote_ref, quote_version_id, quote_version_number, issue_date, due_date, reference, customer_name, project_name, project_address, payment_instructions, deposit_percent, payment_term_label, payment_term_position, payment_term_count, paid_at, quote_total_inc_gst_cents, total_inc_gst_cents, total_ex_gst_cents, gst_cents, portal_token_expires_at, pdf_file_id',
    );
    expect(publicInvoice).not.toContain('pricing_source');
  });

  it('keeps job-pack quote-version reads to identity/status/source-estimate fields', () => {
    const source = readRepoFile('apps/portal/lib/jobPacks/server.ts');

    expect(source).toContain("select('id, quote_id, version_number, status, source_estimate_version_id, quotes!inner(project_id, quote_ref)')");
    expect(source).not.toContain('commercial_design_input');
    expect(source).not.toContain('pricing_source_metadata');
  });
});
