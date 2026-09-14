import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({enabled:vi.fn(),session:vi.fn(),origin:vi.fn(),review:vi.fn(),approve:vi.fn(),find:vi.fn(),reverse:vi.fn()}));
vi.mock('@/lib/xero/pilotAccess',()=>({paymentPilotEnabled:mocks.enabled,getPaymentPilotSession:mocks.session}));
vi.mock('@/lib/xero/http',()=>({sameOrigin:mocks.origin,json:(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}})}));
vi.mock('@/lib/xero/paymentPilot',()=>({reviewPilotDeposit:mocks.review,approvePilotDeposit:mocks.approve}));
vi.mock('@/lib/invoices/xeroMatchRepository',()=>({findPilotMatch:mocks.find,reversePilotMatch:mocks.reverse}));
import { POST } from './route';
const id='11111111-1111-4111-8111-111111111111';
const post=(body:unknown)=>POST(new Request('https://portal.example/api/payments/xero',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
beforeEach(()=>{vi.resetAllMocks();mocks.enabled.mockReturnValue(true);mocks.origin.mockReturnValue(true);mocks.session.mockResolvedValue({user:{id}});mocks.approve.mockResolvedValue({matchId:id});});
describe('payment pilot command authorization',()=>{
  it.each(['Li', 'ABC (NZ) Ltd', 'A'.repeat(240)])('passes valid contact names to review: %s',async contactName=>{
    mocks.review.mockResolvedValue({suggestions:[]});
    expect((await post({action:'review',invoiceRef:'INV-0033',contactName})).status).toBe(200);
    expect(mocks.review).toHaveBeenCalledWith('INV-0033',contactName,id);
  });
  it('rejects oversized contact searches before provider access',async()=>{
    expect((await post({action:'review',invoiceRef:'INV-0033',contactName:'A'.repeat(241)})).status).toBe(400);
    expect(mocks.review).not.toHaveBeenCalled();
  });
  it('stays dark without touching credentials or accounting',async()=>{
    mocks.enabled.mockReturnValue(false);expect((await post({action:'review',invoiceRef:'INV-0033'})).status).toBe(404);
    expect(mocks.session).not.toHaveBeenCalled();expect(mocks.review).not.toHaveBeenCalled();
  });
  it.each(['session','origin'])('denies a missing %s before reading or writing records',async boundary=>{
    mocks[boundary as 'session'|'origin'].mockReturnValue(null);
    expect((await post({action:'approve',confirmed:true,approvalToken:'example'})).status).toBe(403);
    expect(mocks.approve).not.toHaveBeenCalled();
  });
  it.each([{action:'approve',approvalToken:'example'}, {action:'reverse',matchId:id,reason:'mistake'}, {action:'reverse',confirmed:true,matchId:id,reason:'x'}, {action:'status',approvalId:'bad'}, {action:'review',invoiceRef:'not-an-invoice'}])('rejects an incomplete request %j',async body=>{
    expect((await post(body)).status).toBe(400);expect(mocks.approve).not.toHaveBeenCalled();expect(mocks.reverse).not.toHaveBeenCalled();
  });
  it('binds approval to the authenticated identity, not a supplied actor',async()=>{
    const response=await post({action:'approve',confirmed:true,approvalToken:'example',actor:'another-user'});
    expect(response.status).toBe(200);expect(mocks.approve).toHaveBeenCalledWith('example',id);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });
  it('does not disclose another approver’s recovery record',async()=>{
    mocks.find.mockResolvedValue({approvedBy:'another-user',amountCents:100});
    expect(await (await post({action:'status',approvalId:id})).json()).toEqual({match:null});
  });
  it('keeps an uncertain result explicit without exposing database or provider errors',async()=>{
    mocks.approve.mockRejectedValue(new Error('private provider details'));
    const response=await post({action:'approve',confirmed:true,approvalToken:'example'});
    expect(response.status).toBe(503);const body=await response.json();
    expect(body.error).toContain('could not be confirmed');expect(body.error).not.toContain('private');
  });
  it('reports changed evidence as requiring review',async()=>{
    mocks.approve.mockRejectedValue(new Error('APPROVAL_EVIDENCE_CHANGED'));
    expect((await post({action:'approve',confirmed:true,approvalToken:'example'})).status).toBe(409);
  });
});
