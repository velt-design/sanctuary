import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import MappingReview from './MappingReview';
const id = '11111111-1111-4111-8111-111111111111';
const review = { context: { sourceContactId: id, invoiceRef: 'INV-TEST', customerName: 'Example' }, contacts: [],
  defaults: null, savedLink: null, accounts: [], taxes: [], limited: false, checkedAt: '2026-09-14T00:00:00Z', customerCreationEnabled: true };
let view: ReturnType<typeof renderIntoDocument> | undefined;
afterEach(() => { view?.unmount(); vi.unstubAllGlobals(); });
const button = (label: string) => [...view!.container.querySelectorAll('button')].find(item => item.textContent === label);
async function inspect() { await act(async () => {}); }
it('exposes customer creation only when enabled and the lookup has no customer candidates', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ...review, customerCreationEnabled: false })));
  view = renderIntoDocument(<MappingReview invoiceId={id} initialContext={review.context} />); await inspect();
  expect(button('Create Xero customer')).toBeUndefined();
});
it('requires confirmation, then offers the verified new customer for account/tax mapping', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(review))
    .mockResolvedValueOnce(Response.json({ contact: { id, name: 'Example', email: '' } }));
  vi.stubGlobal('fetch', fetcher); view = renderIntoDocument(<MappingReview invoiceId={id} initialContext={review.context} />); await inspect();
  const form = button('Create Xero customer')!.closest('form')!;
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => form.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(fetcher.mock.calls[1][0]).toBe('/api/payments/xero/customers');
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ invoiceId: id, sourceContactId: id, name: 'Example', confirmed: true });
  expect(view.container.querySelector('select[name="contactId"]')!.textContent).toContain('Example');
  expect(view.container.textContent).toContain('Xero customer verified');
  expect(button('Create Xero customer')).toBeUndefined();
});
it('keeps the same reviewed name after a lost response so retry uses the durable intent', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(review)).mockRejectedValueOnce(new Error('Connection interrupted'))
    .mockResolvedValueOnce(Response.json({ contact: { id, name: 'Example', email: '' } }));
  vi.stubGlobal('fetch', fetcher); view = renderIntoDocument(<MappingReview invoiceId={id} initialContext={review.context} />); await inspect();
  const form = button('Create Xero customer')!.closest('form')!;
  await act(async () => form.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(view.container.textContent).toContain('Connection interrupted');
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(fetcher.mock.calls[2][1].body).toBe(fetcher.mock.calls[1][1].body);
});
it('shows invoice context while automatically checking and never confirms a mapping on load', async () => {
  let resolve!: (value: Response) => void;
  const fetcher = vi.fn().mockReturnValue(new Promise<Response>(done => { resolve = done; }));
  vi.stubGlobal('fetch', fetcher);
  view = renderIntoDocument(<MappingReview invoiceId={id} initialContext={review.context} />);
  expect(view.container.textContent).toContain('INV-TEST');
  expect(view.container.textContent).toContain('Checking customer and accounting details');
  expect(button('Check Xero records')!.disabled).toBe(true);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ action: 'inspect', invoiceId: id });
  await act(async () => resolve(Response.json(review)));
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(button('Check Xero records')!.disabled).toBe(false);
});
it('keeps invoice context after a failed initial check and supports an explicit retry', async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(Response.json(review));
  vi.stubGlobal('fetch', fetcher);
  view = renderIntoDocument(<MappingReview invoiceId={id} initialContext={review.context} />); await inspect();
  expect(view.container.textContent).toContain('INV-TEST');
  expect(view.container.textContent).toContain('Xero details could not be loaded');
  await act(async () => button('Check Xero records')!.click());
  expect(button('Create Xero customer')).toBeDefined();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('shows an existing link and preselects only the verified saved customer', async () => {
 const contact={id,name:'Renamed Example',email:'example@example.test'};
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({...review,contacts:[contact],savedLink:{contactId:id,verifiedAt:'2026-09-15',contact},customerCreationEnabled:false})));
 view=renderIntoDocument(<MappingReview invoiceId={id} initialContext={review.context} />); await inspect();
 expect(view.container.textContent).toContain('Customer already linked to Xero');
 expect(view.container.querySelector<HTMLSelectElement>('select[name="contactId"]')!.value).toBe(id);
 expect(button('Create Xero customer')).toBeUndefined();
});
it('does not describe an unverifiable saved link as an unlinked customer', async () => {
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({...review,savedLink:{contactId:id,verifiedAt:'2026-09-15',contact:null},customerCreationEnabled:false})));
 view=renderIntoDocument(<MappingReview invoiceId={id} initialContext={review.context} />); await inspect();
 expect(view.container.textContent).toContain('Saved customer link needs checking');
 expect(view.container.textContent).not.toContain('Customer not yet linked');
 expect(button('Create Xero customer')).toBeUndefined();
});
it('customer approval submits no company default fields', async () => {
 const contact={id,name:'Example',email:''};
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({...review,contacts:[contact]})).mockResolvedValueOnce(Response.json({saved:true}));
 vi.stubGlobal('fetch',fetcher);
 view=renderIntoDocument(<MappingReview invoiceId={id} initialContext={review.context} />); await inspect();
 const form=button('Save customer link')!.closest('form')!;
 form.querySelector<HTMLSelectElement>('select')!.value=id;
 await act(async()=>form.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
 await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 const body=JSON.parse(fetcher.mock.calls[1][1].body);
 expect(body.action).toBe('confirmCustomer'); expect(body.contactId).toBe(id);
 expect(body).not.toHaveProperty('accountCode'); expect(body).not.toHaveProperty('taxType');
 expect(view.container.textContent).toContain('Company accounting defaults are unchanged');
});
it('company default approval submits no customer choice', async () => {
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({...review,accounts:[{id,code:'200',name:'Sales'}],taxes:[{type:'OUTPUT2',name:'GST',effectiveRate:15}]})).mockResolvedValueOnce(Response.json({saved:true}));
 vi.stubGlobal('fetch',fetcher);
 view=renderIntoDocument(<MappingReview invoiceId={id} initialContext={review.context} />); await inspect();
 const form=button('Save company defaults')!.closest('form')!;
 form.querySelector<HTMLSelectElement>('select[name="accountCode"]')!.value='200';
 form.querySelector<HTMLSelectElement>('select[name="taxType"]')!.value='OUTPUT2';
 await act(async()=>form.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
 await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 const body=JSON.parse(fetcher.mock.calls[1][1].body);
 expect(body.action).toBe('confirmDefaults'); expect(body).not.toHaveProperty('contactId');
 expect(view.container.textContent).toContain('Customer links and existing invoices are unchanged');
});

