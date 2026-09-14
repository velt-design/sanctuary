import { afterEach, describe, expect, it, vi } from 'vitest';
import { consentScopes, validateTokenScopes, XERO_INVOICE_SCOPES } from './oauthScopes';
import { XERO_SCOPES } from './security';
afterEach(() => vi.unstubAllEnvs());
describe('Xero grant boundaries', () => {
  it('requires separate consent configuration and a pinned organisation', () => {
    vi.stubEnv('XERO_INVOICE_TRANSFERS_ENABLED', 'true');
    vi.stubEnv('XERO_INVOICE_CONSENT_ENABLED', 'false');
    expect(consentScopes()).toBe(XERO_SCOPES);
    vi.stubEnv('XERO_INVOICE_CONSENT_ENABLED', 'true');
    vi.stubEnv('XERO_TENANT_ID', '');
    expect(consentScopes()).toBe(XERO_SCOPES);
    vi.stubEnv('XERO_TENANT_ID', 'pinned');
    expect(consentScopes()).toBe(XERO_INVOICE_SCOPES);
  });
  it('renews an existing finance grant even when consent and transfers are switched off', () => {
    vi.stubEnv('XERO_INVOICE_CONSENT_ENABLED', 'false');
    vi.stubEnv('XERO_INVOICE_TRANSFERS_ENABLED', 'false');
    expect(validateTokenScopes(XERO_INVOICE_SCOPES, XERO_INVOICE_SCOPES.split(' '))).toContain('accounting.invoices');
  });
  it('accepts retained read permission but denies added write capabilities and missing grants', () => {
    const finance = XERO_INVOICE_SCOPES.split(' ');
    expect(validateTokenScopes(XERO_INVOICE_SCOPES + ' accounting.invoices.read', finance)).toContain('accounting.invoices.read');
    expect(() => validateTokenScopes(XERO_INVOICE_SCOPES + ' accounting.payments', finance)).toThrow('EXCESS_SCOPE');
    expect(() => validateTokenScopes(XERO_SCOPES + ' accounting.invoices', XERO_SCOPES.split(' '))).toThrow('EXCESS_SCOPE');
    expect(() => validateTokenScopes(XERO_SCOPES, finance)).toThrow('INSUFFICIENT_SCOPE');
  });
});
