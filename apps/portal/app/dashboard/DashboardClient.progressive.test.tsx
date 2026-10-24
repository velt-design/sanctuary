import {act} from 'react';
import {expect,it,vi} from 'vitest';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {renderIntoDocument} from '../../../../test/reactHarness';
import DashboardClient from './DashboardClient';
import {dashboardFixture,visitsFixture} from '@/app/qa/portal-progressive-fixture/data';
import type {DashboardData} from '@/lib/dashboard/types';
import type {VisitSnapshot} from '@/lib/siteVisits/contract';
import {ApiError} from '@/lib/repo/apiClient';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()}),usePathname:()=>'/dashboard',useSearchParams:()=>new URLSearchParams()}));
vi.mock('@/components/layout/GlobalPortalSearch.client',()=>({default:()=>null}));
function deferred<T>(){let resolve!:(value:T)=>void;return {promise:new Promise<T>(yes=>{resolve=yes;}),resolve:(value:T)=>resolve(value)};}
const flush=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,25));});
it('keeps actual Dashboard controls and card owners while independent visits arrive before complete core data',async()=>{
 const core=deferred<DashboardData>(),visits=deferred<VisitSnapshot>(),client=new QueryClient({defaultOptions:{queries:{retry:false,retryDelay:0}}});
 const view=renderIntoDocument(<QueryClientProvider client={client}><DashboardClient queueMode="today" loader={()=>core.promise} visitsLoader={()=>visits.promise}/></QueryClientProvider>);
 const portfolio=view.container.querySelector('[aria-label="Project portfolio"]'),tasks=view.container.querySelector('[aria-label="My Tasks"]'),field=view.container.querySelector<HTMLInputElement>('[aria-label="New dashboard task"]')!;
 expect(view.container.textContent).toContain('Reading portfolio');expect(view.container.textContent).toContain('Reading today’s site visits');expect(view.container.textContent).not.toContain('No personal tasks yet');expect(field.disabled).toBe(false);
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field,'Keep this reminder');field.dispatchEvent(new Event('input',{bubbles:true}));});
 const add=[...view.container.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Add')!;expect(add.disabled).toBe(true);
 await act(async()=>visits.resolve(visitsFixture()));expect(view.container.textContent).toContain('Demo household');expect(view.container.textContent).toContain('Reading portfolio');
 await act(async()=>core.resolve(dashboardFixture()));
 await flush();expect(view.container.querySelector('[data-dashboard-state="fresh"]')).not.toBeNull();
 expect(view.container.querySelector('[aria-label="Project portfolio"]')).toBe(portfolio);expect(view.container.querySelector('[aria-label="My Tasks"]')).toBe(tasks);expect(view.container.querySelector('[aria-label="New dashboard task"]')).toBe(field);expect(field.value).toBe('Keep this reminder');expect(add.disabled).toBe(false);expect(view.container.textContent).toContain('Review fictional courtyard plan');view.unmount();client.clear();
});
it('keeps the same Dashboard during terminal failure, retries and removes all data on access-ending refresh',async()=>{
 const read=vi.fn().mockRejectedValue(new Error('Synthetic dashboard failure')),client=new QueryClient({defaultOptions:{queries:{retry:false,retryDelay:0}}});
 const view=renderIntoDocument(<QueryClientProvider client={client}><DashboardClient queueMode="today" loader={read} visitsLoader={async()=>visitsFixture()}/></QueryClientProvider>);
 const portfolio=view.container.querySelector('[aria-label="Project portfolio"]');
 await flush();expect(view.container.textContent).toContain('Could not load the dashboard');
 expect(view.container.querySelector('[aria-label="Project portfolio"]')).toBe(portfolio);expect(view.container.textContent).not.toContain('No project notes yet');
 read.mockResolvedValue(dashboardFixture());await act(async()=>[...view.container.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Retry')!.click());
 await flush();expect(view.container.querySelector('[data-dashboard-state="fresh"]')).not.toBeNull();expect(view.container.querySelector('[aria-label="Project portfolio"]')).toBe(portfolio);
 read.mockRejectedValue(new ApiError('Denied',{status:403,body:null}));await act(async()=>{await client.refetchQueries();await new Promise(resolve=>setTimeout(resolve,0));});
 expect(view.container.textContent).toContain('Dashboard unavailable');expect(view.container.textContent).not.toContain('Review fictional courtyard plan');expect(view.container.textContent).not.toContain('Demo household');view.unmount();client.clear();
});
