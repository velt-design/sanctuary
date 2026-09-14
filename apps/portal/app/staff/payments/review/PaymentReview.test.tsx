import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import PaymentReview from './PaymentReview';
let view: ReturnType<typeof renderIntoDocument> | undefined;
const result={context:{invoice:{projectId:'example',invoiceRef:'INV-0001',projectName:'Example Project',status:'OPEN',totalIncGstCents:10000},matchedCents:0,customerWon:false},checkedAt:'2026-09-14T00:00:00Z',limited:false,matches:[],suggestions:[{receipt:{id:'receipt',contact:'Example Customer',date:'2026-09-01',currency:'NZD',status:'AUTHORISED',reconciled:true,reference:''},amountCents:4000,reasons:['Partial deposit'],blockers:[],depositRemainingIfApprovedCents:6000,approvalToken:'reviewed-token',approvalId:'reviewed-id'}]};
beforeEach(()=>{sessionStorage.clear();Object.assign(result,{notes:[]});});
afterEach(()=>{view?.unmount();vi.unstubAllGlobals();});
async function submit(form:HTMLFormElement){await act(async()=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});}
async function search(){const input=view!.container.querySelector<HTMLInputElement>('[name="invoiceRef"]')!;input.value='INV-0001';await submit(view!.container.querySelector('form')!);}
function button(text:string){return [...view!.container.querySelectorAll('button')].find(b=>b.textContent?.includes(text))!;}
describe('finance deposit approval screen',()=>{
  it('requires exact confirmation and shows the partial-deposit outcome before writing',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(Response.json(result)).mockResolvedValueOnce(Response.json({matchId:'reviewed-id'}));
    vi.stubGlobal('fetch',fetcher);view=renderIntoDocument(<PaymentReview/>);await search();
    expect(view.container.textContent).toContain('leave $60.00');expect(view.container.textContent).toContain('Whole invoice status: OPEN');
    const form=button('Approve this deposit match').closest('form')!;
    await submit(form);expect(fetcher).toHaveBeenCalledTimes(1);
    form.querySelector<HTMLInputElement>('[name="confirmed"]')!.checked=true;
    await submit(form);expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({action:'approve',confirmed:true,approvalToken:'reviewed-token'});
    expect(view.container.textContent).toContain('Deposit recorded: $40.00. Customer won.');
    expect(sessionStorage.getItem('sanctuary.deposit-review.pending-id')).toBeNull();
    expect(view.container.textContent).not.toContain('Approve this deposit match');
  });
  it('preserves a recovery reference after a lost response and checks status without another approval',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(Response.json(result)).mockRejectedValueOnce(new Error('Network interrupted')).mockResolvedValueOnce(Response.json({match:{amountCents:4000,reversedAt:null}}));
    vi.stubGlobal('fetch',fetcher);view=renderIntoDocument(<PaymentReview/>);await search();
    const form=button('Approve this deposit match').closest('form')!;form.querySelector<HTMLInputElement>('input')!.checked=true;await submit(form);
    expect(sessionStorage.getItem('sanctuary.deposit-review.pending-id')).toBe('reviewed-id');
    await act(async()=>button('Check approval result').click());
    expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({action:'status',approvalId:'reviewed-id'});
    expect(view.container.textContent).toContain('Already recorded: $40.00');
  });
  it('never offers approval for a blocked suggestion',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({...result,suggestions:[{...result.suggestions[0],blockers:['Existing payment history'],approvalToken:null,approvalId:null}]})));
    view=renderIntoDocument(<PaymentReview/>);await search();
    expect(view.container.textContent).toContain('Investigation required');expect(button('Approve this deposit match')).toBeUndefined();
  });
  it('requires a reason and explicit confirmation to reverse a recorded match',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(Response.json({...result,suggestions:[],matches:[{id:'match',amountCents:4000,receiptDate:'2026-09-01',approvedAt:'2026-09-14T00:00:00Z',reversedAt:null}]})).mockResolvedValueOnce(Response.json({reversed:true}));
    vi.stubGlobal('fetch',fetcher);view=renderIntoDocument(<PaymentReview/>);await search();
    const form=button('Reverse this match').closest('form')!;await submit(form);expect(fetcher).toHaveBeenCalledTimes(1);
    form.querySelector<HTMLTextAreaElement>('textarea')!.value='Wrong project';form.querySelector<HTMLInputElement>('input')!.checked=true;await submit(form);
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({action:'reverse',confirmed:true,matchId:'match',reason:'Wrong project'});
    expect(view.container.textContent).toContain('Xero is unchanged');
  });
});
