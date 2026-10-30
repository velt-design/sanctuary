import {act} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import SavedStudioReviewLoader from './SavedStudioReviewLoader';
const mocks=vi.hoisted(()=>({api:vi.fn(),chunk:vi.fn()}));
vi.mock('next/dynamic',async original=>{const actual=await original<typeof import('next/dynamic')>();return {default:(_load:unknown,options:unknown)=>actual.default(()=>mocks.chunk(),options as any)};});
vi.mock('@/lib/repo/apiClient',()=>({apiJson:mocks.api}));
vi.mock('@/components/auth/PortalAuthProvider',()=>({usePortalSession:()=>({user:{id:'actor'},role:'staff'})}));
vi.mock('./studioLeafLoading',()=>({loadSavedStudioReview:async()=>()=>null,loadStudioWebsiteReview:async()=>()=>null}));
let mounted:ReturnType<typeof renderIntoDocument>|undefined;
beforeEach(()=>{vi.resetAllMocks();mocks.api.mockResolvedValue({review:{estimate:{id:'est-source',projectId:'proj-project'},quote:{id:'qv-exact'}},quoteDocument:{id:'qv-exact',projectId:'proj-project',sourceEstimateVersionId:'est-source'}});});
afterEach(()=>{mounted?.unmount();mounted=undefined;});
it('uses the installed Next dynamic failure/retry lifecycle and preserves the exact already-authorised quote without refetching it',async()=>{
 const Doc=(props:any)=><div aria-label="Loaded quote">{props.quote.id} · {props.review.estimate.id}</div>;
 mocks.chunk.mockRejectedValueOnce(Error('Controlled chunk download failure')).mockResolvedValueOnce({default:Doc});
 mounted=renderIntoDocument(<SavedStudioReviewLoader projectId="proj-project" estimateId="est-source" quoteVersionId="qv-exact"/>);await act(async()=>{});
 expect(mocks.chunk).toHaveBeenCalledOnce();expect(mounted.container.textContent).toContain('The quote document could not be opened.');const retry=[...mounted.container.querySelectorAll('button')].find(b=>b.textContent==='Retry quote document')!;expect(retry).toBeTruthy();
 await act(async()=>retry.click());expect(mocks.chunk).toHaveBeenCalledTimes(2);expect(mounted.container.querySelector('[aria-label="Loaded quote"]')?.textContent).toBe('qv-exact · est-source');expect(mocks.api).toHaveBeenCalledOnce();expect(mocks.api.mock.calls[0][0]).toBe('/api/projects/proj-project/estimates/est-source/studio-review?quoteVersionId=qv-exact');
});
