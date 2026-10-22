import {act} from 'react';
import {beforeEach,expect,it,vi} from 'vitest';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {renderIntoDocument} from '../../../../../../test/reactHarness';
import RunningJobsClient from './RunningJobsClient';
import {sheetFixture} from '@/app/qa/portal-progressive-fixture/data';
import type {RunningJobsResponse} from '@/lib/runningJobs/types';
import {ApiError} from '@/lib/repo/apiClient';
vi.mock('@/components/layout/GlobalPortalSearch.client',()=>({default:()=>null}));
beforeEach(()=>{Element.prototype.scrollIntoView=vi.fn();});
const toast={error:vi.fn()};vi.mock('@/components/ui/toast/ToastProvider',()=>({useToast:()=>toast}));
const flush=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,25));});
it('keeps actual Running Jobs search, column headers and zoom through deferred rows without false zeros or editable fictional cells',async()=>{
 let resolve!:(data:RunningJobsResponse)=>void;const promise=new Promise<RunningJobsResponse>(yes=>{resolve=yes;}),client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const view=renderIntoDocument(<QueryClientProvider client={client}><RunningJobsClient loader={()=>promise} readOnly/></QueryClientProvider>);
 const table=view.container.querySelector('table'),header=view.container.querySelector('thead'),search=view.container.querySelector<HTMLInputElement>('[placeholder="Search jobs"]')!,zoom=view.container.querySelector('[aria-label="Sheet zoom"]');
 expect(header?.textContent).toContain('Client name');expect(header?.textContent).toContain('Materials ordered');expect(view.container.textContent).toContain('Reading jobs');expect(view.container.textContent).not.toContain('0 of 0 jobs');expect(view.container.querySelectorAll('tbody tr')).toHaveLength(1);expect(search.disabled).toBe(false);
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(search,'courtyard');search.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>resolve(sheetFixture()));await flush();expect(view.container.textContent).toContain('Demo courtyard');
 expect(view.container.querySelector('table')).toBe(table);expect(view.container.querySelector('thead')).toBe(header);expect(view.container.querySelector('[aria-label="Sheet zoom"]')).toBe(zoom);expect(search.value).toBe('courtyard');expect(view.container.textContent).toContain('1 of 1 jobs');
 const cell=view.container.querySelector('[data-cell-id$=":running_notes"]');await act(async()=>cell?.dispatchEvent(new MouseEvent('dblclick',{bubbles:true})));expect(view.container.querySelector('textarea')).toBeNull();view.unmount();client.clear();
});
it('keeps the actual sheet on failure, retries and clears retained rows on denied refresh',async()=>{
 const read=vi.fn().mockRejectedValue(new Error('Synthetic sheet failure')),client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const view=renderIntoDocument(<QueryClientProvider client={client}><RunningJobsClient loader={read} readOnly/></QueryClientProvider>);const table=view.container.querySelector('table');
 await flush();expect(view.container.textContent).toContain('Could not load running jobs');expect(view.container.textContent).toContain('Jobs unavailable');expect(view.container.querySelector('table')).toBe(table);
 read.mockResolvedValue(sheetFixture());await act(async()=>[...view.container.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Retry running jobs')!.click());await flush();expect(view.container.textContent).toContain('Demo courtyard');
 read.mockRejectedValue(new ApiError('Denied',{status:403,body:null}));await act(async()=>{await client.refetchQueries();await new Promise(resolve=>setTimeout(resolve,0));});expect(view.container.textContent).not.toContain('Demo courtyard');expect(view.container.querySelector('table')).toBe(table);expect(view.container.querySelector('[data-cell-id]')).toBeNull();view.unmount();client.clear();
});
