import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import ContactDetailClient from './ContactDetailClient';
const mock=vi.hoisted(()=>({read:vi.fn(),projects:vi.fn(),toast: {error:vi.fn()}}));
vi.mock('@/lib/supabase/browserClient',()=>({getSupabaseBrowser:()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:mock.read})})})}),supabaseHostFromUrl:()=> 'fixture',supabaseRuntimeUrl:()=> 'https://fixture.invalid',supabaseRestUrl:()=> 'https://fixture.invalid/rest/v1/contacts'}));
vi.mock('@/lib/repo/projectsRepo',()=>({listProjectsForContact:mock.projects}));
vi.mock('@/components/ui/toast/ToastProvider',()=>({useToast:()=>mock.toast}));
vi.mock('@/components/navigation/PortalIndexLink',()=>({default:({children,...props}:any)=><a {...props}>{children}</a>}));
vi.mock('@/lib/localFirst/useLocalWorkingCopy',()=>({useLocalWorkingCopy:(_key:unknown,value:unknown)=>({hydrated:false,hasLocalCopy:false,value,clearWorkingCopy:async()=>{},setWorkingCopy:async()=>{}})}));
vi.mock('@/lib/localFirst/useEntitySyncState',()=>({useAliasedEntitySyncState:()=>({status:'idle',pendingCount:0})}));
const uuid='11111111-1111-4111-8111-111111111111', id='ct_'+uuid;
const row={id:uuid,name:'Fictional household',email:'demo@example.invalid',phone:'0215550100',created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-02T00:00:00Z'};
const flush=async()=>{await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});};
function mount(){const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});const ui=renderIntoDocument(<QueryClientProvider client={client}><ContactDetailClient contactId={id}/></QueryClientProvider>);return {...ui,close:()=>{ui.unmount();client.clear();}};}
beforeEach(()=>{mock.read.mockReset();mock.projects.mockReset().mockResolvedValue([{id:'proj_fixture',name:'Fictional courtyard',createdAt:row.created_at}]);});
afterEach(()=>{document.body.innerHTML='';});
describe('actual Contact query boundary and detail owner',()=>{
 it('shows independently loaded projects and retains real controls as genuine contact metadata arrives',async()=>{
  let resolve!:(value:unknown)=>void;mock.read.mockImplementation(()=>new Promise(done=>{resolve=done;}));
  const ui=mount();const info=ui.container.querySelector('[aria-label="Contact info"]'),head=ui.container.querySelector('thead');await flush();
  expect(ui.container.textContent).toContain('Fictional courtyard');expect(ui.container.textContent).toContain('Reading name');
  expect([...ui.container.querySelectorAll('button')].find(button=>button.textContent==='Edit')?.disabled).toBe(true);
  resolve({data:row,error:null,status:200});await flush();expect(ui.container.textContent).toContain('Fictional household');
  expect(ui.container.querySelector('[aria-label="Contact info"]')).toBe(info);expect(ui.container.querySelector('thead')).toBe(head);ui.close();
 });
 it('turns a rejected source into retryable failure, then recovers without a false missing-contact result',async()=>{
  mock.read.mockRejectedValueOnce(new TypeError('Network read failed')).mockResolvedValueOnce({data:row,error:null,status:200});
  const ui=mount();await flush();expect(ui.container.textContent).toContain('Contact unavailable');expect(ui.container.textContent).not.toContain('Contact not found');
  act(()=>[...ui.container.querySelectorAll('button')].find(button=>button.textContent==='Retry')!.click());await flush();
  expect(ui.container.textContent).toContain('Fictional household');expect(mock.read).toHaveBeenCalledTimes(2);ui.close();
 });
 it('reports confirmed zero visible records as not found and withholds linked work/edit targets',async()=>{
  mock.read.mockResolvedValue({data:null,error:null,status:200});const ui=mount();await flush();
  expect(ui.container.textContent).toContain('Contact not found');expect(ui.container.textContent).not.toContain('Fictional courtyard');
  expect([...ui.container.querySelectorAll('button')].find(button=>button.textContent==='Edit')?.disabled).toBe(true);ui.close();
 });
 it.each([401,403])('preserves denied status%s and clears private record content',async status=>{
  mock.read.mockResolvedValue({data:null,error:{code:'42501',message:'Access unavailable'},status});const ui=mount();await flush();
  expect(ui.container.textContent).toContain('Contact unavailable');expect(ui.container.textContent).not.toContain('Contact not found');expect(ui.container.textContent).not.toContain('Fictional courtyard');ui.close();
 });
});