it.each(['customer', 'defaults'] as const)('offers resume only after both prerequisites are saved, starting with %s', async first => {
 const contact={id,name:'Example',email:''};
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({...review,contacts:[contact],accounts:[{id,code:'200',name:'Sales'}],taxes:[{type:'OUTPUT2',name:'GST',effectiveRate:15}]})).mockImplementation(async()=>Response.json({saved:true}));
 vi.stubGlobal('fetch',fetcher);
 view=renderIntoDocument(<MappingReview invoiceId={id} initialContext={review.context} />); await inspect();
 const save=async(kind:'customer'|'defaults')=>{
  const form=button(kind==='customer'?'Save customer link':'Save company defaults')!.closest('form')!;
  if(kind==='customer') form.querySelector<HTMLSelectElement>('select[name="contactId"]')!.value=id;
  else {form.querySelector<HTMLSelectElement>('select[name="accountCode"]')!.value='200';form.querySelector<HTMLSelectElement>('select[name="taxType"]')!.value='OUTPUT2';}
  await act(async()=>form.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 };
 await save(first);
 expect(button('Resume existing invoice transfer')).toBeUndefined();
 await save(first==='customer'?'defaults':'customer');
 expect(button('Resume existing invoice transfer')).toBeDefined();
 expect(fetcher.mock.calls.map(call=>JSON.parse(call[1].body).action)).toEqual(['inspect',first==='customer'?'confirmCustomer':'confirmDefaults',first==='customer'?'confirmDefaults':'confirmCustomer']);
});
