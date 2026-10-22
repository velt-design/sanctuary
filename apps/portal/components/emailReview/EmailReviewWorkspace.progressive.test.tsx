import {act} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import EmailReviewWorkspace from './EmailReviewWorkspace';
import {createFixtureApi,fixtureItems} from '../../app/qa/email-review-fixture/fixtureApi';
import type {EmailReviewItem} from '@/lib/emailReview/contracts';
vi.mock('@/components/layout/StaffPageHeader',()=>({default:()=> <h1>Email review</h1>}));
afterEach(()=>{document.body.innerHTML='';vi.restoreAllMocks();});
it('uses the actual selected editor across deferred/error/retry reads and cannot adopt an older selected draft',async()=>{
 const api=createFixtureApi(),reads=new Map<string,{resolve:(value:EmailReviewItem)=>void;reject:(error:Error)=>void}>(),command=vi.spyOn(api,'command');api.item=vi.fn((_batch,id)=>new Promise<EmailReviewItem>((resolve,reject)=>reads.set(id,{resolve,reject})));
 const view=renderIntoDocument(<EmailReviewWorkspace api={api} synthetic/>);await act(async()=>{});const select=(id:number)=>[...view.container.querySelectorAll('button')].find(button=>button.querySelector('strong')?.textContent===`Example project ${id}`)!;
 await act(async()=>select(1).click());const recipient=view.container.querySelector<HTMLInputElement>('input[type="email"]')!,first=reads.get('example-draft-1')!;expect(recipient.value).toBe('');expect(recipient.closest('fieldset')?.disabled).toBe(true);expect(view.container.querySelector('[aria-label="Selected draft"]')?.getAttribute('aria-busy')).toBe('true');
 await act(async()=>select(4).click());await act(async()=>first.resolve(fixtureItems()[0]));expect(view.container.querySelector<HTMLInputElement>('input[type="email"]')?.value).toBe('');expect(view.container.querySelector('[aria-label="Selected draft"]')?.textContent).not.toContain('customer1@example.invalid');await act(async()=>reads.get('example-draft-4')!.reject(new Error('Offline')));const current=view.container.querySelector<HTMLInputElement>('input[type="email"]')!;expect(view.container.textContent).toContain('Draft unavailable');
 await act(async()=>[...view.container.querySelectorAll('button')].find(button=>button.textContent==='Retry draft')!.click());expect(view.container.textContent).not.toContain('Could not load this draft');await act(async()=>reads.get('example-draft-4')!.resolve(fixtureItems()[3]));expect(view.container.querySelector('input[type="email"]')).toBe(current);expect(current.value).toBe('customer4@example.invalid');expect(command).not.toHaveBeenCalled();await act(async()=>[...view.container.querySelectorAll('button')].find(button=>button.textContent==='Back to drafts')!.click());expect(view.container.textContent).toContain('Choose a draft to review');view.unmount();
});
