import React, { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
async function render(element: React.ReactNode) { document.body.innerHTML='<div id="test"></div>'; root=createRoot(document.getElementById('test')!); await act(async()=>{root.render(element);}); }
function cleanup() { if(root) act(()=>root.unmount()); }
const byText=(text:string)=>Array.from(document.querySelectorAll('*')).find(el=>el.textContent===text && !Array.from(el.children).some(child=>child.textContent===text)) as HTMLElement | undefined;
const screen={ queryByText:(text:string)=>byText(text)??null, getByText:(text:string)=>byText(text)!, findByText:async(text:string)=>{await vi.waitFor(()=>expect(byText(text)).toBeTruthy());return byText(text)!;}, findByRole:async(role:string)=>{await vi.waitFor(()=>expect(document.querySelector(`[role="${role}"]`)).toBeTruthy());}, getByLabelText:(text:string)=>Array.from(document.querySelectorAll('label')).find(el=>el.firstChild?.textContent?.trim()===text)?.querySelector('input,textarea,select') as HTMLInputElement };
const fireEvent={click:async(el:HTMLElement)=>{await act(async()=>el.click());},change:async(el:HTMLInputElement,{target}:{target:{value:string}})=>{await act(async()=>{Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value')!.set!.call(el,target.value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));});}};
const waitFor=vi.waitFor;
import InstallerPayoutPage from './InstallerPayoutPage';
vi.mock('@/components/ui/foundation',()=>({
  Button: ({children,...props}: React.ButtonHTMLAttributes<HTMLButtonElement>)=><button {...props}>{children}</button>,
  ButtonLink: ({children,href}: {children: React.ReactNode;href:string})=><a href={href}>{children}</a>,
  Input: ({label,...props}: React.InputHTMLAttributes<HTMLInputElement>&{label:string})=><label>{label}<input {...props}/></label>,
  Textarea: ({label,...props}: React.TextareaHTMLAttributes<HTMLTextAreaElement>&{label:string})=><label>{label}<textarea {...props}/></label>,
}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const agreement = {id:'a',sequence:1,kind:'agreement',created_at:'2026-09-11T00:00:00Z',created_by:'admin',payload:{installer:'Crew',scope:'Install frame',exclusions:'Electrical work',paymentTerms:'On completion',acceptanceReference:'Email',gstRegistered:true,sourceQuoteId:'Q1',sourceEstimateId:'E1',payoutExGst:1886.96,gst:283.04,totalPayable:2170}};
it('staff can review the confirmed sheet but cannot edit',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({events:[agreement],canEdit:false})));
  await render(<InstallerPayoutPage projectId="proj_test"/>);
  await screen.findByText('Installer payout · Crew');
  expect(screen.queryByText('Add to this agreement')).toBeNull();
  expect(screen.getByText('Print payout sheet')).toBeTruthy();
});
it('requires a preview before confirmation and invalidates it when scope changes',async()=>{
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({events:[],canEdit:true})).mockImplementation(async()=>Response.json({fingerprint:'abc',calculation:{modelAllowanceExGst:1743.61,proposal:{benchmarkExGst:1886.96,transitionTopUpExGst:143.35,payoutExGst:1886.96,gst:283.04,totalPayable:2170}}}));
  vi.stubGlobal('fetch',fetcher); await render(<InstallerPayoutPage projectId="proj_test"/>);
  await screen.findByText('Review payout'); expect(screen.queryByText('Confirm agreed payout')).toBeNull();
  await fireEvent.click(screen.getByText('Review payout')); await screen.findByText('Confirm agreed payout');
  await fireEvent.change(screen.getByLabelText('Included installation scope'),{target:{value:'Different work'}});
  expect(screen.queryByText('Confirm agreed payout')).toBeNull();
});
it('retains the entered invoice on failure and uses admin endpoint without changing payment status',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(Response.json({events:[agreement],canEdit:true})).mockResolvedValue(Response.json({error:'Duplicate reference'},{status:409}));
  vi.stubGlobal('fetch',fetcher);await render(<InstallerPayoutPage projectId="proj_test"/>);
  await screen.findByText('Add to this agreement');
  await fireEvent.change(screen.getByLabelText('Entry type'),{target:{value:'invoice'}});
  await fireEvent.change(screen.getByLabelText('Invoice reference'),{target:{value:'INV25'}});
  await fireEvent.click(screen.getByText('Record invoice'));await screen.findByRole('alert');
  expect((screen.getByLabelText('Invoice reference') as HTMLInputElement).value).toBe('INV25');
  await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));
  expect(fetcher.mock.calls[1][0]).toContain('/api/admin/');
});
