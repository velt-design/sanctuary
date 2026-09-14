import 'server-only';
import { config } from './security';
import { access } from './store';
import { XeroError } from './provider';

export type XeroFinanceContact = { id: string; name: string; email: string };
export type XeroRevenueAccount = { id: string; code: string; name: string; defaultTaxType: string };
export type XeroRevenueTax = { type: string; name: string; effectiveRate: number };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (value: unknown, max: number) => typeof value === 'string' && value.length <= max ? value : '';

async function read(tenantId: string, resource: 'Contacts' | 'Accounts' | 'TaxRates', recordId?: string, name?: string) {
  if (!uuid.test(tenantId) || tenantId !== config().tenantId) throw new XeroError('XERO_TENANT_MISMATCH');
  if (recordId && !uuid.test(recordId)) throw new XeroError('INVALID_RECORD_ID');
  if (name !== undefined && (!name.trim() || name.length > 240 || /[\u0000-\u001f]/.test(name))) throw new XeroError('INVALID_QUERY');
  const tokens = await access();
  const scope = resource === 'Contacts' ? 'accounting.contacts.read' : 'accounting.settings.read';
  if (!tokens.scopes?.includes(scope)) throw new XeroError('INSUFFICIENT_SCOPE');
  const url = new URL(`https://api.xero.com/api.xro/2.0/${resource}${recordId ? `/${recordId}` : ''}`);
  if (name !== undefined) {
    url.searchParams.set('where', `Name=="${name.replaceAll('"', '""')}"`);
    url.searchParams.set('page', '1'); url.searchParams.set('pageSize', '21');
  }
  const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${tokens.accessToken}`, 'Xero-tenant-id': tenantId, Accept: 'application/json' } });
  if (!response.ok) throw new XeroError(response.status === 401 ? 'RECONNECT_REQUIRED' : 'XERO_MAPPING_READ_FAILED');
  const body: unknown = await response.json();
  const rows = body && typeof body === 'object' ? (body as Record<string, unknown>)[resource] : null;
  if (!Array.isArray(rows) || rows.length > (resource === 'Contacts' ? 21 : 2000)
    || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new XeroError('INVALID_PROVIDER_RESPONSE');
  return rows as Record<string, unknown>[];
}

function contact(row: Record<string, unknown>): XeroFinanceContact {
  const id = text(row.ContactID, 36); const name = text(row.Name, 240);
  if (!uuid.test(id) || !name || row.ContactStatus !== 'ACTIVE' || row.MergedToContactID) throw new XeroError('XERO_CONTACT_REVIEW_REQUIRED');
  return { id, name, email: text(row.EmailAddress, 254) };
}

export const financeMappingProvider = {
  async contacts(tenantId: string, exactName: string) {
    const rows = await read(tenantId, 'Contacts', undefined, exactName);
    return { contacts: rows.slice(0, 20).filter(row => row.ContactStatus === 'ACTIVE' && !row.MergedToContactID).map(contact), limited: rows.length > 20 };
  },
  async contact(tenantId: string, id: string) {
    const rows = await read(tenantId, 'Contacts', id);
    if (rows.length !== 1 || rows[0].ContactID !== id) throw new XeroError('INVALID_PROVIDER_RESPONSE');
    return contact(rows[0]);
  },
  async accounting(tenantId: string): Promise<{ accounts: XeroRevenueAccount[]; taxes: XeroRevenueTax[] }> {
    const [accounts, taxes] = await Promise.all([read(tenantId, 'Accounts'), read(tenantId, 'TaxRates')]);
    return {
      accounts: accounts.filter(row => row.Status === 'ACTIVE' && ['REVENUE', 'SALES', 'OTHERINCOME'].includes(String(row.Type))).map(row => {
        const id = text(row.AccountID, 36); const code = text(row.Code, 10); const name = text(row.Name, 255);
        if (!uuid.test(id) || !code || !name) throw new XeroError('INVALID_PROVIDER_RESPONSE');
        return { id, code, name, defaultTaxType: text(row.TaxType, 50) };
      }),
      taxes: taxes.filter(row => row.Status === 'ACTIVE' && row.CanApplyToRevenue === true).map(row => {
        const type = text(row.TaxType, 50); const name = text(row.Name, 255); const effectiveRate = row.EffectiveRate;
        if (!type || !name || typeof effectiveRate !== 'number' || !Number.isFinite(effectiveRate) || effectiveRate < 0 || effectiveRate > 100) throw new XeroError('INVALID_PROVIDER_RESPONSE');
        return { type, name, effectiveRate };
      }),
    };
  },
};
