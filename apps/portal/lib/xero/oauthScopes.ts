import { XERO_SCOPES } from './security';

export const XERO_INVOICE_SCOPES = XERO_SCOPES.replace('accounting.invoices.read', 'accounting.invoices')
  .replace('accounting.contacts.read', 'accounting.contacts') + ' accounting.settings.read';
const identityScopes = ['openid', 'profile', 'email'];
export const XERO_REPORT_READ_SCOPES = ['accounting.settings.read', 'accounting.reports.banksummary.read', 'accounting.reports.profitandloss.read'] as const;
const allowed = new Set([...XERO_SCOPES.split(' '), ...XERO_INVOICE_SCOPES.split(' '), ...identityScopes, ...XERO_REPORT_READ_SCOPES]);

export function consentScopes(): string {
  return process.env.XERO_INVOICE_CONSENT_ENABLED === 'true' && Boolean(process.env.XERO_TENANT_ID?.trim())
    ? XERO_INVOICE_SCOPES : XERO_SCOPES;
}

/** Existing encrypted grants are retained; report consent never introduces management permissions. */
export function boundConsentScopes(mode: 'connection' | 'reports', granted: readonly string[] = []): string {
  if (granted.some(scope => !allowed.has(scope))) throw new Error('EXCESS_SCOPE');
  if (mode === 'reports' && (process.env.XERO_REPORT_CONSENT_ENABLED !== 'true' || !process.env.XERO_TENANT_ID?.trim())) throw new Error('REPORT_CONSENT_DISABLED');
  const initial = mode === 'reports' ? XERO_SCOPES : consentScopes();
  return [...new Set([...initial.split(' '), ...granted, ...(mode === 'reports' ? XERO_REPORT_READ_SCOPES : [])])].sort().join(' ');
}

// The expected grant comes from the bound OAuth attempt or encrypted stored tokens,
// never from current write rollout flags. Turning transfers off must not stop renewal.
export function validateTokenScopes(value: unknown, expected: readonly string[]): string[] {
  if (!expected.length || expected.some(scope => !allowed.has(scope))) throw new Error('EXCESS_SCOPE');
  if (typeof value !== 'string') throw new Error('INSUFFICIENT_SCOPE');
  const scopes = [...new Set(value.split(/\s+/).filter(Boolean))];
  if (expected.some(scope => !scopes.includes(scope))) throw new Error('INSUFFICIENT_SCOPE');
  const permitted = new Set([...expected, ...identityScopes]);
  // Xero can retain the narrower read grant when adding invoice write consent.
  if (expected.includes('accounting.invoices')) permitted.add('accounting.invoices.read');
  if (expected.includes('accounting.contacts')) permitted.add('accounting.contacts.read');
  if (scopes.some(scope => !allowed.has(scope) || !permitted.has(scope))) throw new Error('EXCESS_SCOPE');
  return scopes;
}
