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
      'apps/portal/lib/invoices/server.ts',
      'apps/portal/lib/jobPacks/server.ts',
    ];

    for (const file of outputBoundaryFiles) {
      const source = readRepoFile(file);
      expect(source, file).not.toContain('commercial_design_input');
      expect(source, file).not.toContain('pricing_source_metadata');
    }
  });

  it('loads estimate source metadata explicitly without selecting raw commercial design input', () => {
    const source = readRepoFile('apps/portal/lib/quotes/serverCore.ts');

    expect(source).toContain(
      ".select('id, project_id, created_at, updated_at, status, inputs, outputs, warnings, pricing_source, pricing_source_metadata')",
    );
    expect(source).not.toContain('commercial_design_input');
  });
});
