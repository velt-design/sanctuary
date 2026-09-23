import { afterEach, describe, expect, it, vi } from 'vitest';
import { boundConsentScopes, consentScopes, validateTokenScopes, XERO_INVOICE_SCOPES, XERO_REPORT_READ_SCOPES } from './oauthScopes';
import { XERO_SCOPES } from './security';
afterEach(() => vi.unstubAllEnvs());
describe('Xero grant boundaries', () => {
  it('adds only read-only report permissions, preserves existing writes, and renews with rollout off', () => {
    vi.stubEnv('XERO_REPORT_CONSENT_ENABLED', 'true'); vi.stubEnv('XERO_TENANT_ID', 'pinned'); vi.stubEnv('XERO_INVOICE_CONSENT_ENABLED', 'true');
    const read = boundConsentScopes('reports', XERO_SCOPES.split(' '));
    expect(read.split(' ')).toEqual(expect.arrayContaining([...XERO_REPORT_READ_SCOPES]));
    expect(read.split(' ')).not.toContain('accounting.invoices'); expect(read.split(' ')).not.toContain('accounting.contacts');
    const managed = boundConsentScopes('reports', XERO_INVOICE_SCOPES.split(' '));
    expect(managed.split(' ')).toContain('accounting.invoices'); expect(managed.split(' ')).toContain('accounting.contacts');
    vi.stubEnv('XERO_REPORT_CONSENT_ENABLED', 'false'); vi.stubEnv('XERO_INVOICE_CONSENT_ENABLED', 'false');
    expect(validateTokenScopes(managed, managed.split(' '))).toContain('accounting.reports.profitandloss.read');
    expect(() => boundConsentScopes('reports', managed.split(' '))).toThrow('REPORT_CONSENT_DISABLED');
    expect(boundConsentScopes('connection', managed.split(' '))).toBe(managed);
    expect(() => validateTokenScopes(managed + ' accounting.payments', managed.split(' '))).toThrow('EXCESS_SCOPE');
  });
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
    expect(validateTokenScopes(XERO_INVOICE_SCOPES + ' accounting.contacts.read', finance)).toContain('accounting.contacts.read');
    expect(() => validateTokenScopes(XERO_SCOPES + ' accounting.contacts', XERO_SCOPES.split(' '))).toThrow('EXCESS_SCOPE');
    const previousInvoiceGrant = XERO_INVOICE_SCOPES.replace('accounting.contacts', 'accounting.contacts.read');
    expect(validateTokenScopes(previousInvoiceGrant, previousInvoiceGrant.split(' '))).toContain('accounting.contacts.read');
  });
});
