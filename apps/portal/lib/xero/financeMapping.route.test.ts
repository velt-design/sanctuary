import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), origin: vi.fn(), context: vi.fn(), status: vi.fn(), save: vi.fn(), setup: vi.fn(), resume: vi.fn(), accounting: vi.fn(), contact: vi.fn(), contacts: vi.fn() }));
vi.mock('./pilotAccess', () => ({ getPaymentPilotSession: mocks.session }));
vi.mock('./http', () => ({ sameOrigin: mocks.origin, json: (body: unknown, status = 200) => Response.json(body, { status }) }));
vi.mock('./security', () => ({ config: () => ({ tenantId: '11111111-1111-4111-8111-111111111111' }) }));
vi.mock('../invoices/financeMappingRepository', () => ({ financeMappingContext: mocks.context, financeMappingStatus: mocks.status, saveFinanceMapping: mocks.save, saveFinanceSetup: mocks.setup, resumeFinanceTransfer: mocks.resume }));
vi.mock('./financeMappingProvider', () => ({ financeMappingProvider: { accounting: mocks.accounting, contact: mocks.contact, contacts: mocks.contacts } }));
import { POST } from '../../app/api/payments/xero/mapping/route';
const id = '11111111-1111-4111-8111-111111111111';
afterEach(() => vi.unstubAllEnvs());
const confirmation = { action: 'confirm', commandId: id, invoiceId: id, sourceContactId: id, contactId: id, accountCode: '475', taxType: 'TAX001', confirmed: true };
const request = (body: unknown) => new Request('https://portal.example.test/api/payments/xero/mapping', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks(); mocks.session.mockResolvedValue({ user: { id } }); mocks.origin.mockReturnValue(true);
  mocks.context.mockResolvedValue({ invoiceId: id, invoiceRef: 'INV-TEST', customerName: 'Synthetic', sourceContactId: id, subtotalCents: 100, taxCents: 15 });
  mocks.accounting.mockResolvedValue({ accounts: [{ id, code: '475', name: 'Sales' }], taxes: [{ type: 'TAX001', name: 'GST', effectiveRate: 15 }] });
  mocks.contact.mockResolvedValue({ id, name: 'Synthetic', email: '' }); mocks.status.mockResolvedValue({ link: null, defaults: null }); mocks.contacts.mockResolvedValue({ contacts: [], limited: false });
});
it('denies missing finance permission or foreign origin before provider reads', async () => {
  mocks.session.mockResolvedValueOnce(null);
  expect((await POST(request(confirmation))).status).toBe(403);
  mocks.origin.mockReturnValue(false);
  expect((await POST(request(confirmation))).status).toBe(403);
  expect(mocks.accounting).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
});
it('rejects forged actor fields and missing explicit confirmation', async () => {
  expect((await POST(request({ ...confirmation, actor: 'other' }))).status).toBe(400);
  expect((await POST(request({ ...confirmation, confirmed: false }))).status).toBe(400);
  expect(mocks.context).not.toHaveBeenCalled();
});
it('verifies fresh account, tax and exact contact before saving server-owned evidence', async () => {
  expect((await POST(request(confirmation))).status).toBe(200);
  expect(mocks.contact).toHaveBeenCalledWith(id, id);
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ actor: id, tenantId: id, proof: { contact: { id, name: 'Synthetic', email: '' },
    account: { id, code: '475', name: 'Sales' }, tax: { type: 'TAX001', name: 'GST', effectiveRate: 15 } } }));
});
it('refuses tax mismatch and changed portal identity without saving', async () => {
  mocks.accounting.mockResolvedValue({ accounts: [{ code: '475' }], taxes: [{ type: 'TAX001', effectiveRate: 10 }] });
  expect((await POST(request(confirmation))).status).toBe(409);
  mocks.context.mockResolvedValue({ sourceContactId: 'different' });
  expect((await POST(request(confirmation))).status).toBe(409);
  expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.contact).not.toHaveBeenCalled();
});
it('requires activation and explicit confirmation before resuming only the server-pinned invoice transfer', async () => {
  const body = { action: 'resume', invoiceId: id, confirmed: true };
  vi.stubEnv('XERO_INVOICE_TRANSFERS_ENABLED', 'false');
  expect((await POST(request(body))).status).toBe(409); expect(mocks.resume).not.toHaveBeenCalled();
  vi.stubEnv('XERO_INVOICE_TRANSFERS_ENABLED', 'true');
  mocks.resume.mockResolvedValue({ state: 'queued' });
  expect((await POST(request(body))).status).toBe(200);
  expect(mocks.resume).toHaveBeenCalledWith(id, id, id);
  expect(mocks.accounting).not.toHaveBeenCalled();
});

it('explains missing portal details before making any Xero request',async()=>{
 mocks.context.mockRejectedValue(new Error('XERO_MAPPING_DETAILS_REQUIRED'));
 const response=await POST(request({action:'inspect',invoiceId:id}));
 expect(response.status).toBe(409);expect((await response.json()).error).toContain('linked portal customer');
 expect(mocks.accounting).not.toHaveBeenCalled();expect(mocks.save).not.toHaveBeenCalled();
});
it('returns the saved customer by ID even when their name has changed, without writing', async () => {
 mocks.status.mockResolvedValue({ link: { contactId: id, verifiedAt: '2026-09-15' }, defaults: null });
 mocks.contact.mockResolvedValue({ id, name: 'Renamed customer', email: 'example@example.test' });
 const response=await POST(request({action:'inspect',invoiceId:id}));
 const data=await response.json();
 expect(data.savedLink.contact.name).toBe('Renamed customer');
 expect(data.contacts[0].id).toBe(id);
 expect(data.customerCreationEnabled).toBe(false);
 expect(mocks.save).not.toHaveBeenCalled();
});
it('retains a saved link when provider verification fails and refuses to report missing status as unlinked', async () => {
 mocks.status.mockResolvedValue({ link: { contactId: id, verifiedAt: '2026-09-15' }, defaults: null });
 mocks.contact.mockRejectedValue(new Error('unavailable'));
 const data=await (await POST(request({action:'inspect',invoiceId:id}))).json();
 expect(data.savedLink.contact).toBeNull();
 expect(data.customerCreationEnabled).toBe(false);
 mocks.status.mockRejectedValue(new Error('missing database contract'));
 expect((await POST(request({action:'inspect',invoiceId:id}))).status).toBe(503);
});
it('saves customer links without reading or changing accounting defaults', async () => {
 const response=await POST(request({action:'confirmCustomer',commandId:id,invoiceId:id,sourceContactId:id,contactId:id,confirmed:true}));
 expect(response.status).toBe(200);
 expect(mocks.accounting).not.toHaveBeenCalled();
 expect(mocks.setup).toHaveBeenCalledWith(expect.objectContaining({kind:'customer',proof:{id,name:'Synthetic',email:''}}));
 expect(mocks.save).not.toHaveBeenCalled();
});
it('saves company defaults without reading or changing the customer link', async () => {
 const response=await POST(request({action:'confirmDefaults',commandId:id,invoiceId:id,sourceContactId:id,accountCode:'475',taxType:'TAX001',confirmed:true}));
 expect(response.status).toBe(200);
 expect(mocks.contact).not.toHaveBeenCalled();
 expect(mocks.setup).toHaveBeenCalledWith(expect.objectContaining({kind:'defaults'}));
 expect(mocks.save).not.toHaveBeenCalled();
});
