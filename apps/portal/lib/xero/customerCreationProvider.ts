import 'server-only';
import { config } from './security';
import { access } from './store';
import { XeroError } from './provider';
import { validateCustomerRequest, type CustomerCreationProvider } from './customerCreation';

const API = 'https://api.xero.com/api.xro/2.0/Contacts';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function tokensFor(tenantId: string, write: boolean) {
  if (!uuid.test(tenantId) || tenantId !== config().tenantId) throw new XeroError('XERO_TENANT_MISMATCH');
  if (write && process.env.XERO_CUSTOMER_CREATION_ENABLED !== 'true') throw new XeroError('XERO_CUSTOMER_CREATION_DISABLED');
  const tokens = await access();
  if (!tokens.scopes?.includes('accounting.contacts')
    && (write || !tokens.scopes?.includes('accounting.contacts.read'))) throw new XeroError('INSUFFICIENT_SCOPE');
  return tokens;
}
export async function requireCustomerCreationAccess(tenantId: string): Promise<void> {
  await tokensFor(tenantId, true);
}
async function contacts(response: Response): Promise<Record<string, unknown>[]> {
  if (!response.ok) throw new XeroError(response.status === 401 ? 'RECONNECT_REQUIRED' : 'XERO_CUSTOMER_REQUEST_FAILED');
  const body: unknown = await response.json();
  const rows = body && typeof body === 'object' ? (body as { Contacts?: unknown }).Contacts : null;
  if (!Array.isArray(rows) || rows.length > 2 || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw new XeroError('INVALID_PROVIDER_RESPONSE');
  }
  // Select only identity/reconciliation fields; raw contact data must not reach logs or UI.
  return rows.map(row => ({ ContactID: row.ContactID, ContactNumber: row.ContactNumber, Name: row.Name,
    ContactStatus: row.ContactStatus, MergedToContactID: row.MergedToContactID,
    HasErrors: row.HasErrors === true || row.HasValidationErrors === true
      || (Array.isArray(row.ValidationErrors) && row.ValidationErrors.length > 0) }));
}
async function get(tenantId: string, url: URL) {
  const tokens = await tokensFor(tenantId, false);
  return contacts(await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${tokens.accessToken}`, 'Xero-tenant-id': tenantId, Accept: 'application/json' } }));
}
async function find(tenantId: string, field: 'Name' | 'ContactNumber', value: string) {
  if (!value.trim() || value.length > (field === 'Name' ? 255 : 50) || /[\u0000-\u001f]/.test(value)) throw new XeroError('INVALID_QUERY');
  const url = new URL(API);
  url.searchParams.set('where', `${field}=="${value.replaceAll('"', '""')}"`);
  url.searchParams.set('includeArchived', 'true');
  url.searchParams.set('page', '1'); url.searchParams.set('pageSize', '2');
  return get(tenantId, url);
}
export const customerCreationProvider: CustomerCreationProvider = {
  findByNumber: (tenantId, number) => find(tenantId, 'ContactNumber', number),
  findByName: (tenantId, name) => find(tenantId, 'Name', name),
  async read(tenantId, contactId) {
    if (!uuid.test(contactId)) throw new XeroError('INVALID_RECORD_ID');
    const rows = await get(tenantId, new URL(`${API}/${contactId}`));
    if (rows.length !== 1 || rows[0].ContactID !== contactId) throw new XeroError('INVALID_PROVIDER_RESPONSE');
    return rows[0];
  },
  async create(request) {
    validateCustomerRequest(request);
    const tokens = await tokensFor(request.tenantId, true);
    if (!request.dispatchStarted || request.providerContactId !== null
      || request.preparedAt > Date.now() || Date.now() + 15_000 >= request.expiresAt) {
      throw new XeroError('INVALID_FROZEN_CUSTOMER_REQUEST');
    }
    // PUT is create-only. POST may update an existing customer and is forbidden here.
    const rows = await contacts(await fetch(API, { method: 'PUT', body: request.body, cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(15_000), headers: { Authorization: `Bearer ${tokens.accessToken}`,
        'Xero-tenant-id': request.tenantId, Accept: 'application/json', 'Content-Type': 'application/json',
        'Idempotency-Key': request.idempotencyKey } }));
    if (rows.length !== 1 || typeof rows[0].ContactID !== 'string' || !uuid.test(rows[0].ContactID) || rows[0].HasErrors) {
      throw new XeroError('INVALID_PROVIDER_RESPONSE');
    }
    return { contactId: rows[0].ContactID };
  },
};
