import { XERO_SCOPES } from './security';

export const XERO_INVOICE_SCOPES = XERO_SCOPES.replace('accounting.invoices.read', 'accounting.invoices') + ' accounting.settings.read';
const identityScopes = ['openid', 'profile', 'email'];
const allowed = new Set([...XERO_SCOPES.split(' '), ...XERO_INVOICE_SCOPES.split(' '), ...identityScopes]);

export function consentScopes(): string {
  return process.env.XERO_INVOICE_CONSENT_ENABLED === 'true' && Boolean(process.env.XERO_TENANT_ID?.trim())
    ? XERO_INVOICE_SCOPES : XERO_SCOPES;
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
  if (scopes.some(scope => !allowed.has(scope) || !permitted.has(scope))) throw new Error('EXCESS_SCOPE');
  return scopes;
}
