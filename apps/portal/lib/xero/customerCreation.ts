import 'server-only';
import { createHash } from 'node:crypto';

type CustomerCreationInput = { tenantId: string; sourceContactId: string; name: string };
type XeroNewCustomer = { Name: string; ContactNumber: string };
export type FrozenCustomerCreation = {
  tenantId: string; sourceContactId: string; customer: XeroNewCustomer; body: string; bodyHash: string;
  idempotencyKey: string; preparedAt: number; expiresAt: number; dispatchStarted: boolean;
  providerContactId: string | null;
};
export type CustomerCreationRepository = {
  /** Recheck finance grant, invoice/source contact and tenant; freeze once under a durable lock. */
  prepare(input: CustomerCreationInput, customer: XeroNewCustomer): Promise<FrozenCustomerCreation>;
  /** Commit dispatch under the same intent lock; return the unchanged frozen request. */
  beginDispatch(request: FrozenCustomerCreation): Promise<FrozenCustomerCreation>;
  /** Recheck actor/intent/source identity; atomically save the verified mapping and its audit. */
  finalise(request: FrozenCustomerCreation, contactId: string): Promise<void>;
};
export type CustomerCreationProvider = {
  findByNumber(tenantId: string, contactNumber: string): Promise<readonly unknown[]>;
  findByName(tenantId: string, name: string): Promise<readonly unknown[]>;
  read(tenantId: string, contactId: string): Promise<unknown>;
  create(request: FrozenCustomerCreation): Promise<{ contactId: string }>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export function newXeroCustomer(input: CustomerCreationInput): XeroNewCustomer {
  if (!uuid.test(input.tenantId) || !uuid.test(input.sourceContactId)) throw new Error('INVALID_CUSTOMER_IDENTITY');
  // Name-only creation deliberately excludes email, addresses and banking fields.
  // Finance must review this normalised name before a durable intent is prepared.
  if (typeof input.name !== 'string' || /[<>\u0000-\u001f\u007f]/.test(input.name)) throw new Error('INVALID_CUSTOMER_NAME');
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 255) throw new Error('INVALID_CUSTOMER_NAME');
  return { Name: name, ContactNumber: `SP-${input.sourceContactId.toLowerCase()}` };
}

export function validateCustomerRequest(request: FrozenCustomerCreation): void {
  const customer = newXeroCustomer({ tenantId: request.tenantId, sourceContactId: request.sourceContactId, name: request.customer.Name });
  if (JSON.stringify(request.customer) !== JSON.stringify(customer)
    || request.body !== JSON.stringify({ Contacts: [customer] }) || request.bodyHash !== hash(request.body)
    || !/^[a-zA-Z0-9._:-]{16,128}$/.test(request.idempotencyKey)
    || !Number.isSafeInteger(request.preparedAt) || !Number.isSafeInteger(request.expiresAt)
    || request.preparedAt < 0 || request.expiresAt <= request.preparedAt
    || request.expiresAt - request.preparedAt > 300_000
    || typeof request.dispatchStarted !== 'boolean'
    || (request.providerContactId !== null && !uuid.test(request.providerContactId))) throw new Error('INVALID_FROZEN_CUSTOMER_REQUEST');
}

function verifiedContact(request: FrozenCustomerCreation, evidence: unknown): string {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) throw new Error('XERO_CUSTOMER_CONFLICT');
  const row = evidence as Record<string, unknown>;
  if (typeof row.ContactID !== 'string' || !uuid.test(row.ContactID)
    || row.Name !== request.customer.Name || row.ContactNumber !== request.customer.ContactNumber
    || row.ContactStatus !== 'ACTIVE' || row.MergedToContactID || row.HasValidationErrors === true
    || row.HasErrors === true || (Array.isArray(row.ValidationErrors) && row.ValidationErrors.length > 0)
    || (request.providerContactId !== null && request.providerContactId !== row.ContactID)) throw new Error('XERO_CUSTOMER_CONFLICT');
  return row.ContactID;
}

/** Caller must supply a persisted, actor-authorised repository, never an in-memory production intent. */
export async function executeCustomerCreation(input: CustomerCreationInput, repository: CustomerCreationRepository,
  provider: CustomerCreationProvider, now: () => number = Date.now): Promise<{ contactId: string }> {
  const customer = newXeroCustomer(input);
  let request = await repository.prepare(input, customer);
  validateCustomerRequest(request);
  if (request.tenantId !== input.tenantId || request.sourceContactId !== input.sourceContactId
    || JSON.stringify(request.customer) !== JSON.stringify(customer) || request.preparedAt > now()) throw new Error('INVALID_FROZEN_CUSTOMER_REQUEST');
  const candidates = request.providerContactId
    ? [await provider.read(request.tenantId, request.providerContactId)]
    : await provider.findByNumber(request.tenantId, customer.ContactNumber);
  if (candidates.length) {
    // The stable number helps recovery; it is not permission to adopt another record.
    if (!request.dispatchStarted || candidates.length !== 1) throw new Error('XERO_EXISTING_CUSTOMER_REVIEW');
    const contactId = verifiedContact(request, candidates[0]);
    await repository.finalise(request, contactId);
    return { contactId };
  }
  if (request.providerContactId) throw new Error('XERO_CUSTOMER_CONFLICT');
  if (now() + 15_000 >= request.expiresAt) throw new Error('CUSTOMER_IDEMPOTENCY_WINDOW_EXPIRED');
  // Any exact-name record, including archived/merged contacts, needs explicit mapping review.
  if ((await provider.findByName(request.tenantId, customer.Name)).length) throw new Error('XERO_EXISTING_CUSTOMER_REVIEW');
  const original = request;
  request = await repository.beginDispatch(request);
  validateCustomerRequest(request);
  if (request.body !== original.body || request.bodyHash !== original.bodyHash || request.tenantId !== original.tenantId
    || request.sourceContactId !== original.sourceContactId || request.idempotencyKey !== original.idempotencyKey
    || request.preparedAt !== original.preparedAt || request.expiresAt !== original.expiresAt
    || request.providerContactId !== original.providerContactId
    || !request.dispatchStarted || request.preparedAt > now()) throw new Error('INVALID_FROZEN_CUSTOMER_REQUEST');
  if (now() + 15_000 >= request.expiresAt) throw new Error('CUSTOMER_IDEMPOTENCY_WINDOW_EXPIRED');
  let created: { contactId: string };
  try { created = await provider.create(request); }
  catch { throw new Error('XERO_CUSTOMER_OUTCOME_UNCERTAIN'); }
  const evidence = await provider.read(request.tenantId, created.contactId);
  const contactId = verifiedContact(request, evidence);
  if (contactId !== created.contactId) throw new Error('XERO_CUSTOMER_CONFLICT');
  await repository.finalise(request, contactId);
  return { contactId };
}
