import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const marketingRoot = path.resolve(here, '..');

function readMarketingFile(relativePath: string): string {
  return readFileSync(path.join(marketingRoot, relativePath), 'utf8');
}

describe('marketing public token boundaries', () => {
  it('keeps quote public access hash-bound instead of comparing raw accept tokens', () => {
    const source = readMarketingFile('lib/quotes/publicQuote.ts');

    expect(source).toContain('const tokenHash = hashAcceptToken(params.token)');
    expect(source).toContain(".eq('accept_token_hash', tokenHash)");
    expect(source).toContain(".eq('accept_token_hash', params.tokenHash)");
    expect(source).not.toMatch(/\.eq\('accept_token_hash',\s*params\.token\)/);
    expect(source).not.toMatch(/\.eq\('accept_token_hash',\s*token\)/);
  });

  it('keeps invoice public access hash-bound instead of comparing raw portal tokens', () => {
    const source = readMarketingFile('lib/invoices/publicInvoice.ts');

    expect(source).toContain('const tokenHash = hashAcceptToken(params.token)');
    expect(source).toContain(".eq('portal_token_hash', tokenHash)");
    expect(source).not.toMatch(/\.eq\('portal_token_hash',\s*params\.token\)/);
    expect(source).not.toMatch(/\.eq\('portal_token_hash',\s*token\)/);
  });
});
