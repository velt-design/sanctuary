import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { executeCustomerCreation, newXeroCustomer, type FrozenCustomerCreation } from './customerCreation';

const input = { tenantId: '11111111-1111-4111-8111-111111111111',
  sourceContactId: '22222222-2222-4222-8222-222222222222', name: 'Test Customer' };
const contactId = '33333333-3333-4333-8333-333333333333';
const now = 1_000_000;
function setup(changes: Partial<FrozenCustomerCreation> = {}) {
  const customer = newXeroCustomer(input); const body = JSON.stringify({ Contacts: [customer] });
  const request: FrozenCustomerCreation = { ...input, customer, body, bodyHash: createHash('sha256').update(body).digest('hex'),
    idempotencyKey: 'customer-synthetic-request', preparedAt: now, expiresAt: now + 300_000,
    dispatchStarted: false, providerContactId: null, ...changes };
  const evidence = { ContactID: contactId, ...customer, ContactStatus: 'ACTIVE' };
  const repo = { prepare: vi.fn().mockResolvedValue(request),
    beginDispatch: vi.fn().mockResolvedValue({ ...request, dispatchStarted: true }), finalise: vi.fn() };
  const provider = { findByNumber: vi.fn().mockResolvedValue([]), findByName: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ contactId }), read: vi.fn().mockResolvedValue(evidence) };
  return { request, evidence, repo, provider, run: () => executeCustomerCreation(input, repo, provider, () => now) };
}
describe('new Xero customer intent', () => {
  it('normalises a reviewed name and uses stable portal identity, with no copied email or bank fields', () => {
    expect(newXeroCustomer({ ...input, name: '  Test   Customer  ' })).toEqual({ Name: 'Test Customer', ContactNumber: `SP-${input.sourceContactId}` });
    for (const name of ['', ' ', '<Customer>', 'Customer\nName', 'a'.repeat(256)]) {
      expect(() => newXeroCustomer({ ...input, name })).toThrow('INVALID_CUSTOMER_NAME');
    }
    expect(() => newXeroCustomer({ ...input, sourceContactId: 'not-an-id' })).toThrow('INVALID_CUSTOMER_IDENTITY');
  });
  it('checks existing records, commits dispatch, creates once, rereads and only then finalises', async () => {
    const s = setup(); expect(await s.run()).toEqual({ contactId });
    expect(s.provider.findByNumber).toHaveBeenCalledWith(input.tenantId, s.request.customer.ContactNumber);
    expect(s.provider.findByName).toHaveBeenCalledWith(input.tenantId, input.name);
    expect(s.provider.create).toHaveBeenCalledExactlyOnceWith({ ...s.request, dispatchStarted: true });
    expect(s.provider.read).toHaveBeenCalledExactlyOnceWith(input.tenantId, contactId);
    expect(s.repo.finalise).toHaveBeenCalledExactlyOnceWith({ ...s.request, dispatchStarted: true }, contactId);
    expect(s.repo.beginDispatch.mock.invocationCallOrder[0]).toBeLessThan(s.provider.create.mock.invocationCallOrder[0]);
    expect(s.provider.read.mock.invocationCallOrder[0]).toBeLessThan(s.repo.finalise.mock.invocationCallOrder[0]);
  });
  it('never adopts pre-existing identities or exact names, even when their content looks right', async () => {
    for (const lookup of ['findByNumber', 'findByName'] as const) {
      const s = setup(); s.provider[lookup].mockResolvedValue([s.evidence]);
      await expect(s.run()).rejects.toThrow('XERO_EXISTING_CUSTOMER_REVIEW');
      expect(s.provider.create).not.toHaveBeenCalled(); expect(s.repo.finalise).not.toHaveBeenCalled();
    }
  });
  it('recovers an exact previously dispatched customer after key expiry without another write', async () => {
    const s = setup({ preparedAt: now - 400_000, expiresAt: now - 100_000, dispatchStarted: true });
    s.provider.findByNumber.mockResolvedValue([s.evidence]);
    expect(await s.run()).toEqual({ contactId });
    expect(s.provider.create).not.toHaveBeenCalled(); expect(s.repo.beginDispatch).not.toHaveBeenCalled();
  });
  it('stops an expired uncertain attempt when no customer can be recovered', async () => {
    const s = setup({ preparedAt: now - 400_000, expiresAt: now - 100_000, dispatchStarted: true });
    await expect(s.run()).rejects.toThrow('CUSTOMER_IDEMPOTENCY_WINDOW_EXPIRED');
    expect(s.provider.create).not.toHaveBeenCalled(); expect(s.repo.beginDispatch).not.toHaveBeenCalled();
  });
  it('refuses ambiguous, archived, merged, changed and invalid recovery evidence', async () => {
    const variants = [{ Name: 'Changed' }, { ContactNumber: 'Another integration' }, { ContactStatus: 'ARCHIVED' },
      { MergedToContactID: contactId }, { HasValidationErrors: true }, { ValidationErrors: [{ Message: 'bad' }] }];
    for (const change of variants) {
      const s = setup({ dispatchStarted: true }); s.provider.findByNumber.mockResolvedValue([{ ...s.evidence, ...change }]);
      await expect(s.run()).rejects.toThrow('XERO_CUSTOMER_CONFLICT');
      expect(s.repo.finalise).not.toHaveBeenCalled(); expect(s.provider.create).not.toHaveBeenCalled();
    }
    const s = setup({ dispatchStarted: true }); s.provider.findByNumber.mockResolvedValue([s.evidence, s.evidence]);
    await expect(s.run()).rejects.toThrow('XERO_EXISTING_CUSTOMER_REVIEW');
  });
  it('does not finalise a creation response until an independent matching record is read', async () => {
    const s = setup(); s.provider.read.mockResolvedValue({ ...s.evidence, ContactID: input.sourceContactId });
    await expect(s.run()).rejects.toThrow('XERO_CUSTOMER_CONFLICT'); expect(s.repo.finalise).not.toHaveBeenCalled();
  });
  it('preserves uncertain provider outcomes and permits only the same frozen retry', async () => {
    const s = setup(); s.provider.create.mockRejectedValueOnce(new Error('timeout with private details'));
    await expect(s.run()).rejects.toThrow('XERO_CUSTOMER_OUTCOME_UNCERTAIN'); expect(s.repo.finalise).not.toHaveBeenCalled();
    s.repo.prepare.mockResolvedValue({ ...s.request, dispatchStarted: true });
    await s.run();
    expect(s.provider.create.mock.calls[1][0].body).toBe(s.provider.create.mock.calls[0][0].body);
    expect(s.provider.create.mock.calls[1][0].idempotencyKey).toBe(s.provider.create.mock.calls[0][0].idempotencyKey);
  });
  it('refuses altered requests, extended windows and future preparation before provider reads', async () => {
    for (const change of [{ body: '{}' }, { bodyHash: 'a'.repeat(64) }, { expiresAt: now + 360_000 },
      { preparedAt: now + 1 }, { tenantId: contactId }, { idempotencyKey: 'short' }]) {
      const s = setup(change); await expect(s.run()).rejects.toThrow('INVALID_FROZEN_CUSTOMER_REQUEST');
      expect(s.provider.findByNumber).not.toHaveBeenCalled();
    }
  });
  it('refuses a changed dispatch key or expiry and expiry during the preflight reads', async () => {
    for (const change of [{ idempotencyKey: 'replacement-synthetic-key' }, { expiresAt: now + 290_000 }, { dispatchStarted: false }]) {
      const s = setup(); s.repo.beginDispatch.mockResolvedValue({ ...s.request, dispatchStarted: true, ...change });
      await expect(s.run()).rejects.toThrow('INVALID_FROZEN_CUSTOMER_REQUEST'); expect(s.provider.create).not.toHaveBeenCalled();
    }
    const s = setup(); const clock = vi.fn().mockReturnValueOnce(now).mockReturnValueOnce(now).mockReturnValue(now + 299_000);
    await expect(executeCustomerCreation(input, s.repo, s.provider, clock)).rejects.toThrow('CUSTOMER_IDEMPOTENCY_WINDOW_EXPIRED');
    expect(s.provider.create).not.toHaveBeenCalled();
  });
});
